import { useEffect, useMemo, useState } from 'react'
import type { Card, CardTag, CommunityTagsRow, Edge, Rating } from '../db'
import { fetchCommunityTags, useGrader } from '../state'

export interface CardData {
  ratings: Rating[]
  tags: CardTag[]
  edges: Edge[]
  partner: Card | undefined
}

// Per-card slices of the shared live-query data. v0.10 replaced the store's single `selected`-derived selRatings /
// selTags / selEdges with this, so N card docks can each show their own card. No extra IndexedDB queries: the live
// queries stay global and one-per-table, this is only a memoised filter over them.
export function useCardData(card: Card | null): CardData {
  const g = useGrader()
  const oracleId = card?.oracleId
  const key = card ? `${card.set}:${card.oracleId}` : ''
  const ratings = useMemo(() => key ? [...(g.ratings.get(key)?.values() ?? [])] : [], [key, g.ratings])
  const tags = useMemo(() => oracleId ? g.allTagRows.filter(x => x.oracleId === oracleId) : [], [oracleId, g.allTagRows])
  const edges = useMemo(() => oracleId ? g.edges.filter(e => e.a === oracleId || e.b === oracleId) : [], [oracleId, g.edges])
  const partner = useMemo(() => {
    const pid = oracleId ? g.partnerOf.get(oracleId) : undefined
    return pid ? g.cardsByOracle.get(pid) : undefined
  }, [oracleId, g.partnerOf, g.cardsByOracle])
  return { ratings, tags, edges, partner }
}

// Scryfall Tagger for one card. `enabled` lets the caller hold off until the section is actually open — with several
// card docks mounted that is the difference between N background requests and none.
export function useCommunityTags(card: Card | null, enabled: boolean) {
  const [row, setRow] = useState<CommunityTagsRow | null>(null)
  useEffect(() => {
    setRow(null)
    if (!card || !enabled) return
    let live = true
    void fetchCommunityTags(card.set, card.collectorNumber, card.oracleId).then(r => { if (live) setRow(r) })
    return () => { live = false }
  }, [card?.id, enabled])
  const refresh = () => { if (card && enabled) void fetchCommunityTags(card.set, card.collectorNumber, card.oracleId, true).then(setRow) }
  return { row, refresh }
}
