// untapped.gg — RESERVED SLOT. The user found a public API in another session; wire it here once we have:
//   • base URL + auth (if any), rate limits
//   • the per-set / per-card endpoint shape and which fields map to win-rate style metrics
//   • how card identity is keyed (name / arena_id / scryfall id)
// Until then the source is listed but `available: false`, so nothing in the UI tries to fetch it.
import type { CommunitySource, CommunitySnapshotG } from './index'

export const UNTAPPED_BASE = ''   // e.g. 'https://api.mtga.untapped.gg/…'

export const untappedSource: CommunitySource = {
  id: 'untapped', name: 'untapped.gg', homepage: 'https://mtga.untapped.gg', available: false,
  formats: ['Limited'],
  metrics: [
    { key: 'win_rate', label: 'Win rate', format: v => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
    { key: 'pick_rate', label: 'Pick rate', format: v => `${(v * 100).toFixed(1)}%`, higherIsBetter: true },
  ],
  primary: 'win_rate',
  async fetchSet(set: string): Promise<CommunitySnapshotG> {
    // TODO(untapped): fetch(`${UNTAPPED_BASE}/…/${set}`) → map rows. Card identity: prefer arena_id (Card.arenaId is stored).
    throw new Error('untapped.gg source not configured yet')
  },
}
