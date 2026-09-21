import Dexie, { type Table } from 'dexie'

export interface SetMeta {
  code: string
  name: string
  releasedAt: string
  iconSvg: string
  cardCount: number
  fetchedAt: number
}

export interface Printing {
  id: string            // Scryfall printing id
  collectorNumber: string
  imageSmall: string
  imageNormal: string
  borderColor: string
  frameEffects: string[]
  promoTypes: string[]
  fullArt: boolean
}

export interface Card {
  id: string            // Scryfall printing id of the DEFAULT (regular-frame) printing
  set: string
  oracleId: string
  name: string
  manaCost: string
  cmc: number
  colors: string[]      // W U B R G (empty = colorless)
  colorIdentity: string[]
  rarity: string
  typeLine: string
  oracleText: string
  keywords: string[]
  imageSmall: string
  imageNormal: string
  collectorNumber: string
  layout: string
  arenaId?: number
  scryfallUri: string
  watermark?: string     // e.g. 'echoverse' (FRA parallel-universe versions)
  printings: Printing[] // every printing of this oracle_id in the set, sorted by collector number
}

// Per-card art override: which printing to display. Absent = follow the global art preference.
export interface ArtPref { key: string; set: string; oracleId: string; printingId: string }
export type ArtMode = 'regular' | 'alt'   // regular = lowest collector number; alt = highest (showcase/borderless when present)

export interface Tier { name: string; color: string }
export interface Scheme { id: string; name: string; tiers: Tier[] }  // tiers ordered best → worst

// A rating context = "what am I rating this card FOR": Limited, Modern, Standard, Cube… Each has its own scheme.
export interface Context { id: string; name: string; schemeId: string; order: number }

export interface Rating {
  key: string           // `${set}:${oracleId}:${context}`
  set: string
  oracleId: string
  context: string
  tier: string | null
  note: string
  updatedAt: number
}

// Tags describe what a card IS (oracle-level, so they carry across sets). Edges describe who it plays WITH.
export interface CardTag { key: string; oracleId: string; tag: string; createdAt: number }   // key = `${oracleId}:${tag}`

export type EdgeSource = 'manual' | 'deck' | 'suggested' | 'set'   // set = derived from set data (e.g. FRA echoverse counterparts)
// A link is just "A relates to B" (undirected) + why. Tags are added afterwards and drive graph layers/filters.
export interface Edge {
  id?: number
  a: string             // oracleId
  b: string             // oracleId
  tags: string[]
  note: string
  source: EdgeSource
  createdAt: number
}

export interface CommunitySnapshot {
  key: string           // `${set}:${format}`
  set: string
  format: string
  fetchedAt: number
  rows: CommunityRow[]
}
export interface CommunityRow {
  name: string
  color: string
  rarity: string
  avg_seen: number | null
  avg_pick: number | null
  game_count: number
  win_rate: number | null
  opening_hand_win_rate: number | null
  drawn_win_rate: number | null
  ever_drawn_win_rate: number | null
  never_drawn_win_rate: number | null
  drawn_improvement_win_rate: number | null
}

export interface Setting { key: string; value: unknown }

// 大學院廢墟 Chinese layer, per printing id (joins cards.id). image = mtgch zhs scan when one exists.
export interface ZhCard { id: string; set: string; oracleId: string; collectorNumber: string; name: string; typeLine: string; text: string; flavor: string; image: string; backName: string; backText: string; fetchedAt: number }

// Scryfall Tagger community data, cached per oracle_id (experimental feature).
export interface CommunityTagsRow { oracleId: string; cardTags: string[]; artTags: string[]; relationships: { kind: string; name: string; oracleId: string }[]; fetchedAt: number }

class GraderDB extends Dexie {
  sets!: Table<SetMeta, string>
  cards!: Table<Card, string>
  schemes!: Table<Scheme, string>
  contexts!: Table<Context, string>
  ratings!: Table<Rating, string>
  cardTags!: Table<CardTag, string>
  edges!: Table<Edge, number>
  community!: Table<CommunitySnapshot, string>
  settings!: Table<Setting, string>
  artPrefs!: Table<ArtPref, string>
  communityTags!: Table<CommunityTagsRow, string>
  zh!: Table<ZhCard, string>

