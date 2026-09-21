import { db, type CommunityRow, type CommunitySnapshot } from '../db'

// Undocumented but stable public endpoint (verified 2026-08-07 and 2026-09-15). No auth.
// Empty array = set not on Arena yet / no games. Cache aggressively; one fetch per set per session is plenty.
export async function fetchCommunity(set: string, format = 'PremierDraft'): Promise<CommunitySnapshot> {
  const url = `https://www.17lands.com/card_ratings/data?expansion=${set.toUpperCase()}&format=${format}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`17lands ${res.status}`)
  const rows = (await res.json()) as CommunityRow[]
  const snap: CommunitySnapshot = { key: `${set}:${format}`, set, format, fetchedAt: Date.now(), rows }
  await db.community.put(snap)
  return snap
}

// Percentile of GIH WR within the set (0–100). Only cards with enough games count.
export function gihPercentiles(rows: CommunityRow[], minGames = 200): Map<string, number> {
  const usable = rows.filter(r => r.ever_drawn_win_rate != null && r.game_count >= minGames)
  const sorted = [...usable].sort((a, b) => (a.ever_drawn_win_rate! - b.ever_drawn_win_rate!))
  const out = new Map<string, number>()
  sorted.forEach((r, i) => out.set(r.name, Math.round((i / Math.max(1, sorted.length - 1)) * 100)))
  return out
}

export const pct = (v: number | null | undefined, digits = 1) => v == null ? '—' : `${(v * 100).toFixed(digits)}%`
