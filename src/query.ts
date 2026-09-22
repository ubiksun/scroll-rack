// The filter + multi-sort pipeline, as pure functions. Lifted out of state.tsx in v0.10 so that every Browse dock can
// run its own copy over the shared card data — the query is per-dock, the cards are not.
import type { Card, Context, Rating, Scheme, ZhCard } from './db'

export type View = 'grid' | 'single' | 'board'
export type SortKey = 'number' | 'name' | 'cmc' | 'color' | 'rarity' | 'pair' | 'community' | `tier:${string}`
export interface SortRule { key: SortKey; dir: 'asc' | 'desc' }
export const TIER_SEP = String.fromCharCode(0)   // tierF = `${ctxId}${TIER_SEP}${tierName}`
export type SearchState = 'idle' | 'busy' | 'local' | 'error'

const RARITY_ORDER: Record<string, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3, special: 4, bonus: 5 }
const COLOR_ORDER = (cs: string[]) => cs.length === 0 ? 5 : cs.length > 1 ? 6 : 'WUBRG'.indexOf(cs[0])
// Basic Land (incl. Snow-Covered / Wastes) — hidden by default, toggle in ⚙ Options.
export const isBasicLand = (c: Card) => /^Basic (Snow )?Land\b/.test(c.typeLine)

// What a dock stores in its dockview params: JSON-safe, so no Sets.
export interface SerializedQuery {
  textF: string
  searchScope: 'active' | 'all'
  colorF: string[]
  rarityF: string[]
  ratedF: 'all' | 'rated' | 'unrated'
  tierF: string
  tagF: string
  sorts: SortRule[]
  view: View
  zoom: number                                   // grid thumbnail minimum width in px
}
// What the UI touches.
export interface ScopeQuery extends Omit<SerializedQuery, 'colorF' | 'rarityF'> {
  colorF: Set<string>
  rarityF: Set<string>
}

export const DEFAULT_QUERY: SerializedQuery = {
  textF: '', searchScope: 'active', colorF: [], rarityF: [], ratedF: 'all', tierF: '', tagF: '',
  sorts: [{ key: 'number', dir: 'asc' }], view: 'grid', zoom: 150,
}

export const hydrate = (q?: Partial<SerializedQuery> | null): ScopeQuery => {
  const s = { ...DEFAULT_QUERY, ...(q ?? {}) }
  return { ...s, colorF: new Set(s.colorF ?? []), rarityF: new Set(s.rarityF ?? []) }
}
export const serialize = (q: ScopeQuery): SerializedQuery => ({ ...q, colorF: [...q.colorF], rarityF: [...q.rarityF] })

// Everything the pipeline needs from the shared workspace store.
export interface QueryDeps {
  cards: Card[]                                  // the active sets' cards
  globalResults: Card[] | null                   // 🌐 all-sets search results
  searchIds: Set<string> | null                  // ▣ active-sets search result (oracleIds)
  searchState: SearchState
  showBasics: boolean
  zhById: Map<string, ZhCard>
  contexts: Context[]
  ratingOf: (c: Card, ctx: string) => Rating | undefined
  schemeOf: (ctxId: string) => Scheme | undefined
  tagsByCard: Map<string, Set<string>>
  percentiles: Map<string, number>
  partnerOf: Map<string, string>
}

const numeric = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0

export function runQuery(q: ScopeQuery, d: QueryDeps): Card[] {
  const text = q.textF.trim()
  const lower = text.toLowerCase()
  const [tfCtx, tfTier] = q.tierF ? q.tierF.split(TIER_SEP) : ['', '']
  const pool = q.searchScope === 'all' && text ? (d.globalResults ?? []) : d.cards
  const out = pool.filter(c => {
    if (!d.showBasics && isBasicLand(c)) return false
    if (q.colorF.size) { const cs = c.colors.length ? c.colors : ['C']; if (!cs.some(x => q.colorF.has(x))) return false }
    if (q.rarityF.size && !q.rarityF.has(c.rarity)) return false
    const anyTier = d.contexts.some(x => d.ratingOf(c, x.id)?.tier)
    if (q.ratedF === 'rated' && !anyTier) return false
    if (q.ratedF === 'unrated' && anyTier) return false
    if (q.tierF && d.ratingOf(c, tfCtx)?.tier !== tfTier) return false
    if (q.tagF && !d.tagsByCard.get(c.oracleId)?.has(q.tagF)) return false
    if (lower && q.searchScope !== 'all') {
      if (d.searchIds) { if (!d.searchIds.has(c.oracleId)) return false }
      else if (d.searchState === 'local' && !c.name.toLowerCase().includes(lower) && !c.oracleText.toLowerCase().includes(lower) && !c.typeLine.toLowerCase().includes(lower) && !(d.zhById.get(c.id)?.name ?? '').includes(text) && !(d.zhById.get(c.id)?.text ?? '').includes(text)) return false
    }
    return true
  })
  const bySet = (a: Card, b: Card) => a.set.localeCompare(b.set) || numeric(a.collectorNumber) - numeric(b.collectorNumber)
  const byO = new Map(out.map(c => [c.oracleId, c]))
  const pairRank = (c: Card) => { const p = d.partnerOf.get(c.oracleId); const pc = p ? byO.get(p) : undefined; return pc ? Math.min(numeric(c.collectorNumber), numeric(pc.collectorNumber)) : 1e6 + numeric(c.collectorNumber) }
  const tierIdx = (c: Card, ctxId: string) => { const sc = d.schemeOf(ctxId); const i = sc ? sc.tiers.findIndex(x => x.name === d.ratingOf(c, ctxId)?.tier) : -1; return i < 0 ? 999 : i }
  const cmp = (r: SortRule) => (a: Card, b: Card): number => {
    let diff = 0
    switch (r.key) {
      case 'number': diff = bySet(a, b); break
      case 'name': diff = a.name.localeCompare(b.name); break
      case 'cmc': diff = a.cmc - b.cmc; break
      case 'color': diff = COLOR_ORDER(a.colors) - COLOR_ORDER(b.colors); break
      case 'rarity': diff = (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9); break
      case 'pair': diff = pairRank(a) - pairRank(b); break
      case 'community': diff = (d.percentiles.get(b.name) ?? -1) - (d.percentiles.get(a.name) ?? -1); break
      default: if (r.key.startsWith('tier:')) diff = tierIdx(a, r.key.slice(5)) - tierIdx(b, r.key.slice(5))
    }
    return r.dir === 'desc' ? -diff : diff
  }
  const rules = (q.sorts.length ? q.sorts : [{ key: 'number', dir: 'asc' } as SortRule]).map(cmp)
  out.sort((a, b) => { for (const f of rules) { const diff = f(a, b); if (diff) return diff } return bySet(a, b) })
  return out
}

// Navigation list: in pair mode a counterpart pair counts once (its first member in filter order).
export function buildNavList(filtered: Card[], pairMode: boolean, partnerOf: Map<string, string>): Card[] {
  if (!pairMode) return filtered
  const seen = new Set<string>(); const out: Card[] = []
  for (const c of filtered) {
    if (seen.has(c.oracleId)) continue
    out.push(c); seen.add(c.oracleId)
    const p = partnerOf.get(c.oracleId); if (p) seen.add(p)
  }
  return out
}

// Auto-title for a search dock's tab. Empty query → the generic label the caller supplies.
export function titleFor(q: ScopeQuery, fallback: string): string {
  const text = q.textF.trim()
  if (!text) return fallback
  const short = text.length > 24 ? `${text.slice(0, 23)}…` : text
  return q.searchScope === 'all' ? `🌐 ${short}` : short
}