  constructor() {
    super('limited-grader')
    this.version(1).stores({
      sets: 'code',
      cards: 'id, set, oracleId, name, [set+collectorNumber]',
      schemes: 'id',
      ratings: 'key, set, oracleId',
      edges: '++id, a, b, source',
      community: 'key, set',
      settings: 'key',
    })
    this.version(2).stores({ artPrefs: 'key, set' })
    // v3: rating contexts (Limited vs Constructed…) + tags. Existing ratings become context "limited".
    this.version(3).stores({
      contexts: 'id, order',
      ratings: 'key, set, oracleId, context, [set+context]',
      cardTags: 'key, oracleId, tag',
    }).upgrade(async tx => {
      const old = await tx.table('ratings').toArray() as Rating[]
      await tx.table('ratings').clear()
      await tx.table('ratings').bulkAdd(old.map(r => ({ ...r, context: r.context ?? 'limited', key: `${r.set}:${r.oracleId}:${r.context ?? 'limited'}` })))
    })
    // v4: edge.type (fixed vocabulary) → edge.tags[] (free, multi). Old type becomes the first tag unless it was "other".
    this.version(4).stores({ edges: '++id, a, b, source, *tags' }).upgrade(async tx => {
      await tx.table('edges').toCollection().modify((e: Edge & { type?: string }) => {
        if (!e.tags) e.tags = e.type && e.type !== 'other' ? [e.type] : []
        delete e.type
      })
    })
    this.version(5).stores({ communityTags: 'oracleId' })
    this.version(6).stores({ zh: 'id, set, oracleId' })
  }
}

export const db = new GraderDB()

export const DEFAULT_SCHEME: Scheme = {
  id: 'default',
  name: 'S–F',
  tiers: [
    { name: 'S', color: '#e5484d' },
    { name: 'A', color: '#f76b15' },
    { name: 'B', color: '#ffb224' },
    { name: 'C', color: '#46a758' },
    { name: 'D', color: '#3e63dd' },
    { name: 'F', color: '#8b8d98' },
  ],
}
export const CONSTRUCTED_SCHEME: Scheme = {
  id: 'constructed',
  name: 'Constructed',
  tiers: [
    { name: 'Staple', color: '#e5484d' },
    { name: 'Playable', color: '#ffb224' },
    { name: 'Niche', color: '#3e63dd' },
    { name: 'No', color: '#8b8d98' },
  ],
}
export const DEFAULT_CONTEXTS: Context[] = [
  { id: 'limited', name: 'Limited', schemeId: 'default', order: 0 },
  { id: 'constructed', name: 'Constructed', schemeId: 'constructed', order: 1 },
]

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}
export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

export async function ensureDefaults() {
  if ((await db.schemes.count()) === 0) await db.schemes.bulkPut([DEFAULT_SCHEME, CONSTRUCTED_SCHEME])
  else if (!(await db.schemes.get('constructed'))) await db.schemes.put(CONSTRUCTED_SCHEME)
  if ((await db.contexts.count()) === 0) await db.contexts.bulkPut(DEFAULT_CONTEXTS)
  if (!(await getSetting<string | null>('activeContext', null))) await setSetting('activeContext', 'limited')
}

export const ratingKey = (set: string, oracleId: string, context: string) => `${set}:${oracleId}:${context}`

// Resolve which printing to show for a card.
export function pickPrinting(card: Card, mode: ArtMode, pref?: ArtPref): Printing {
  const ps = card.printings?.length ? card.printings : [{ id: card.id, collectorNumber: card.collectorNumber, imageSmall: card.imageSmall, imageNormal: card.imageNormal, borderColor: 'black', frameEffects: [], promoTypes: [], fullArt: false }]
  if (pref) { const hit = ps.find(p => p.id === pref.printingId); if (hit) return hit }
  return mode === 'alt' ? ps[ps.length - 1] : ps[0]
}

export async function upsertRating(set: string, oracleId: string, context: string, patch: Partial<Rating>) {
  const key = ratingKey(set, oracleId, context)
  const cur = (await db.ratings.get(key)) ?? { key, set, oracleId, context, tier: null, note: '', updatedAt: 0 }
  await db.ratings.put({ ...cur, ...patch, updatedAt: Date.now() })
}

