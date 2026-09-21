// Search = Scryfall's own engine. We send the user's query scoped to the active sets and keep only the oracle_ids that
// come back, so syntax is 100% Scryfall's (t: o: cmc: c: r: is: otag: …). Offline → caller falls back to local text match.
const API = 'https://api.scryfall.com'
const cache = new Map<string, Set<string>>()

export class SyntaxError extends Error {}
export { searchCards } from './scryfall'

export async function scryfallOracleIds(sets: string[], query: string, signal?: AbortSignal): Promise<Set<string>> {
  const scope = sets.length === 1 ? `e:${sets[0]}` : `(${sets.map(s => `e:${s}`).join(' or ')})`
  const q = `${scope} (${query})`
  const hit = cache.get(q)
  if (hit) return hit
  const ids = new Set<string>()
  let url: string | null = `${API}/cards/search?q=${encodeURIComponent(q)}&unique=prints`
  while (url) {
    const res: Response = await fetch(url, { signal })
    if (res.status === 404) break                       // Scryfall: no matches
    if (res.status === 400) throw new SyntaxError((await res.json()).details ?? 'bad query')
    if (!res.ok) throw new Error(`Scryfall ${res.status}`)
    const page = await res.json()
    for (const c of page.data as { oracle_id: string }[]) ids.add(c.oracle_id)
    url = page.has_more ? page.next_page : null
    if (url) await new Promise(r => setTimeout(r, 120))
  }
  cache.set(q, ids)
  return ids
}
