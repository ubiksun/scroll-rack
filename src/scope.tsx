import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DockviewApi, DockviewPanelApi } from 'dockview-react'
import type { Card } from './db'
import { buildNavList, hydrate, runQuery, serialize, type ScopeQuery, type SearchState, type View } from './query'
import { asBrowse, openCard, type BrowseParams, type OpenMode } from './docks'
import { useCardSearch } from './hooks/useCardSearch'
import { useGrader } from './state'

// One Browse dock's private world: its query, its search, its results, its selection. The cards themselves stay in the
// shared workspace store (useGrader) — only the QUESTION is per-dock. Because this state is local to the panel's own
// subtree, typing in one search dock re-renders nothing in another.
export interface Scope {
  scopeId: string
  panelId: string
  q: ScopeQuery
  patch: (p: Partial<ScopeQuery>) => void
  filtered: Card[]
  navList: Card[]
  selIndex: number
  showPair: boolean
  selected: Card | null
  setSelected: (c: Card | null, o?: { open?: OpenMode }) => void
  goPrev: () => void
  goNext: () => void
  searchState: SearchState
}

const Ctx = createContext<Scope | null>(null)
export const useScope = () => { const s = useContext(Ctx); if (!s) throw new Error('useScope outside a Browse dock'); return s }

const sameParams = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function ScopeProvider({ api, containerApi, params, children }: {
  api: DockviewPanelApi
  containerApi: DockviewApi
  params: BrowseParams
  children: ReactNode
}) {
  const g = useGrader()
  const scopeId = params.scopeId
  // params are the durable SNAPSHOT; this state is the live value. Read once on mount (a ref guards against the
  // updateParameters round-trip feeding our own writes back in as "new" props).
  const seeded = useRef(false)
  const [q, setQ] = useState<ScopeQuery>(() => hydrate(params.q))
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

  // restore the dock's remembered card once the card table has loaded
  useEffect(() => {
    if (seeded.current || !params.sel) { seeded.current = true; return }
    const c = g.cardByKey.get(`${params.sel.set}:${params.sel.oracleId}`)
    if (c) { setSel(c); seeded.current = true }
  }, [g.cardByKey])

  const showPair = !!sel && !!g.partnerOf.get(sel.oracleId) && (g.pairMode || pairOnce === sel.oracleId || pairOnce === g.partnerOf.get(sel.oracleId))

  const patch = useCallback((p: Partial<ScopeQuery>) => setQ(prev => ({ ...prev, ...p })), [])

  const setSelected = useCallback((c: Card | null, o?: { open?: OpenMode }) => {
    setSel(c)
    if (!c || !o?.open) return
    const id = openCard(containerApi, c, { mode: o.open, scopeId, title: g.nameOf(c), oracleMode: g.oracleMode })
    // coherence: "the card I'm rating" always follows the last dock a click or arrow key actually drove
    if (id) g.setActiveCardPanel(id)
  }, [containerApi, scopeId, g.nameOf, g.oracleMode, g.setActiveCardPanel])

  const goPrev = useCallback(() => { const i = selIndex < 0 ? 0 : selIndex - 1; if (i >= 0 && i < navList.length) setSelected(navList[i], { open: 'primary' }) }, [selIndex, navList, setSelected])
  const goNext = useCallback(() => { const i = selIndex < 0 ? 0 : selIndex + 1; if (i >= 0 && i < navList.length) setSelected(navList[i], { open: 'primary' }) }, [selIndex, navList, setSelected])

  // Card view always shows something from the current filter: if the selection fell out of it, jump to the first entry
  useEffect(() => { if (q.view === 'single' && navList.length && selIndex < 0) setSel(navList[0]) }, [q.view, navList, selIndex])

  // mirror the live value back into params (debounced) so `dockLayout` restores this dock exactly as it is.
  // The deep-equality guard is mandatory: updateParameters → onDidParametersChange → re-render → effect would loop.
  const mirror = useCallback(() => {
    // updateParameters REPLACES, so carry forward anything this component does not own (pinned, title, …)
    const next = { ...api.getParameters(), kind: 'browse', scopeId, q: serialize(q), sel: sel ? { set: sel.set, oracleId: sel.oracleId } : null } as unknown as BrowseParams
    if (!sameParams(asBrowse(next as unknown as Record<string, unknown>), asBrowse(api.getParameters()))) {
      api.updateParameters(next as unknown as Record<string, unknown>)
    }
  }, [api, scopeId, q, sel])
  useEffect(() => {
    const h = window.setTimeout(mirror, 400)
    return () => { window.clearTimeout(h); mirror() }   // flush on unmount too — docked tabs unmount when hidden
  }, [mirror])


  // publish a handle for the shell's keyboard handler and the export menu (a ref map — never re-renders anyone)
  const value: Scope = {
    scopeId, panelId: api.id, q, patch, filtered, navList, selIndex, showPair, selected: sel, setSelected, goPrev, goNext, searchState,
  }
  g.registerNav(scopeId, { goPrev, goNext, setView: v => patch({ view: v }), showPairOnce: setPairOnce, view: q.view, selected: sel, filtered, tierF: q.tierF })

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export type { View }
