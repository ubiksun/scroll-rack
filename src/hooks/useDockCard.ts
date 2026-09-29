import type { DockviewPanelApi } from 'dockview-react'
import type { Card } from '../db'
import type { DockParams } from '../docks'
import { useGrader } from '../state'

// The card a FOLLOWER dock (image · comment · oracle · graph) shows: its channel's current card while linked, its own
// frozen card while not. null = nothing loaded yet.
export function useDockCard(params: DockParams): Card | null {
  const g = useGrader()
  const ref = params.linked ? g.channelCards[params.channel] : params.own
  return ref ? g.cardByKey.get(`${ref.set}:${ref.oracleId}`) ?? null : null
}

// How a follower dock shows another card (a link jumped to, a pair's other half, a graph node): while wired, it
// loads the card into its search dock — every sibling follows; while frozen, only this dock changes.
export function useShowCard(api: DockviewPanelApi, params: DockParams) {
  const g = useGrader()
  return (c: Card) => {
    const ref = { set: c.set, oracleId: c.oracleId }
    if (params.linked) g.setChannelCard(params.channel, ref)
    else api.updateParameters({ ...(api.getParameters() as Record<string, unknown>), own: ref })
  }
}