export async function addTag(oracleId: string, tag: string) {
  const t = tag.trim().toLowerCase().replace(/^#/, '')
  if (!t) return
  await db.cardTags.put({ key: `${oracleId}:${t}`, oracleId, tag: t, createdAt: Date.now() })
}
export const removeTag = (oracleId: string, tag: string) => db.cardTags.delete(`${oracleId}:${tag}`)

// ---- badge display prefs (which rating contexts show as badges on card images, and how many) ----
// Per-dimension badge placement, modelled on Material Design 3 "Badge" anchoring: a badge sits at one of the four
// corners of its anchor (the card image); badges sharing a corner stack away from it. Shape/size follow M3 sizing
// (small dot-ish / large labelled). Label = tier only, or "Dimension: tier".
export interface BadgeStyle { pos: 'tl' | 'tr' | 'bl' | 'br'; shape: 'pill' | 'circle' | 'square'; size: 's' | 'm' | 'l'; label: 'tier' | 'full' }
export const DEFAULT_BADGE_STYLE: BadgeStyle = { pos: 'tl', shape: 'pill', size: 'm', label: 'tier' }
export interface BadgePrefs { contexts: string[] | null; styles: Record<string, Partial<BadgeStyle>> }   // contexts null = all
export async function getBadgePrefs(): Promise<BadgePrefs> {
  return { contexts: await getSetting<string[] | null>('badgeContexts', null), styles: await getSetting<Record<string, Partial<BadgeStyle>>>('badgeStyles', {}) }
}
export const badgeStyleOf = (prefs: BadgePrefs, ctxId: string): BadgeStyle => ({ ...DEFAULT_BADGE_STYLE, ...(prefs.styles[ctxId] ?? {}) })
export function applyBadgePrefs<T extends { ctxId: string }>(badges: T[], prefs: BadgePrefs): (T & { style: BadgeStyle })[] {
  const kept = prefs.contexts ? badges.filter(b => prefs.contexts!.includes(b.ctxId)) : badges
  return kept.map(b => ({ ...b, style: badgeStyleOf(prefs, b.ctxId) }))
}

// ---- edges ----
export const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
export const normTag = (t: string) => t.trim().toLowerCase().replace(/^#/, '')
export async function addEdge(a: string, b: string, note = '', source: EdgeSource = 'manual') {
  const dup = await db.edges.where('a').equals(a).and(e => e.b === b).or('a').equals(b).and(e => e.b === a).first()
  if (dup) return dup.id!
  return db.edges.add({ a, b, tags: [], note, source, createdAt: Date.now() }) as Promise<number>
}
export const COUNTERPART_TAG = 'counterpart'

// FRA "Echoverse pairs": every legendary from #195 up has a parallel-universe twin. Scryfall marks one side with
// watermark 'echoverse' (a few with 'desparked'), but has no explicit link, so we pair by:
//   1. shared significant name token (Chandra ↔ Chandra, Rescue Girl ↔ Massacre Girl, Geist of Saint Thalia ↔ Thalia)
//   2. "Way of the …" enchantments: by colour identity (the watermark is missing on some of these)
//   3. a short alias table for the rest (Titanbones ↔ Tinybones)
// Only unambiguous matches become edges (source 'set', tag #counterpart). Left unpaired: Codie (#168), Jace (#216), Tam (#276).
const STOP = new Set(['the', 'of', 'and', 'saint', 'first', 'most', 'reality', 'sculptor'])
const tokens = (n: string) => n.toLowerCase().replace(/'s\b/g, '').split(/[^a-z]+/).filter(t => t.length >= 3 && !STOP.has(t))
const FRA_ALIASES: [string, string][] = [
  ['Titanbones, Towering Heart', 'Tinybones, Pocket Nuisance'],
]
export async function autoPairCounterparts(set: string): Promise<number> {
  const cards = await db.cards.where('set').equals(set).toArray()
  // drop set-derived pairs from a previous (possibly wrong) run before recomputing
  const oids = new Set(cards.map(c => c.oracleId))
  const stale = (await db.edges.where('source').equals('set').toArray()).filter(e => oids.has(e.a) && oids.has(e.b))
  if (stale.length) await db.edges.bulkDelete(stale.map(e => e.id!))
  const legends = cards.filter(c => /Legendary/.test(c.typeLine))
  const byName = new Map(cards.map(c => [c.name, c]))
  const pairs: [Card, Card][] = []
  const used = new Set<string>()
  const take = (a: Card | undefined, b: Card | undefined) => { if (a && b && a.oracleId !== b.oracleId && !used.has(a.oracleId) && !used.has(b.oracleId)) { pairs.push([a, b]); used.add(a.oracleId); used.add(b.oracleId) } }
  // 3. aliases first (explicit beats heuristic)
  for (const [x, y] of FRA_ALIASES) take(byName.get(x), byName.get(y))
  // 2. Way of the … by colour
  const ways = legends.filter(c => /^Way of the /.test(c.name))
  for (const w of ways) { if (used.has(w.oracleId)) continue; const m = ways.filter(o => o !== w && !used.has(o.oracleId) && o.colorIdentity.join() === w.colorIdentity.join()); if (m.length === 1) take(w, m[0]) }
  // 1. echoverse ↔ non-echoverse by shared name token
  const echo = legends.filter(c => c.watermark === 'echoverse' && !used.has(c.oracleId))
  const others = legends.filter(c => c.watermark !== 'echoverse')
  for (const e of echo) {
    const et = new Set(tokens(e.name))
    const m = others.filter(o => !used.has(o.oracleId) && tokens(o.name).some(t => et.has(t)))
    if (m.length === 1) take(e, m[0])
  }
  let n = 0
  for (const [a, b] of pairs) { const id = await addEdge(a.oracleId, b.oracleId, '', 'set'); await tagEdge(id, COUNTERPART_TAG); n++ }
  return n
}

export async function tagEdge(id: number, tag: string, remove = false) {
  const t = normTag(tag); if (!t) return
  const e = await db.edges.get(id); if (!e) return
  const tags = remove ? e.tags.filter(x => x !== t) : e.tags.includes(t) ? e.tags : [...e.tags, t]
  await db.edges.update(id, { tags })
}

// ---- export / import (full backup; the only sync path in the prototype) ----
export interface ExportBundle {
  version: 2
  exportedAt: number
  schemes: Scheme[]
  contexts: Context[]
  ratings: Rating[]
  cardTags: CardTag[]
  edges: Edge[]
  settings: Setting[]
  artPrefs: ArtPref[]
}

export async function exportBundle(): Promise<ExportBundle> {
  const [schemes, contexts, ratings, cardTags, edges, settings, artPrefs] = await Promise.all([
    db.schemes.toArray(), db.contexts.toArray(), db.ratings.toArray(), db.cardTags.toArray(), db.edges.toArray(), db.settings.toArray(), db.artPrefs.toArray(),
  ])
  return { version: 2, exportedAt: Date.now(), schemes, contexts, ratings, cardTags, edges, settings, artPrefs }
}

// Merge semantics: newer updatedAt wins for ratings; edges deduped on unordered (a,b) with tags unioned; the rest put.
// Accepts v1 bundles (no contexts/tags; ratings without context → "limited").
export async function importBundle(raw: unknown) {
  const b = raw as Omit<Partial<ExportBundle>, 'version'> & { version: number }
  if (b.version !== 1 && b.version !== 2) throw new Error(`Unsupported bundle version ${String(b.version)}`)
  await db.transaction('rw', [db.schemes, db.contexts, db.ratings, db.cardTags, db.edges, db.settings, db.artPrefs], async () => {
    if (b.schemes) await db.schemes.bulkPut(b.schemes)
    if (b.contexts) await db.contexts.bulkPut(b.contexts)
    if (b.settings) await db.settings.bulkPut(b.settings)
    if (b.artPrefs) await db.artPrefs.bulkPut(b.artPrefs)
    if (b.cardTags) await db.cardTags.bulkPut(b.cardTags)
    for (const r0 of b.ratings ?? []) {
      const context = r0.context ?? 'limited'
      const r = { ...r0, context, key: ratingKey(r0.set, r0.oracleId, context) }
      const cur = await db.ratings.get(r.key)
      if (!cur || cur.updatedAt < r.updatedAt) await db.ratings.put(r)
    }
    const existing = await db.edges.toArray()
    const byPair = new Map(existing.map(e => [edgeKey(e.a, e.b), e]))
    for (const e0 of b.edges ?? []) {
      const legacy = e0 as Edge & { type?: string }
      const tags = legacy.tags ?? (legacy.type && legacy.type !== 'other' ? [legacy.type] : [])
      const cur = byPair.get(edgeKey(e0.a, e0.b))
      if (cur) { const merged = [...new Set([...cur.tags, ...tags])]; if (merged.length !== cur.tags.length || (!cur.note && e0.note)) await db.edges.update(cur.id!, { tags: merged, note: cur.note || e0.note }); continue }
      const { id: _id, type: _t, ...rest } = legacy
      const added: Edge = { ...rest, tags }
      added.id = await db.edges.add(added) as number
      byPair.set(edgeKey(e0.a, e0.b), added)
    }
  })
}
