// MV3 service worker. Owns the extension-origin IndexedDB on behalf of the scryfall.com content script
// (content scripts live in the page's origin, so they can't open our DB directly — they message us).
import { FEATURES } from './features'
import { db, ensureDefaults, upsertRating, addTag, removeTag, getBadgePrefs, applyBadgePrefs, type Card } from './db'
import { fetchSet } from './api/scryfall'
import { fetchCommunityTags } from './api/tagger'
import { gihPercentiles } from './api/seventeen'
import type { Badge, BadgeMap, Msg, OverlayLookup } from './messages'

const APP_URL = chrome.runtime.getURL('index.html')

async function openApp() {
  const tabs = await chrome.tabs.query({ url: APP_URL })
  if (tabs.length && tabs[0].id !== undefined) {
    await chrome.tabs.update(tabs[0].id, { active: true })
    if (tabs[0].windowId !== undefined) await chrome.windows.update(tabs[0].windowId, { focused: true })
    return
  }
  await chrome.tabs.create({ url: APP_URL })
}
chrome.action.onClicked.addListener(() => { void openApp() })

// printing id → card, across every cached set. Rebuilt lazily; invalidated when a set is (re)fetched.
let printingIndex: Map<string, Card> | null = null
async function getPrintingIndex() {
  if (printingIndex) return printingIndex
  const m = new Map<string, Card>()
  for (const c of await db.cards.toArray()) { m.set(c.id, c); for (const p of c.printings ?? []) m.set(p.id, c) }
  printingIndex = m
  return m
}

async function lookup(set: string, collectorNumber: string): Promise<OverlayLookup> {
  await ensureDefaults()
  const setLoaded = !!(await db.sets.get(set))
  const inSet = await db.cards.where('set').equals(set).toArray()
  const card = inSet.find(c => c.collectorNumber === collectorNumber || c.printings?.some(p => p.collectorNumber === collectorNumber))
  if (!card) return { found: false, set, setLoaded }

  const [contexts, schemes, ratings, tags, edges, snap, activeContext] = await Promise.all([
    db.contexts.orderBy('order').toArray(), db.schemes.toArray(),
    db.ratings.where('oracleId').equals(card.oracleId).and(r => r.set === set).toArray(),
    db.cardTags.where('oracleId').equals(card.oracleId).toArray(),
    db.edges.where('a').equals(card.oracleId).or('b').equals(card.oracleId).toArray(),
    db.community.get(`${set}:PremierDraft`),
    firstContextId(),
  ])
  const others = await db.cards.where('oracleId').anyOf(edges.map(e => (e.a === card.oracleId ? e.b : e.a))).toArray()
  const nameOf = new Map(others.map(c => [c.oracleId, c.name]))
  const row = snap?.rows.find(r => r.name === card.name)
  const pct = snap ? gihPercentiles(snap.rows).get(card.name) ?? null : null
  return {
    found: true, set, oracleId: card.oracleId, name: card.name, collectorNumber: card.collectorNumber,
    ratings: contexts.map(c => { const r = ratings.find(x => x.context === c.id); return { context: c.id, tier: r?.tier ?? null, note: r?.note ?? '' } }),
    tags: tags.map(t => t.tag),
    links: edges.map(e => ({ tags: e.tags ?? [], source: e.source, name: nameOf.get(e.a === card.oracleId ? e.b : e.a) ?? '?', note: e.note })),
    community: snap && row ? { gih: row.ever_drawn_win_rate, oh: row.opening_hand_win_rate, iwd: row.drawn_improvement_win_rate, alsa: row.avg_seen, ata: row.avg_pick, games: row.game_count, percentile: pct, fetchedAt: snap.fetchedAt } : null,
    contexts, schemes, activeContext,
    features: { community: FEATURES.community, links: FEATURES.links },
  }
}

// No "active context" any more (round-2 decision): overlay notes + grid badges follow the FIRST context (default Limited).
async function firstContextId() { return (await db.contexts.orderBy('order').first())?.id ?? 'limited' }

// Badges for one card: every context that has a tier, in context order, filtered by the user's badge prefs.
async function badgesForCard(card: Card): Promise<Badge[]> {
  const [contexts, schemes, ratings, prefs] = await Promise.all([db.contexts.orderBy('order').toArray(), db.schemes.toArray(), db.ratings.where('oracleId').equals(card.oracleId).and(r => r.set === card.set).toArray(), getBadgePrefs()])
  const out: Badge[] = []
  for (const ctx of contexts) {
    const r = ratings.find(x => x.context === ctx.id)
    const tier = r?.tier ? schemes.find(s => s.id === ctx.schemeId)?.tiers.find(t => t.name === r.tier) : undefined
    if (tier) out.push({ ctxId: ctx.id, ctx: ctx.name, tier: tier.name, color: tier.color })
  }
  return applyBadgePrefs(out, prefs)
}

async function badges(printingIds: string[]): Promise<BadgeMap> {
  await ensureDefaults()
  const idx = await getPrintingIndex()
  const out: BadgeMap = {}
  const cache = new Map<string, Badge[]>()
  for (const id of printingIds) {
    const card = idx.get(id)
    if (!card) { out[id] = []; continue }
    const k = `${card.set}:${card.oracleId}`
    if (!cache.has(k)) cache.set(k, await badgesForCard(card))
    out[id] = cache.get(k)!
  }
  return out
}

async function badgesByNumber(set: string, collectorNumber: string): Promise<Badge[]> {
  await ensureDefaults()
  const inSet = await db.cards.where('set').equals(set).toArray()
  const card = inSet.find(c => c.collectorNumber === collectorNumber || c.printings?.some(p => p.collectorNumber === collectorNumber))
  return card ? badgesForCard(card) : []
}

chrome.runtime.onMessage.addListener((msg: Msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'lookup': return lookup(msg.set, msg.collectorNumber)
      case 'badges': return badges(msg.printingIds)
      case 'badgesForCard': return badgesByNumber(msg.set, msg.collectorNumber)
      case 'rate': await upsertRating(msg.set, msg.oracleId, msg.context, { tier: msg.tier }); return { ok: true }
      case 'note': await upsertRating(msg.set, msg.oracleId, msg.context, { note: msg.note }); return { ok: true }
      case 'tag': msg.remove ? await removeTag(msg.oracleId, msg.tag) : await addTag(msg.oracleId, msg.tag); return { ok: true }
      case 'fetchSet': { const n = await fetchSet(msg.set); printingIndex = null; return { ok: true, count: n } }
      case 'openApp': await openApp(); return { ok: true }
      // Tagger runs here, not in the page: the tagger.scryfall.com HTML reply carries `Link: …; rel=preload` headers, and
      // a document context would try to honour them (CSP noise in chrome://extensions). A service worker ignores them.
      case 'tagger': return fetchCommunityTags(msg.set, msg.collectorNumber, msg.oracleId, msg.force)
    }
  })().then(sendResponse, e => sendResponse({ error: String(e) }))
  return true   // keep the channel open for the async response
})
