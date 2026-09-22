import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ensureDefaults, getSetting, setSetting, pickPrinting, applyBadgePrefs, type BadgePrefs, type BadgeStyle, type ArtMode, type ArtPref, type Card, type CardTag, type CommunitySnapshot, type Context, type Edge, type Rating, type Scheme, type SetMeta } from './db'
import { fetchSet } from './api/scryfall'
import { fetchCommunity, gihPercentiles } from './api/seventeen'
import { FEATURES } from './features'
import { fetchCommunityTags as fetchCommunityTagsDirect } from './api/tagger'
import { fetchZhSet } from './api/mtgch'
import { setLang as setI18n, type Lang } from './i18n'
import { isBasicLand, TIER_SEP, type QueryDeps, type View } from './query'
import type { ZhCard } from './db'
// In the extension, Tagger requests go through the background worker (see background.ts); the vite preview calls directly.
export const fetchCommunityTags: typeof fetchCommunityTagsDirect = (set, cn, oracleId, force) =>
  typeof chrome !== 'undefined' && chrome.runtime?.id
    ? new Promise(res => chrome.runtime.sendMessage({ type: 'tagger', set, collectorNumber: cn, oracleId, force }, r => res(r && !r.error ? r : null)))
    : fetchCommunityTagsDirect(set, cn, oracleId, force)
import type { BadgeInfo } from './components/CardGrid'
import { PANEL_SECTIONS, type SectionId } from './components/CardPanel'
import type { OracleLang, OracleMode } from './docks'

export { isBasicLand } from './query'
export type { View, SortKey, SortRule } from './query'
export const rk = (set: string, oracleId: string) => `${set}:${oracleId}`

