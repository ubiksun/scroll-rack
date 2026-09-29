import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DockviewApi, DockviewPanelApi } from 'dockview-react'
import type { Card } from './db'
import { buildNavList, hydrate, runQuery, serialize, type ScopeQuery, type SearchState, type View } from './query'
import { asDock, openBlock, sameRef, type DockParams } from './docks'
import { useCardSearch } from './hooks/useCardSearch'
import { useGrader } from './state'
import { t } from './i18n'

// One SEARCH dock's private world: its query, its search, its results, its SELECTION. Selection is the highlighted
// card (single click / arrows) and changes nothing else; LOADING (double-click / Enter) pushes a card into the dock's
// channel, which every linked image / comment / oracle dock then shows. The cards themselves stay in the shared
// workspace store (useGrader) — only the question and the highlight are per-dock.
export interface Scope {
  scopeId: string
  panelId: string
  channel: string
  linked: boolean
  q: ScopeQuery
  patch: (p: Partial<ScopeQuery>) => void
  draft: string                          // what is typed in the box; becomes q.textF on Enter / 🔍 (an emptied box commits at once)
  setDraft: (s: string) => void
  submit: () => void
  filtered: Card[]
  navList: Card[]
  selIndex: number
  showPair: boolean
  selected: Card | null
  select: (c: Card | null) => void                       // highlight only
  load: (c: Card, o?: { newBlock?: boolean }) => void     // into the channel (or a fresh block)
  showPairOnce: (oracleId: string) => void
  goPrev: () => void
  goNext: () => void
  searchState: SearchState
}

