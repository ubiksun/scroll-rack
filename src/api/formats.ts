// Which sets sit in which constructed format, for the Sets menu dividers.
// Standard is looked up live (Scryfall `f:standard r:mythic -is:reprint` → set codes of first printings; every Standard
// set has new mythics; basics don't help because they're legal everywhere, and reprints would drag in old sets). Pioneer / Modern are date-based: RTR 2012-10-05, 8ED 2003-07-28.
const API = 'https://api.scryfall.com'
const KEY = 'lg.standardSets.v3'
const FALLBACK_STANDARD_FROM = '2023-09-08'   // WOE — Standard after the 2026 rotation (Scryfall-confirmed 2026-09-20)

export type Tier = 'standard' | 'pioneer' | 'modern' | 'other'

export async function standardSets(): Promise<Set<string> | null> {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { at: number; sets: string[] } | null
    if (cached && Date.now() - cached.at < 24 * 3600e3) return new Set(cached.sets)
    // count per set; a handful of old sets leak in via cards whose FDN printing is flagged as the reprint (m13, war…),
    // so a set needs ≥5 new mythics to count as a Standard set
    const count = new Map<string, number>()
    let url: string | null = `${API}/cards/search?q=${encodeURIComponent('f:standard r:mythic -is:reprint')}&unique=prints`
    while (url) {
      const res: Response = await fetch(url); if (!res.ok) break
      const page = await res.json()
      for (const c of page.data as { set: string; set_type: string }[]) if (c.set_type === 'expansion' || c.set_type === 'core') count.set(c.set, (count.get(c.set) ?? 0) + 1)
      url = page.has_more ? page.next_page : null
      if (url) await new Promise(r => setTimeout(r, 120))
    }
    const sets = new Set([...count].filter(([, n]) => n >= 5).map(([k]) => k))
    if (sets.size) localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), sets: [...sets] }))
    return sets.size ? sets : null
  } catch { return null }
}

export const TIER_ORDER: Tier[] = ['standard', 'pioneer', 'modern', 'other']
export function tierOf(s: { code: string; released_at: string; set_type: string; name: string }, standard: Set<string> | null, today = new Date().toISOString().slice(0, 10)): Tier {
  const mainline = s.set_type === 'expansion' || s.set_type === 'core'
  const horizons = s.set_type === 'draft_innovation' && /Horizons/.test(s.name)
  // unreleased mainline sets are upcoming Standard
  if (mainline && s.released_at > today) return 'standard'
  const inStandard = standard ? standard.has(s.code) : (s.released_at >= FALLBACK_STANDARD_FROM && mainline)
  if (inStandard) return 'standard'
  if (mainline && s.released_at >= '2012-10-05') return 'pioneer'
  if ((mainline || horizons) && s.released_at >= '2003-07-28') return 'modern'
  return 'other'
}
export const TIER_LABEL: Record<Tier, string> = { standard: 'Standard (incl. upcoming)', pioneer: 'Pioneer — rotated out of Standard', modern: 'Modern only — pre-Pioneer + Horizons', other: 'Other — Masters · supplemental · pre-Modern' }