// Scryfall serves each scan at a size in the URL path, so 'large' (672px) can be derived from the stored 'normal'
// (488px) URL. Guarded: if the path ever stops matching we just keep what we have.
export type ImgSize = 'small' | 'normal' | 'large'
const atSize = (url: string, size: ImgSize) => {
  if (!url) return url
  const m = url.match(/\/(small|normal|large|png|art_crop|border_crop)\//)
  return m ? url.replace(m[0], `/${size}/`) : url
}

// What a Browse dock registers with the store so the shell's keyboard handler and the export menu can reach it.
export interface NavHandle {
  goPrev: () => void
  goNext: () => void
  setView: (v: View) => void
  showPairOnce: (oracleId: string) => void
  view: View
  selected: Card | null
  filtered: Card[]
  tierF: string
}

// The WORKSPACE store: card data, ratings, tags, links, prefs — everything shared by every dock. Per-dock query state
// (search text, filters, sort, selection) lives in src/scope.tsx instead, one instance per Browse dock.
export interface Grader {
  ready: boolean
  status: string; setStatus: (s: string) => void
  activeSets: string[]; localSets: SetMeta[]; busySet: string | null; toggleSet: (c: string) => void; pullSet: (c: string) => void; pullMany: (codes: string[]) => void
  ensureSetActive: (code: string) => void
  cards: Card[]; allCards: Card[]; cardsByOracle: Map<string, Card>; cardByKey: Map<string, Card>
  contexts: Context[]; schemes: Scheme[]; firstCtx: Context | undefined; firstScheme: Scheme | undefined
  ratingOf: (c: Card, ctx: string) => Rating | undefined; badgesFor: (c: Card) => BadgeInfo[]; schemeOf: (ctxId: string) => Scheme | undefined
  ratings: Map<string, Map<string, Rating>>
  edges: Edge[]; allTagRows: CardTag[]; allTags: string[]; linkedIds: Set<string>; tagsByCard: Map<string, Set<string>>
  imageOf: (c: Card, size?: ImgSize) => string; artMode: ArtMode; artPrefs: Map<string, ArtPref>; setArtPref: (c: Card, id: string | null) => void
  tierOptions: { v: string; label: string }[]
  queryDeps: Omit<QueryDeps, 'globalResults' | 'searchIds' | 'searchState'>
  // community (flagged)
  showCommunity: boolean; setShowCommunity: (v: boolean) => void; percentiles: Map<string, number>; communityRows: Map<string, CommunitySnapshot['rows'][number]>; communitySnaps: CommunitySnapshot[]; pullCommunity: () => void
  // panel prefs
  sections: SectionId[]; reorderSection: (id: SectionId, toIndex: number) => void; collapsed: Set<string>; toggleCollapse: (id: string) => void
  sectionHeights: Record<string, number>; setSectionHeight: (id: string, px: number | null) => void
  ratedCount: number; showBasics: boolean
  // language layer (大學院廢墟)
  lang: Lang; setLang: (l: Lang) => void; cardLang: Lang; setCardLang: (l: Lang) => void
  zhOf: (c: Card) => ZhCard | undefined; zhRowOf: (c: Card) => ZhCard | undefined
  nameOf: (c: Card) => string; typeOf: (c: Card) => string; oracleOf: (c: Card) => string; zhImageOf: (c: Card) => string | undefined
  // Oracle panel prefs (v0.10)
  oracleMode: OracleMode; setOracleMode: (m: OracleMode) => void
  oracleLang: OracleLang; setOracleLang: (l: OracleLang) => void
  // experiments
  taggerOn: boolean
  // counterpart pairs
  partnerOf: Map<string, string>; hasPairs: boolean; pairMode: boolean
  pairSetting: 'auto' | 'off' | undefined; setPairSetting: (v: 'auto' | 'off') => void
  // dock focus + per-scope handles (refs, so registering never re-renders anyone)
  activeScopeId: string; setActiveScope: (id: string) => void
  activeCardPanelId: string | null; setActiveCardPanel: (id: string | null) => void
  registerNav: (scopeId: string, h: NavHandle) => void; navOf: (scopeId: string) => NavHandle | undefined
}

const Ctx = createContext<Grader | null>(null)
export const useGrader = () => { const g = useContext(Ctx); if (!g) throw new Error('useGrader outside provider'); return g }

export function GraderProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('')
  const [activeSets, setActiveSets] = useState<string[]>([])
  const [busySet, setBusySet] = useState<string | null>(null)
  const [showCommunity, setShowCommunity] = useState(false)
  const [artMode] = useState<ArtMode>('regular')
  const [sections, setSections] = useState<SectionId[]>([...PANEL_SECTIONS])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [sectionHeights, setSectionHeights] = useState<Record<string, number>>({})
  const [lang, setLangState] = useState<Lang>('en')          // UI strings
  const [cardLang, setCardLangState] = useState<Lang>('en')  // card names / text / scans (大學院廢墟 when 中文)
  const [oracleMode, setOracleModeState] = useState<OracleMode>('shared')
  const [oracleLang, setOracleLangState] = useState<OracleLang>('follow')
  const [activeScopeId, setActiveScope] = useState('main')
  const [activeCardPanelId, setActiveCardPanel] = useState<string | null>(null)
  const navs = useRef(new Map<string, NavHandle>())

  useEffect(() => {
    (async () => {
      await ensureDefaults()
      const legacy = await getSetting('activeSet', '')
      setActiveSets(await getSetting<string[]>('activeSets', legacy ? [legacy] : []))
      setShowCommunity(await getSetting('showCommunity', false))
      const saved = await getSetting<SectionId[]>('panelSections', [...PANEL_SECTIONS])
      setSections([...saved.filter(s => PANEL_SECTIONS.includes(s)), ...PANEL_SECTIONS.filter(s => !saved.includes(s))])
      setCollapsed(new Set(await getSetting<string[]>('collapsed', [])))
      setSectionHeights(await getSetting<Record<string, number>>('cardSectionHeights', {}))
      const l = await getSetting<Lang>('lang', 'en'); setI18n(l); setLangState(l)
      setCardLangState(await getSetting<Lang>('cardLang', 'en'))
      setOracleModeState(await getSetting<OracleMode>('oracleMode', 'shared'))
      setOracleLangState(await getSetting<OracleLang>('oracleLang', 'follow'))
      setReady(true)
    })()
  }, [])
  useEffect(() => { if (ready) void setSetting('activeSets', activeSets) }, [activeSets, ready])
  useEffect(() => { if (ready) void setSetting('showCommunity', showCommunity) }, [showCommunity, ready])
  useEffect(() => { if (ready) void setSetting('panelSections', sections) }, [sections, ready])
  useEffect(() => { if (ready) void setSetting('collapsed', [...collapsed]) }, [collapsed, ready])
  useEffect(() => { if (ready) void setSetting('cardSectionHeights', sectionHeights) }, [sectionHeights, ready])
  useEffect(() => { if (ready) void setSetting('lang', lang) }, [lang, ready])
  useEffect(() => { if (ready) void setSetting('cardLang', cardLang) }, [cardLang, ready])
  useEffect(() => { if (ready) void setSetting('oracleMode', oracleMode) }, [oracleMode, ready])
  useEffect(() => { if (ready) void setSetting('oracleLang', oracleLang) }, [oracleLang, ready])

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
  // Chinese layer: rows for the active sets; pulled lazily the first time a set is viewed in 中文.
  // oracleLang can pin the Oracle panel to 中文 while the rest of the UI is English — then we still need the rows.
  const wantZh = cardLang === 'zh' || oracleLang === 'zh'
  const zhRows = useLiveQuery(() => wantZh && activeSets.length ? db.zh.where('set').anyOf(activeSets).toArray() : Promise.resolve([] as ZhCard[]), [setsKey, wantZh]) ?? []
  const zhById = useMemo(() => new Map(zhRows.map(z => [z.id, z])), [zhRows])
  const zhSetsLoaded = useMemo(() => new Set(zhRows.map(z => z.set)), [zhRows])
  useEffect(() => {
    if (!wantZh) return
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
  }, [wantZh, setsKey, localSets.length])
  // zhRowOf = unconditional lookup (the Oracle panel may want 中文 while cardLang is en); zhOf keeps the old semantics.
  const zhRowOf = useCallback((c: Card) => zhById.get(c.id) ?? c.printings?.map(p => zhById.get(p.id)).find(Boolean), [zhById])
  const zhOf = useCallback((c: Card) => cardLang === 'zh' ? zhRowOf(c) : undefined, [cardLang, zhRowOf])
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
  const cardByKey = useMemo(() => new Map(allCards.map(c => [rk(c.set, c.oracleId), c])), [allCards])
  const linkedIds = useMemo(() => { const s = new Set<string>(); edges.forEach(e => { s.add(e.a); s.add(e.b) }); return s }, [edges])
  const tagsByCard = useMemo(() => { const m = new Map<string, Set<string>>(); allTagRows.forEach(x => { if (!m.has(x.oracleId)) m.set(x.oracleId, new Set()); m.get(x.oracleId)!.add(x.tag) }); return m }, [allTagRows])
  const allTags = useMemo(() => [...new Set(allTagRows.map(x => x.tag))].sort(), [allTagRows])
  const communityRows = useMemo(() => new Map(communitySnaps.flatMap(s => s.rows).map(r => [r.name, r])), [communitySnaps])
  const percentiles = useMemo(() => { const m = new Map<string, number>(); for (const s of communitySnaps) gihPercentiles(s.rows).forEach((v, k) => m.set(k, v)); return m }, [communitySnaps])
  const firstCtx = contexts[0]
  const firstScheme = firstCtx ? schemeOf(firstCtx.id) : undefined

  const imageOf = useCallback((c: Card, size: ImgSize = 'small') => {
    const pref = artPrefs.get(`${c.set}:${c.oracleId}`)
    if (!pref) { const zh = zhImageOf(c); if (zh) return atSize(zh, size) }   // 中文 scan unless the user pinned an art
    const p = pickPrinting(c, artMode, pref)
    if (size === 'small') return p.imageSmall || p.imageNormal
    const normal = p.imageNormal || p.imageSmall
    return size === 'large' ? atSize(normal, 'large') : normal
  }, [artMode, artPrefs, zhImageOf])
  const setArtPref = useCallback(async (c: Card, printingId: string | null) => {
    const key = `${c.set}:${c.oracleId}`
    if (printingId) await db.artPrefs.put({ key, set: c.set, oracleId: c.oracleId, printingId }); else await db.artPrefs.delete(key)
  }, [])

  const visibleCards = useMemo(() => showBasics ? cards : cards.filter(c => !isBasicLand(c)), [cards, showBasics])
  const ratedCount = useMemo(() => visibleCards.filter(c => contexts.some(x => ratingOf(c, x.id)?.tier)).length, [visibleCards, contexts, ratingOf])
  // counterpart pairs (edges tagged #counterpart, e.g. FRA echoverse)
  const partnerOf = useMemo(() => { const m = new Map<string, string>(); for (const e of edges) if (e.tags.includes('counterpart')) { m.set(e.a, e.b); m.set(e.b, e.a) } return m }, [edges])
  const hasPairs = useMemo(() => cards.some(c => partnerOf.has(c.oracleId)), [cards, partnerOf])

  const reorderSection = useCallback((id: SectionId, toIndex: number) => setSections(ss => {
    const from = ss.indexOf(id); if (from < 0 || toIndex < 0 || toIndex >= ss.length || from === toIndex) return ss
    const next = [...ss]; next.splice(from, 1); next.splice(toIndex, 0, id); return next
  }), [])
  const setSectionHeight = useCallback((id: string, px: number | null) => setSectionHeights(h => {
    if (px === null) { const { [id]: _drop, ...rest } = h; return rest }
    return h[id] === px ? h : { ...h, [id]: px }
  }), [])
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
  const ensureSetActive = useCallback((code: string) => setActiveSets(s => (s.includes(code) ? s : [...s, code])), [])

  const tierOptions = useMemo(() => contexts.flatMap(ctx => (schemeOf(ctx.id)?.tiers ?? []).map(x => ({ v: `${ctx.id}${TIER_SEP}${x.name}`, label: contexts.length > 1 ? `${ctx.name}: ${x.name}` : x.name }))), [contexts, schemeOf])

  const queryDeps = useMemo(() => ({
    cards, showBasics, zhById, contexts, ratingOf, schemeOf, tagsByCard, percentiles, partnerOf,
  }), [cards, showBasics, zhById, contexts, ratingOf, schemeOf, tagsByCard, percentiles, partnerOf])

  const registerNav = useCallback((scopeId: string, h: NavHandle) => { navs.current.set(scopeId, h) }, [])
  const navOf = useCallback((scopeId: string) => navs.current.get(scopeId), [])

  const value: Grader = {
    ready, status, setStatus, activeSets, localSets, busySet, toggleSet, pullSet, pullMany, ensureSetActive,
    cards: visibleCards, allCards, cardsByOracle, cardByKey,
    contexts, schemes, firstCtx, firstScheme, ratingOf, badgesFor, schemeOf, ratings,
    edges, allTagRows, allTags, linkedIds, tagsByCard, imageOf, artMode, artPrefs, setArtPref, tierOptions, queryDeps,
    showCommunity, setShowCommunity, percentiles, communityRows, communitySnaps, pullCommunity,
    sections, reorderSection, collapsed, toggleCollapse, sectionHeights, setSectionHeight, ratedCount, showBasics,
    lang, setLang: (l: Lang) => { setI18n(l); setLangState(l) }, cardLang, setCardLang: setCardLangState,
    zhOf, zhRowOf, nameOf, typeOf, oracleOf, zhImageOf,
    oracleMode, setOracleMode: setOracleModeState, oracleLang, setOracleLang: setOracleLangState,
    taggerOn, partnerOf, hasPairs, pairMode,
    pairSetting, setPairSetting: v => { void setSetting('echoversePairs', v) },
    activeScopeId, setActiveScope, activeCardPanelId, setActiveCardPanel, registerNav, navOf,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
