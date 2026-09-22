import { useEffect, useState } from 'react'
import { scryfallOracleIds, SyntaxError, searchCards } from '../api/search'
import type { Card } from '../db'
import type { SearchState } from '../query'

// Scryfall search for ONE dock. Lifted out of state.tsx in v0.10: each Browse dock runs its own debounce + abort, so
// typing in one search panel never disturbs another. The module-level cache in api/search.ts absorbs repeated queries
// across docks; aborting is kept per-dock (cancelling the request matters more than sharing an in-flight one).
export function useCardSearch(textF: string, searchScope: 'active' | 'all', activeSets: string[]) {
  const [globalResults, setGlobalResults] = useState<Card[] | null>(null)
  const [searchIds, setSearchIds] = useState<Set<string> | null>(null)
  const [searchState, setSearchState] = useState<SearchState>('idle')
  const setsKey = activeSets.join(',')

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

  return { globalResults, searchIds, searchState }
}
