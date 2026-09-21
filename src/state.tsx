import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureDefaults, getSetting, setSetting, pickPrinting, upsertRating, applyBadgePrefs, type BadgePrefs, type BadgeStyle, type ArtMode, type ArtPref, type Card, type CardTag, type CommunitySnapshot, type Context, type Edge, type Rating, type Scheme, type SetMeta } from './db'
import { fetchSet } from './api/scryfall'
import { fetchCommunity, gihPercentiles } from './api/seventeen'
import { scryfallOracleIds, SyntaxError, searchCards } from './api/search'
import { FEATURES } from './features'
import { fetchCommunityTags as fetchCommunityTagsDirect } from './api/tagger'
import { fetchZhSet } from './api/mtgch'
import { setLang as setI18n, type Lang } from './i18n'
import type { ZhCard } from './db'
// In the extension, Tagger requests go through the background worker (see background.ts); the vite preview calls directly.
const fetchCommunityTags: typeof fetchCommunityTagsDirect = (set, cn, oracleId, force) =>
  typeof chrome !== 'undefined' && chrome.runtime?.id
    ? new Promise(res => chrome.runtime.sendMessage({ type: 'tagger', set, collectorNumber: cn, oracleId, force }, r => res(r && !r.error ? r : null)))
    : fetchCommunityTagsDirect(set, cn, oracleId, force)
import type { CommunityTagsRow } from './db'
import type { BadgeInfo } from './components/CardGrid'
import { PANEL_SECTIONS, type SectionId } from './components/CardPanel'

export type View = 'grid' | 'single' | 'board'
export type SortKey = 'number' | 'name' | 'cmc' | 'color' | 'rarity' | 'pair' | 'community' | `tier:${string}`
export interface SortRule { key: SortKey; dir: 'asc' | 'desc' }
const RARITY_ORDER: Record<string, number> = { common: 0, uncommon: 1, rare: 2, mythic: 3, special: 4, bonus: 5 }
const COLOR_ORDER = (cs: string[]) => cs.length === 0 ? 5 : cs.length > 1 ? 6 : 'WUBRG'.indexOf(cs[0])
export const rk = (set: string, oracleId: string) => `${set}:${oracleId}`
// Basic Land (incl. Snow-Covered / Wastes) — hidden by default, toggle in ⚙ Options.
export const isBasicLand = (c: Card) => /^Basic (Snow )?Land\b/.test(c.typeLine)

