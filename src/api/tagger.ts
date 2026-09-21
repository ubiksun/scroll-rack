// Scryfall Tagger (tagger.scryfall.com) — community "card tags" (functional) + relationships. There is no public API:
// the site is a Rails app whose Vue front end talks to /graphql with a CSRF token from the HTML page. This works from an
// extension with host permission (cookies + token from the card page), but it is UNDOCUMENTED → experimental, opt-in,
// one request per card on demand, cached 7 days in IndexedDB. If Scryfall changes the schema this fails soft (null).
import { db, type CommunityTagsRow as CommunityTags } from '../db'
export type { CommunityTagsRow as CommunityTags } from '../db'
const TTL = 7 * 24 * 3600e3
let csrf: { token: string; at: number } | null = null

// Rails' CSRF check also compares the Origin header with the host; a chrome-extension:// origin fails it. A session-scoped
// declarativeNetRequest rule rewrites Origin/Referer for our own requests to /graphql only. Installed lazily, once.
let dnrReady: Promise<void> | null = null
function ensureDnr() {
  if (dnrReady) return dnrReady
  dnrReady = (async () => {
    if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) return
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [7001],
      addRules: [{ id: 7001, priority: 1,
        condition: { urlFilter: '||tagger.scryfall.com/graphql', initiatorDomains: [chrome.runtime.id], resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType] },
        action: { type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType, requestHeaders: [
          { header: 'Origin', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: 'https://tagger.scryfall.com' },
          { header: 'Referer', operation: 'set' as chrome.declarativeNetRequest.HeaderOperation, value: 'https://tagger.scryfall.com/' },
        ] } }],
    })
  })().catch(() => { dnrReady = null })
  return dnrReady
}

async function getCsrf(set: string, cn: string) {
  if (csrf && Date.now() - csrf.at < 30 * 60e3) return csrf.token
  const html = await (await fetch(`https://tagger.scryfall.com/card/${set}/${encodeURIComponent(cn)}`, { credentials: 'include' })).text()
  const m = html.match(/name="csrf-token" content="([^"]+)"/)
  if (!m) throw new Error('tagger: no csrf token')
  csrf = { token: m[1], at: Date.now() }
  return m[1]
}

const QUERY = `query FetchCard($set: String!, $number: String!, $back: Boolean = false) {
  card: cardBySet(set: $set, number: $number, back: $back) {
    oracleId
    taggings { tag { name slug type } }
    relationships { classifier relatedName relatedId }
  }
}`

export async function fetchCommunityTags(set: string, cn: string, oracleId: string, force = false): Promise<CommunityTags | null> {
  const cached = await db.communityTags.get(oracleId)
  if (cached && !force && Date.now() - cached.fetchedAt < TTL) return cached
  try {
    await ensureDnr()
    const token = await getCsrf(set, cn)
    const res = await fetch('https://tagger.scryfall.com/graphql', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token, Accept: 'application/json' },
      body: JSON.stringify({ operationName: 'FetchCard', variables: { set, number: cn, back: false }, query: QUERY }),
    })
    if (!res.ok) return cached ?? null
    const json = await res.json()
    const card = json?.data?.card
    if (!card) return cached ?? null
    const taggings = (card.taggings ?? []) as { tag: { name: string; slug: string; type: string } }[]
    const row: CommunityTags = {
      oracleId,
      cardTags: taggings.filter(t => t.tag.type === 'ORACLE_CARD_TAG').map(t => t.tag.name),
      artTags: taggings.filter(t => t.tag.type === 'ILLUSTRATION_TAG').map(t => t.tag.name),
      relationships: ((card.relationships ?? []) as { classifier: string; relatedName: string; relatedId: string }[]).map(r => ({ kind: r.classifier.toLowerCase().replace(/_/g, ' '), name: r.relatedName, oracleId: r.relatedId })),
      fetchedAt: Date.now(),
    }
    await db.communityTags.put(row)
    return row
  } catch { return cached ?? null }
}
