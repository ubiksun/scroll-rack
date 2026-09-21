import type { CommunitySource, CommunitySnapshotG } from './index'
import { fetchCommunity } from '../seventeen'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
export const seventeenLandsSource: CommunitySource = {
  id: '17lands', name: '17lands', homepage: 'https://www.17lands.com', available: true,
  formats: ['PremierDraft', 'TradDraft', 'QuickDraft', 'Sealed'],
  metrics: [
    { key: 'gih_wr', label: 'GIH WR', format: pct, higherIsBetter: true },
    { key: 'oh_wr', label: 'OH WR', format: pct, higherIsBetter: true },
    { key: 'iwd', label: 'IWD', format: v => `${(v * 100).toFixed(1)}pp`, higherIsBetter: true },
    { key: 'alsa', label: 'ALSA', format: v => v.toFixed(2), higherIsBetter: false },
    { key: 'ata', label: 'ATA', format: v => v.toFixed(2), higherIsBetter: false },
  ],
  primary: 'gih_wr',
  async fetchSet(set, format = 'PremierDraft'): Promise<CommunitySnapshotG> {
    const s = await fetchCommunity(set, format)
    return { source: '17lands', set, format, fetchedAt: s.fetchedAt, rows: s.rows.map(r => ({ name: r.name, games: r.game_count, metrics: { gih_wr: r.ever_drawn_win_rate, oh_wr: r.opening_hand_win_rate, iwd: r.drawn_improvement_win_rate, alsa: r.avg_seen, ata: r.avg_pick } })) }
  },
}