// All app state lives here so every docked panel (Browse / Graph / Card / Oracle) reads the same store.
export interface Grader {
  ready: boolean
  status: string; setStatus: (s: string) => void
  activeSets: string[]; localSets: SetMeta[]; busySet: string | null; toggleSet: (c: string) => void; pullSet: (c: string) => void; pullMany: (codes: string[]) => void
  view: View; setView: (v: View) => void
  selected: Card | null; setSelected: (c: Card | null) => void; jump: (oracleId: string) => void
  selIndex: number; goPrev: () => void; goNext: () => void
  filtered: Card[]; cards: Card[]; allCards: Card[]
  contexts: Context[]; schemes: Scheme[]; firstCtx: Context | undefined; firstScheme: Scheme | undefined
  ratingOf: (c: Card, ctx: string) => Rating | undefined; badgesFor: (c: Card) => BadgeInfo[]; schemeOf: (ctxId: string) => Scheme | undefined
  selRatings: Rating[]; selTags: CardTag[]; selEdges: Edge[]
  edges: Edge[]; allTagRows: CardTag[]; allTags: string[]; linkedIds: Set<string>; cardsByOracle: Map<string, Card>
  imageOf: (c: Card, size?: 'small' | 'normal') => string; artMode: ArtMode; artPrefs: Map<string, ArtPref>; setArtPref: (c: Card, id: string | null) => void
  // filters
  colorF: Set<string>; rarityF: Set<string>; ratedF: 'all' | 'rated' | 'unrated'; tierF: string; tagF: string; textF: string; sorts: SortRule[]
  setColorF: (s: Set<string>) => void; setRarityF: (s: Set<string>) => void; setRatedF: (v: 'all' | 'rated' | 'unrated') => void; setTierF: (v: string) => void; setTagF: (v: string) => void; setTextF: (v: string) => void; setSorts: (v: SortRule[]) => void
  searchScope: 'active' | 'all'; setSearchScope: (v: 'active' | 'all') => void
  searchState: 'idle' | 'busy' | 'local' | 'error'
  tierOptions: { v: string; label: string }[]
  // community (flagged)
  showCommunity: boolean; setShowCommunity: (v: boolean) => void; percentiles: Map<string, number>; communityRows: Map<string, CommunitySnapshot['rows'][number]>; communitySnaps: CommunitySnapshot[]; pullCommunity: () => void
  // panel prefs
  sections: SectionId[]; moveSection: (id: SectionId, dir: -1 | 1) => void; collapsed: Set<string>; toggleCollapse: (id: string) => void
  ratedCount: number
  // language layer (大學院廢墟)
  lang: Lang; setLang: (l: Lang) => void; cardLang: Lang; setCardLang: (l: Lang) => void; zhOf: (c: Card) => ZhCard | undefined; nameOf: (c: Card) => string; typeOf: (c: Card) => string; oracleOf: (c: Card) => string; zhImageOf: (c: Card) => string | undefined
  // experiments
  taggerOn: boolean; community: CommunityTagsRow | null; refreshCommunity: () => void
  // counterpart pairs
  partnerOf: Map<string, string>; hasPairs: boolean; pairMode: boolean; navList: Card[]
  pairSetting: 'auto' | 'off' | undefined; setPairSetting: (v: 'auto' | 'off') => void; pairOnce: string | null; showPairOnce: (oracleId: string) => void; showPair: boolean
}

const Ctx = createContext<Grader | null>(null)
export const useGrader = () => { const g = useContext(Ctx); if (!g) throw new Error('useGrader outside provider'); return g }

