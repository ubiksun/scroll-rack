import { db, autoPairCounterparts, type Card, type Printing, type SetMeta } from '../db'

const API = 'https://api.scryfall.com'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const GAP = 200   // ms between requests — Scryfall asks for 50–100; bursts across several sets got us throttled at ~15 req/3 s

// Scryfall throttles bursts (429, which the browser surfaces as a CORS failure). Retry with backoff before giving up.
async function apiFetch(url: string, tries = 4): Promise<Response> {
  let wait = 800
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url)
      if (res.status !== 429 && res.status < 500) return res
      if (i >= tries - 1) return res
    } catch (e) { if (i >= tries - 1) throw e }
    await sleep(wait); wait *= 2
  }
}

interface ScryfallCard {
  id: string; set: string; oracle_id: string; name: string; mana_cost?: string; cmc: number
  colors?: string[]; color_identity: string[]; rarity: string; type_line: string; oracle_text?: string
  keywords: string[]; image_uris?: Record<string, string>; collector_number: string; layout: string
  arena_id?: number; scryfall_uri: string; watermark?: string; border_color: string; frame_effects?: string[]; promo_types?: string[]; full_art?: boolean
  card_faces?: { mana_cost?: string; colors?: string[]; oracle_text?: string; image_uris?: Record<string, string> }[]
}

export interface ScryfallSetListItem { code: string; name: string; released_at: string; set_type: string; card_count: number; icon_svg_uri: string; digital: boolean }

export async function listSets(): Promise<ScryfallSetListItem[]> {
  const res = await apiFetch(`${API}/sets`)
  if (!res.ok) throw new Error(`Scryfall /sets ${res.status}`)
  const json = await res.json()
  const keep = new Set(['expansion', 'core', 'draft_innovation', 'masters', 'alchemy'])
  return (json.data as ScryfallSetListItem[])
    .filter(s => keep.has(s.set_type) && !s.digital)
    .sort((a, b) => b.released_at.localeCompare(a.released_at))
}

const numeric = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0

function toPrinting(c: ScryfallCard): Printing {
  const img = c.image_uris ?? c.card_faces?.[0]?.image_uris ?? {}
  return { id: c.id, collectorNumber: c.collector_number, imageSmall: img.small ?? '', imageNormal: img.normal ?? '',
    borderColor: c.border_color, frameEffects: c.frame_effects ?? [], promoTypes: c.promo_types ?? [], fullArt: c.full_art ?? false }
}

function toCard(c: ScryfallCard, printings: Printing[]): Card {
  const face = c.card_faces?.[0]
  const img = c.image_uris ?? face?.image_uris ?? {}
  const text = c.oracle_text ?? c.card_faces?.map(f => f.oracle_text ?? '').filter(Boolean).join('\n//\n') ?? ''
  return {
    id: c.id,
    set: c.set,
    oracleId: c.oracle_id,
    name: c.name,
    manaCost: c.mana_cost ?? c.card_faces?.map(f => f.mana_cost ?? '').filter(Boolean).join(' // ') ?? '',
    cmc: c.cmc,
    colors: c.colors ?? face?.colors ?? [],
    colorIdentity: c.color_identity,
    rarity: c.rarity,
    typeLine: c.type_line,
    oracleText: text,
    keywords: c.keywords ?? [],
    imageSmall: img.small ?? '',
    imageNormal: img.normal ?? '',
    collectorNumber: c.collector_number,
    layout: c.layout,
    arenaId: c.arena_id,
    scryfallUri: c.scryfall_uri,
    watermark: c.watermark,
    printings,
  }
}

// Global search (any set): Scryfall syntax → cards, one printing per oracle (Scryfall's unique=cards pick), up to
// `maxPages` × 175. Cards not yet in the local DB are inserted so they can be rated / badged like any other.
export async function searchCards(query: string, maxPages = 2, signal?: AbortSignal): Promise<Card[]> {
  let url: string | null = `${API}/cards/search?q=${encodeURIComponent(query)}&unique=cards&order=released`
  const out: Card[] = []
  for (let i = 0; url && i < maxPages; i++) {
    const res: Response = await fetch(url, { signal })
    if (res.status === 404) break
    if (!res.ok) throw new Error(`Scryfall ${res.status}`)
    const page = await res.json()
    for (const c of page.data as ScryfallCard[]) out.push(toCard(c, [toPrinting(c)]))
    url = page.has_more ? page.next_page : null
    if (url) await sleep(GAP)
  }
  const have = new Set((await db.cards.where('id').anyOf(out.map(c => c.id)).toArray()).map(c => c.id))
  const fresh = out.filter(c => !have.has(c.id))
  if (fresh.length) await db.cards.bulkPut(fresh)
  // prefer the already-cached record (has full printings list) when the set is cached
  const cached = new Map((await db.cards.where('oracleId').anyOf(out.map(c => c.oracleId)).toArray()).map(c => [`${c.set}:${c.oracleId}`, c]))
  return out.map(c => cached.get(`${c.set}:${c.oracleId}`) ?? c)
}

// Pulls every printing in the set, groups by oracle_id, and makes the REGULAR printing (lowest collector number)
// the card's default — Scryfall's own unique=cards collapse sometimes picks a showcase/borderless variant, and for
// brand-new sets frame_effects/promo_types aren't populated yet, so collector number is the only reliable signal.
// Replaces the local copy, returns the card count. Safe to re-run during spoiler season.
export async function fetchSet(code: string, onProgress?: (n: number) => void): Promise<number> {
  const metaRes = await apiFetch(`${API}/sets/${code}`)
  if (!metaRes.ok) throw new Error(`Scryfall /sets/${code} ${metaRes.status}`)
  const meta = await metaRes.json()

  let url: string | null = `${API}/cards/search?q=${encodeURIComponent(`e:${code}`)}&unique=prints&order=set`
  const raw: ScryfallCard[] = []
  while (url) {
    const res: Response = await apiFetch(url)
    if (!res.ok) throw new Error(`Scryfall search ${res.status}`)
    const page = await res.json()
    raw.push(...(page.data as ScryfallCard[]))
    onProgress?.(raw.length)
    url = page.has_more ? page.next_page : null
    if (url) await sleep(GAP)
  }
  const groups = new Map<string, ScryfallCard[]>()
  for (const c of raw) { const g = groups.get(c.oracle_id); g ? g.push(c) : groups.set(c.oracle_id, [c]) }
  const cards: Card[] = []
  for (const g of groups.values()) {
    g.sort((a, b) => numeric(a.collector_number) - numeric(b.collector_number))
    cards.push(toCard(g[0], g.map(toPrinting)))
  }

  const setMeta: SetMeta = {
    code: meta.code, name: meta.name, releasedAt: meta.released_at,
    iconSvg: meta.icon_svg_uri, cardCount: cards.length, fetchedAt: Date.now(),
  }
  await db.transaction('rw', [db.sets, db.cards], async () => {
    await db.cards.where('set').equals(code).delete()
    await db.cards.bulkPut(cards)
    await db.sets.put(setMeta)
  })
  await autoPairCounterparts(code)
  return cards.length
}