const Ctx = createContext<Scope | null>(null)
// The slice shared components (SortMenu) need — provided by BOTH the wired and the classic ScopeProvider.
export interface QueryScope { q: ScopeQuery; patch: (p: Partial<ScopeQuery>) => void }
export const QueryCtx = createContext<QueryScope | null>(null)
export const useQueryScope = () => { const s = useContext(QueryCtx); if (!s) throw new Error('useQueryScope outside a search dock'); return s }
export const useScope = () => { const s = useContext(Ctx); if (!s) throw new Error('useScope outside a search dock'); return s }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function ScopeProvider({ api, containerApi, params, children }: {
  api: DockviewPanelApi
  containerApi: DockviewApi
  params: DockParams
  children: ReactNode
}) {
  const g = useGrader()
  const scopeId = params.scopeId ?? 'main'
  const channel = api.id       // a search dock IS its channel
  const linked = true
  const seeded = useRef(false)
  const [q, setQ] = useState<ScopeQuery>(() => hydrate(params.q))
  const [draft, setDraftState] = useState(() => hydrate(params.q).textF)
  const [sel, setSel] = useState<Card | null>(null)
  const [pairOnce, setPairOnce] = useState<string | null>(null)

  const { globalResults, searchIds, searchState } = useCardSearch(q.textF, q.searchScope, g.activeSets)

  const filtered = useMemo(
    () => runQuery(q, { ...g.queryDeps, globalResults, searchIds, searchState }),
    [q, g.queryDeps, globalResults, searchIds, searchState],
  )
  const navList = useMemo(() => buildNavList(filtered, g.pairMode, g.partnerOf), [filtered, g.pairMode, g.partnerOf])
  const selIndex = useMemo(() => {
    if (!sel) return -1
    const i = navList.findIndex(c => c.id === sel.id); if (i >= 0 || !g.pairMode) return i
    const p = g.partnerOf.get(sel.oracleId); return p ? navList.findIndex(c => c.oracleId === p) : -1
  }, [sel, navList, g.pairMode, g.partnerOf])

  // restore the dock's remembered selection once the card table has loaded
  useEffect(() => {
    if (seeded.current || !params.sel) { seeded.current = true; return }
    const c = g.cardByKey.get(`${params.sel.set}:${params.sel.oracleId}`)
    if (c) { setSel(c); seeded.current = true }
  }, [g.cardByKey])

  const showPair = !!sel && !!g.partnerOf.get(sel.oracleId) && (g.pairMode || pairOnce === sel.oracleId || pairOnce === g.partnerOf.get(sel.oracleId))
  const patch = useCallback((p: Partial<ScopeQuery>) => setQ(prev => ({ ...prev, ...p })), [])
  const setDraft = useCallback((s: string) => { setDraftState(s); if (!s.trim()) setQ(prev => (prev.textF ? { ...prev, textF: '' } : prev)) }, [])
  const submit = useCallback(() => setQ(prev => (prev.textF === draft ? prev : { ...prev, textF: draft })), [draft])
  const select = useCallback((c: Card | null) => setSel(c), [])

  const labels = useCallback(() => ({ search: t('zoneSearch'), image: t('zoneImage'), comment: t('zoneComment'), oracle: t('zoneOracle'), graph: t('zoneGraph') }), [])
  const load = useCallback((c: Card, o?: { newBlock?: boolean }) => {
    setSel(c)
    const ref = { set: c.set, oracleId: c.oracleId }
    // a block of its own (image + comments frozen on this card) comes from the + Panel menu, never from a modifier
    if (o?.newBlock) { openBlock(containerApi, labels(), { own: ref, refId: api.id, placement: 'right' }); return }
    g.setChannelCard(channel, ref)
  }, [channel, containerApi, api, g.setChannelCard, labels])

  // arrows move the highlight; from a follower dock the shell steps AND loads (see loadStep below)
  const goPrev = useCallback(() => { const i = selIndex < 0 ? 0 : selIndex - 1; if (i >= 0 && i < navList.length) setSel(navList[i]) }, [selIndex, navList])
  const goNext = useCallback(() => { const i = selIndex < 0 ? 0 : selIndex + 1; if (i >= 0 && i < navList.length) setSel(navList[i]) }, [selIndex, navList])
  // step relative to the card the channel currently shows (what an image dock's ← → mean), then load it
  const loadStep = useCallback((delta: number) => {
    if (!navList.length) return
    const cur = g.channelCards[channel]
    const at = cur ? navList.findIndex(c => sameRef(c, cur)) : selIndex
    const i = at < 0 ? 0 : at + delta
    if (i >= 0 && i < navList.length) load(navList[i])
  }, [navList, g.channelCards, channel, selIndex, load])
  const loadSelected = useCallback(() => { if (sel) load(sel) }, [sel, load])

  // mirror the live value back into params (debounced) so `dockLayout` restores this dock exactly as it is.
  // Merge, never replace: channel / linked / pinned belong to the tab header. The equality guard is mandatory.
  const mirror = useCallback(() => {
    const cur = api.getParameters() as Record<string, unknown>
    const next = { ...cur, kind: 'search', channel, linked: true, scopeId, q: serialize(q), sel: sel ? { set: sel.set, oracleId: sel.oracleId } : null }
    const a = asDock(next), b = asDock(cur)
    if (!same([a.q, a.sel, a.channel], [b.q, b.sel, b.channel])) api.updateParameters(next)
  }, [api, scopeId, q, sel])
  useEffect(() => {
    const h = window.setTimeout(mirror, 400)
    return () => { window.clearTimeout(h); try { mirror() } catch { /* dock already closed */ } }
  }, [mirror])

  const value: Scope = {
    scopeId, panelId: api.id, channel, linked, q, patch, draft, setDraft, submit, filtered, navList, selIndex, showPair, selected: sel, select, load,
    showPairOnce: setPairOnce, goPrev, goNext, searchState,
  }
  // publish a handle for the shell's keyboard handler, the image dock's ← →, and the export menu (a ref map)
  g.registerNav(scopeId, { channel, linked, goPrev, goNext, loadStep, loadSelected, setView: v => patch({ view: v }), showPairOnce: setPairOnce, view: q.view, selected: sel, filtered, tierF: q.tierF })

  return <Ctx.Provider value={value}><QueryCtx.Provider value={value}>{children}</QueryCtx.Provider></Ctx.Provider>
}

export type { View }