export function GraderProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('')
  const [activeSets, setActiveSets] = useState<string[]>([])
  const [busySet, setBusySet] = useState<string | null>(null)
  const [view, setView] = useState<View>('grid')
  const [selected, setSelected] = useState<Card | null>(null)
  const [colorF, setColorF] = useState<Set<string>>(new Set())
  const [rarityF, setRarityF] = useState<Set<string>>(new Set())
  const [ratedF, setRatedF] = useState<'all' | 'rated' | 'unrated'>('all')
  const [tierF, setTierF] = useState('')
  const [tagF, setTagF] = useState('')
  const [textF, setTextF] = useState('')
  const [sorts, setSortsState] = useState<SortRule[]>([{ key: 'number', dir: 'asc' }])
  const [searchScope, setSearchScopeState] = useState<'active' | 'all'>('active')
  const [globalResults, setGlobalResults] = useState<Card[] | null>(null)
  const [searchIds, setSearchIds] = useState<Set<string> | null>(null)
  const [searchState, setSearchState] = useState<'idle' | 'busy' | 'local' | 'error'>('idle')
  const [showCommunity, setShowCommunity] = useState(false)
  const [artMode] = useState<ArtMode>('regular')
  const [sections, setSections] = useState<SectionId[]>([...PANEL_SECTIONS])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [pairOnce, setPairOnce] = useState<string | null>(null)
  const [lang, setLangState] = useState<Lang>('en')          // UI strings
  const [cardLang, setCardLangState] = useState<Lang>('en')  // card names / text / scans (大學院廢墟 when 中文)
  const [community, setCommunity] = useState<CommunityTagsRow | null>(null)

  useEffect(() => {
    (async () => {
      await ensureDefaults()
      const legacy = await getSetting('activeSet', '')
      setActiveSets(await getSetting<string[]>('activeSets', legacy ? [legacy] : []))
      setShowCommunity(await getSetting('showCommunity', false))
      const saved = await getSetting<SectionId[]>('panelSections', [...PANEL_SECTIONS])
      setSections([...saved.filter(s => PANEL_SECTIONS.includes(s)), ...PANEL_SECTIONS.filter(s => !saved.includes(s))])
      setCollapsed(new Set(await getSetting<string[]>('collapsed', [])))
      setSortsState(await getSetting<SortRule[]>('sorts', [{ key: 'number', dir: 'asc' }]))
      setSearchScopeState(await getSetting<'active' | 'all'>('searchScope', 'active'))
      const l = await getSetting<Lang>('lang', 'en'); setI18n(l); setLangState(l)
      setCardLangState(await getSetting<Lang>('cardLang', 'en'))
      setReady(true)
    })()
  }, [])
  useEffect(() => { if (ready) void setSetting('activeSets', activeSets) }, [activeSets, ready])
  useEffect(() => { if (ready) void setSetting('showCommunity', showCommunity) }, [showCommunity, ready])
  useEffect(() => { if (ready) void setSetting('panelSections', sections) }, [sections, ready])
  useEffect(() => { if (ready) void setSetting('collapsed', [...collapsed]) }, [collapsed, ready])
  useEffect(() => { if (ready) void setSetting('sorts', sorts) }, [sorts, ready])
  useEffect(() => { if (ready) void setSetting('searchScope', searchScope) }, [searchScope, ready])
  useEffect(() => { if (ready) void setSetting('lang', lang) }, [lang, ready])
  useEffect(() => { if (ready) void setSetting('cardLang', cardLang) }, [cardLang, ready])

  const localSets = useLiveQuery(() => db.sets.orderBy('code').toArray(), []) ?? []
  const schemes = useLiveQuery(() => db.schemes.toArray(), []) ?? []
  const contexts = useLiveQuery(() => db.contexts.orderBy('order').toArray(), []) ?? []
  const setsKey = activeSets.join(',')
  const cards = useLiveQuery(() => activeSets.length ? db.cards.where('set').anyOf(activeSets).toArray() : Promise.resolve([] as Card[]), [setsKey]) ?? []
  const allCards = useLiveQuery(() => db.cards.toArray(), []) ?? []
  const ratingRows = useLiveQuery(() => activeSets.length ? db.ratings.where('set').anyOf(activeSets).toArray() : Promise.resolve([] as Rating[]), [setsKey]) ?? []
  const edges = useLiveQuery(() => db.edges.toArray(), []) ?? []
  const allTagRows = useLiveQuery(() => db.cardTags.toArray(), []) ?? []
  const artPrefRows = useLiveQuery(() => db.artPrefs.toArray(), []) ?? []
  const badgePrefs = useLiveQuery<BadgePrefs>(async () => ({ contexts: await getSetting<string[] | null>('badgeContexts', null), styles: await getSetting<Record<string, Partial<BadgeStyle>>>('badgeStyles', {}) }), []) ?? { contexts: null, styles: {} }
  const showBasics = useLiveQuery(() => getSetting<boolean>('showBasicLands', false), []) ?? false
  const taggerOn = useLiveQuery(() => getSetting<boolean>('exp.tagger', false), []) ?? false
  const pairSetting = useLiveQuery(() => getSetting<'auto' | 'off' | undefined>('echoversePairs', undefined), [])
  const pairMode = pairSetting === 'auto'
  // Chinese layer: rows for the active sets; pulled lazily the first time a set is viewed in 中文
  const zhRows = useLiveQuery(() => cardLang === 'zh' && activeSets.length ? db.zh.where('set').anyOf(activeSets).toArray() : Promise.resolve([] as ZhCard[]), [setsKey, cardLang]) ?? []
  const zhById = useMemo(() => new Map(zhRows.map(z => [z.id, z])), [zhRows])
  const zhSetsLoaded = useMemo(() => new Set(zhRows.map(z => z.set)), [zhRows])
  useEffect(() => {
    if (cardLang !== 'zh') return
    let live = true
    ;(async () => {
      for (const code of activeSets) {
        if (zhSetsLoaded.has(code)) continue
        if (!(await db.sets.get(code))) continue
        setStatus(`大學院廢墟：載入 ${code.toUpperCase()} 中文資料…`)
        try { const n = await fetchZhSet(code); if (live) setStatus(`大學院廢墟：${code.toUpperCase()} ${n} 張中文資料`) } catch (e) { if (live) setStatus(`大學院廢墟 ${code.toUpperCase()}: ${String(e)}`) }
      }
    })()
    return () => { live = false }
  }, [cardLang, setsKey, localSets.length])
  const zhOf = useCallback((c: Card) => cardLang === 'zh' ? (zhById.get(c.id) ?? c.printings?.map(p => zhById.get(p.id)).find(Boolean)) : undefined, [cardLang, zhById])
  const nameOf = useCallback((c: Card) => zhOf(c)?.name || c.name, [zhOf])
  const typeOf = useCallback((c: Card) => zhOf(c)?.typeLine || c.typeLine, [zhOf])
  const oracleOf = useCallback((c: Card) => { const z = zhOf(c); return z?.text ? (z.backText ? `${z.text}\n//\n${z.backText}` : z.text) : c.oracleText }, [zhOf])
  const zhImageOf = useCallback((c: Card) => zhOf(c)?.image || undefined, [zhOf])
  const communitySnaps = useLiveQuery(() => FEATURES.community && activeSets.length ? db.community.where('set').anyOf(activeSets).toArray() : Promise.resolve([] as CommunitySnapshot[]), [setsKey]) ?? []

  const ratings = useMemo(() => {
    const m = new Map<string, Map<string, Rating>>()
    for (const r of ratingRows) { const k = rk(r.set, r.oracleId); if (!m.has(k)) m.set(k, new Map()); m.get(k)!.set(r.context, r) }
    return m
  }, [ratingRows])
  const ratingOf = useCallback((c: Card, ctx: string) => ratings.get(rk(c.set, c.oracleId))?.get(ctx), [ratings])
  const schemeOf = useCallback((ctxId: string) => { const c = contexts.find(x => x.id === ctxId); return schemes.find(s => s.id === c?.schemeId) }, [contexts, schemes])
  const badgesFor = useCallback((c: Card): BadgeInfo[] => {
    const out: BadgeInfo[] = []
    for (const ctx of contexts) { const r = ratingOf(c, ctx.id); const tier = r?.tier ? schemeOf(ctx.id)?.tiers.find(x => x.name === r.tier) : undefined; if (tier) out.push({ ctxId: ctx.id, ctx: ctx.name, tier: tier.name, color: tier.color }) }
    return applyBadgePrefs(out, badgePrefs)
  }, [contexts, ratingOf, schemeOf, badgePrefs])
  const artPrefs = useMemo(() => new Map(artPrefRows.map(a => [a.key, a])), [artPrefRows])
  const cardsByOracle = useMemo(() => new Map(allCards.map(c => [c.oracleId, c])), [allCards])
  const linkedIds = useMemo(() => { const s = new Set<string>(); edges.forEach(e => { s.add(e.a); s.add(e.b) }); return s }, [edges])
  const tagsByCard = useMemo(() => { const m = new Map<string, Set<string>>(); allTagRows.forEach(x => { if (!m.has(x.oracleId)) m.set(x.oracleId, new Set()); m.get(x.oracleId)!.add(x.tag) }); return m }, [allTagRows])
  const allTags = useMemo(() => [...new Set(allTagRows.map(x => x.tag))].sort(), [allTagRows])
  const communityRows = useMemo(() => new Map(communitySnaps.flatMap(s => s.rows).map(r => [r.name, r])), [communitySnaps])
  const percentiles = useMemo(() => { const m = new Map<string, number>(); for (const s of communitySnaps) gihPercentiles(s.rows).forEach((v, k) => m.set(k, v)); return m }, [communitySnaps])
  const firstCtx = contexts[0]
  const firstScheme = firstCtx ? schemeOf(firstCtx.id) : undefined

  const imageOf = useCallback((c: Card, size: 'small' | 'normal' = 'small') => {
    const pref = artPrefs.get(`${c.set}:${c.oracleId}`)
    if (!pref) { const zh = zhImageOf(c); if (zh) return size === 'small' ? zh.replace('/normal/', '/small/') : zh }   // 中文 scan unless the user pinned an art
    const p = pickPrinting(c, artMode, pref)
    return size === 'small' ? (p.imageSmall || p.imageNormal) : (p.imageNormal || p.imageSmall)
  }, [artMode, artPrefs, zhImageOf])
  const setArtPref = useCallback(async (c: Card, printingId: string | null) => {
    const key = `${c.set}:${c.oracleId}`
    if (printingId) await db.artPrefs.put({ key, set: c.set, oracleId: c.oracleId, printingId }); else await db.artPrefs.delete(key)
  }, [])

  // search: Scryfall syntax via API, local fallback offline
  useEffect(() => {
    const q = textF.trim()
    setGlobalResults(null)
    if (!q || (searchScope === 'active' && !activeSets.length)) { setSearchIds(null); setSearchState('idle'); return }
    // CJK query → Scryfall can't match 大學院廢墟 names; search the local Chinese layer instead
    if (/[\u3400-\u9fff]/.test(q)) { setSearchIds(null); setSearchState('local'); return }
    const ctrl = new AbortController()
    setSearchState('busy')
    const h = setTimeout(async () => {
      try {
        if (searchScope === 'all') { setGlobalResults(await searchCards(q, 2, ctrl.signal)); setSearchIds(null) }
        else setSearchIds(await scryfallOracleIds(activeSets, q, ctrl.signal))
        setSearchState('idle')
      } catch (e) {
        if (ctrl.signal.aborted) return
        if (e instanceof SyntaxError || String(e).includes('400')) { setSearchIds(new Set()); setGlobalResults([]); setSearchState('error'); return }
        setSearchIds(null); setSearchState('local')
      }
    }, 400)
    return () => { clearTimeout(h); ctrl.abort() }
  }, [textF, setsKey, searchScope])

  const numeric = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0
  const filtered = useMemo(() => {
    const q = textF.trim().toLowerCase()
    const [tfCtx, tfTier] = tierF ? tierF.split('\u0000') : ['', '']
    const tierIndex = (c: Card) => { if (!firstCtx || !firstScheme) return 999; const i = firstScheme.tiers.findIndex(x => x.name === ratingOf(c, firstCtx.id)?.tier); return i < 0 ? 999 : i }
    const pool = searchScope === 'all' && textF.trim() ? (globalResults ?? []) : cards
    const out = pool.filter(c => {
      if (!showBasics && isBasicLand(c)) return false
      if (colorF.size) { const cs = c.colors.length ? c.colors : ['C']; if (!cs.some(x => colorF.has(x))) return false }
      if (rarityF.size && !rarityF.has(c.rarity)) return false
      const anyTier = contexts.some(x => ratingOf(c, x.id)?.tier)
      if (ratedF === 'rated' && !anyTier) return false
      if (ratedF === 'unrated' && anyTier) return false
      if (tierF && ratingOf(c, tfCtx)?.tier !== tfTier) return false
      if (tagF && !tagsByCard.get(c.oracleId)?.has(tagF)) return false
      if (q && !(searchScope === 'all')) {
        if (searchIds) { if (!searchIds.has(c.oracleId)) return false }
        else if (searchState === 'local' && !c.name.toLowerCase().includes(q) && !c.oracleText.toLowerCase().includes(q) && !c.typeLine.toLowerCase().includes(q) && !(zhById.get(c.id)?.name ?? '').includes(q) && !(zhById.get(c.id)?.text ?? '').includes(q)) return false
      }
      return true
    })
    const bySet = (a: Card, b: Card) => a.set.localeCompare(b.set) || numeric(a.collectorNumber) - numeric(b.collectorNumber)
    const partner = new Map<string, string>()
    for (const e of edges) if (e.tags.includes('counterpart')) { partner.set(e.a, e.b); partner.set(e.b, e.a) }
    const byO = new Map(out.map(c => [c.oracleId, c]))
    const pairRank = (c: Card) => { const p = partner.get(c.oracleId); const pc = p ? byO.get(p) : undefined; return pc ? Math.min(numeric(c.collectorNumber), numeric(pc.collectorNumber)) : 1e6 + numeric(c.collectorNumber) }
    const tierIdx = (c: Card, ctxId: string) => { const sc = schemeOf(ctxId); const i = sc ? sc.tiers.findIndex(x => x.name === ratingOf(c, ctxId)?.tier) : -1; return i < 0 ? 999 : i }
    const cmp = (r: SortRule) => (a: Card, b: Card): number => {
      let d = 0
      switch (r.key) {
        case 'number': d = bySet(a, b); break
        case 'name': d = a.name.localeCompare(b.name); break
        case 'cmc': d = a.cmc - b.cmc; break
        case 'color': d = COLOR_ORDER(a.colors) - COLOR_ORDER(b.colors); break
        case 'rarity': d = (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9); break
        case 'pair': d = pairRank(a) - pairRank(b); break
        case 'community': d = (percentiles.get(b.name) ?? -1) - (percentiles.get(a.name) ?? -1); break
        default: if (r.key.startsWith('tier:')) d = tierIdx(a, r.key.slice(5)) - tierIdx(b, r.key.slice(5))
      }
      return r.dir === 'desc' ? -d : d
    }
    const rules = (sorts.length ? sorts : [{ key: 'number', dir: 'asc' } as SortRule]).map(cmp)
    out.sort((a, b) => { for (const f of rules) { const d = f(a, b); if (d) return d } return bySet(a, b) })
    return out
  }, [cards, globalResults, searchScope, showBasics, zhById, colorF, rarityF, ratedF, tierF, tagF, textF, searchIds, searchState, sorts, ratings, percentiles, contexts, schemes, schemeOf, tagsByCard, firstCtx, firstScheme, ratingOf, edges])

  const visibleCards = useMemo(() => showBasics ? cards : cards.filter(c => !isBasicLand(c)), [cards, showBasics])
  const ratedCount = useMemo(() => visibleCards.filter(c => contexts.some(x => ratingOf(c, x.id)?.tier)).length, [visibleCards, contexts, ratingOf])
  // counterpart pairs (edges tagged #counterpart, e.g. FRA echoverse)
  const partnerOf = useMemo(() => { const m = new Map<string, string>(); for (const e of edges) if (e.tags.includes('counterpart')) { m.set(e.a, e.b); m.set(e.b, e.a) } return m }, [edges])
  const hasPairs = useMemo(() => cards.some(c => partnerOf.has(c.oracleId)), [cards, partnerOf])
  // navigation list: in pair mode a pair counts once (its first member in filter order)
  const navList = useMemo(() => {
    if (!pairMode) return filtered
    const seen = new Set<string>(); const out: Card[] = []
    for (const c of filtered) { if (seen.has(c.oracleId)) continue; out.push(c); seen.add(c.oracleId); const p = partnerOf.get(c.oracleId); if (p) seen.add(p) }
    return out
  }, [filtered, pairMode, partnerOf])
  const selIndex = useMemo(() => {
    if (!selected) return -1
    const i = navList.findIndex(c => c.id === selected.id); if (i >= 0 || !pairMode) return i
    const p = partnerOf.get(selected.oracleId); return p ? navList.findIndex(c => c.oracleId === p) : -1
  }, [selected, navList, pairMode, partnerOf])
  const goPrev = useCallback(() => { const i = selIndex < 0 ? 0 : selIndex - 1; if (i >= 0 && i < navList.length) setSelected(navList[i]) }, [selIndex, navList])
  const goNext = useCallback(() => { const i = selIndex < 0 ? 0 : selIndex + 1; if (i >= 0 && i < navList.length) setSelected(navList[i]) }, [selIndex, navList])
  const showPair = !!selected && !!partnerOf.get(selected.oracleId) && (pairMode || pairOnce === selected.oracleId || pairOnce === partnerOf.get(selected.oracleId))

  // community tags (Tagger) for the selected card
  const refreshCommunity = useCallback(() => { if (selected && taggerOn) void fetchCommunityTags(selected.set, selected.collectorNumber, selected.oracleId, true).then(setCommunity) }, [selected, taggerOn])
  useEffect(() => {
    setCommunity(null)
    if (!selected || !taggerOn) return
    let live = true
    void fetchCommunityTags(selected.set, selected.collectorNumber, selected.oracleId).then(r => { if (live) setCommunity(r) })
    return () => { live = false }
  }, [selected?.id, taggerOn])

  // Global keyboard: ← → navigate the current filter · 1–9 tier in FIRST context · n notes · Esc back to grid.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable
      if (e.key === 'Escape') { (e.target as HTMLElement).blur?.(); if (!typing && view === 'single') setView('grid'); return }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') { goNext(); e.preventDefault(); return }
      if (e.key === 'ArrowLeft') { goPrev(); e.preventDefault(); return }
      if (/^[1-9]$/.test(e.key) && selected && firstCtx && firstScheme) {
        const tier = firstScheme.tiers[Number(e.key) - 1]
        if (tier) void upsertRating(selected.set, selected.oracleId, firstCtx.id, { tier: ratingOf(selected, firstCtx.id)?.tier === tier.name ? null : tier.name })
        return
      }
      if (e.key === 'n' && firstCtx) { e.preventDefault(); (document.getElementById(`note-${firstCtx.id}`) as HTMLTextAreaElement | null)?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, goPrev, goNext, selected, firstCtx, firstScheme, ratingOf])
  // Card view always shows something from the current filter: if the selection fell out of it, jump to the first entry
  useEffect(() => { if (view === 'single' && navList.length && selIndex < 0) setSelected(navList[0]) }, [view, navList, selIndex])

  const moveSection = useCallback((id: SectionId, dir: -1 | 1) => setSections(ss => { const i = ss.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= ss.length) return ss; const c = [...ss]; [c[i], c[j]] = [c[j], c[i]]; return c }), [])
  const toggleCollapse = useCallback((id: string) => setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }), [])

  const pullSet = useCallback(async (code: string) => {
    setBusySet(code); setStatus(`Fetching ${code.toUpperCase()}…`)
    try {
      const n = await fetchSet(code, k => setStatus(`Fetching ${code.toUpperCase()}… ${k} prints`))
      setStatus(`${code.toUpperCase()}: ${n} cards cached`)
      setActiveSets(s => (s.includes(code) ? s : [...s, code]))
    } catch (e) { setStatus(String(e)) } finally { setBusySet(null) }
  }, [])
  // Load a whole format group: download what's missing (sequentially, Scryfall-polite), activate everything.
  const pullMany = useCallback(async (codes: string[]) => {
    const missing = codes.filter(c => !localSets.some(s => s.code === c))
    const failed: string[] = []
    let i = 0
    for (const code of missing) {
      i++; setBusySet(code); setStatus(`Loading ${i}/${missing.length}: ${code.toUpperCase()}…`)
      try { await fetchSet(code, k => setStatus(`Loading ${i}/${missing.length}: ${code.toUpperCase()} … ${k} prints`)) } catch (e) { setStatus(`${code.toUpperCase()}: ${String(e)}`); failed.push(code) }
      await new Promise(r => setTimeout(r, 600))   // breathe between sets — Scryfall throttles bursts
    }
    setBusySet(null)
    const ok = codes.filter(c => !failed.includes(c))
    setActiveSets(s => [...new Set([...s, ...ok])])
    setStatus(failed.length ? `${ok.length} sets active · failed: ${failed.map(c => c.toUpperCase()).join(', ')} — retry with load all` : `${codes.length} sets active`)
  }, [localSets])
  const toggleSet = useCallback(async (code: string) => {
    if (activeSets.includes(code)) { setActiveSets(s => s.filter(x => x !== code)); return }
    if (localSets.some(s => s.code === code)) setActiveSets(s => [...s, code]); else await pullSet(code)
  }, [activeSets, localSets, pullSet])
  const pullCommunity = useCallback(async () => {
    for (const code of activeSets) { setStatus(`Fetching 17lands ${code.toUpperCase()}…`); try { const s = await fetchCommunity(code); setStatus(s.rows.length ? `17lands ${code.toUpperCase()}: ${s.rows.length} cards` : `17lands: no data yet for ${code.toUpperCase()}`) } catch (e) { setStatus(String(e)) } }
  }, [activeSets])
  const jump = useCallback((oracleId: string) => {
    const c = cardsByOracle.get(oracleId); if (!c) return
    setSelected(c); setActiveSets(s => (s.includes(c.set) ? s : [...s, c.set]))
  }, [cardsByOracle])

  const selEdges = useMemo(() => selected ? edges.filter(e => e.a === selected.oracleId || e.b === selected.oracleId) : [], [selected, edges])
  const selTags = useMemo(() => selected ? allTagRows.filter(x => x.oracleId === selected.oracleId) : [], [selected, allTagRows])
  const selRatings = useMemo(() => selected ? [...(ratings.get(rk(selected.set, selected.oracleId))?.values() ?? [])] : [], [selected, ratings])
  const tierOptions = useMemo(() => contexts.flatMap(ctx => (schemeOf(ctx.id)?.tiers ?? []).map(x => ({ v: `${ctx.id}\u0000${x.name}`, label: contexts.length > 1 ? `${ctx.name}: ${x.name}` : x.name }))), [contexts, schemeOf])

  const value: Grader = {
    ready, status, setStatus, activeSets, localSets, busySet, toggleSet, pullSet, pullMany, view, setView, selected, setSelected, jump, selIndex, goPrev, goNext,
    filtered, cards: visibleCards, allCards, contexts, schemes, firstCtx, firstScheme, ratingOf, badgesFor, schemeOf, selRatings, selTags, selEdges,
    edges, allTagRows, allTags, linkedIds, cardsByOracle, imageOf, artMode, artPrefs, setArtPref,
    colorF, rarityF, ratedF, tierF, tagF, textF, sorts, setColorF, setRarityF, setRatedF, setTierF, setTagF, setTextF, setSorts: setSortsState, searchScope, setSearchScope: setSearchScopeState, searchState, tierOptions,
    showCommunity, setShowCommunity, percentiles, communityRows, communitySnaps, pullCommunity,
    sections, moveSection, collapsed, toggleCollapse, ratedCount,
    lang, setLang: (l: Lang) => { setI18n(l); setLangState(l) }, cardLang, setCardLang: setCardLangState, zhOf, nameOf, typeOf, oracleOf, zhImageOf,
    taggerOn, community, refreshCommunity, partnerOf, hasPairs, pairMode, navList,
    pairSetting, setPairSetting: v => { void setSetting('echoversePairs', v) }, pairOnce, showPairOnce: setPairOnce, showPair,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
