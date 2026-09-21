// 大學院廢墟 (mtgch.com) — documented public API (https://mtgch.com/api/v1/docs), CORS open.
// One request per set: GET /api/v1/set/{set}/cards/?unique=cards&priority_chinese=true → Chinese name / type line /
// oracle text (HTML with mana-symbol markup) / Chinese card image (images.mtgch.com/zhs/… when the community has
// uploaded one, else Scryfall's English scan). Keyed by Scryfall printing id, so it joins our cards table directly.
import { db, type ZhCard } from '../db'

const API = 'https://mtgch.com/api/v1'

interface Item {
  id: string; oracle_id: string; set: string; collector_number: string
  display_name: string; display_name_zh: string | null; display_type_line: string | null
  oracle_text_html: string | null; flavor_text_html: string | null; image_url: string | null
  is_double_faced: boolean; other_faces?: Item[] | null
}

// "<p>飞行，践踏</p><p><i class="ms ms-3 ms-cost"><i class="sr-only">{3}</i></i>，…</p>" → "飞行，践踏\n{3}，…"
export function htmlToText(html: string | null | undefined): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('i.ms').forEach(i => { const sr = i.querySelector('.sr-only'); i.replaceWith(doc.createTextNode(sr?.textContent ?? '')) })
  return [...doc.body.querySelectorAll('p')].map(p => p.textContent?.trim() ?? '').filter(Boolean).join('\n') || (doc.body.textContent ?? '').trim()
}

export async function fetchZhSet(set: string): Promise<number> {
  const res = await fetch(`${API}/set/${set}/cards/?unique=cards&priority_chinese=true`, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`mtgch ${res.status}`)
  const json = await res.json()
  const items = (json.items ?? []) as Item[]
  const now = Date.now()
  const rows: ZhCard[] = items.map(it => ({
    id: it.id, set: it.set.toLowerCase(), oracleId: it.oracle_id, collectorNumber: it.collector_number,
    name: it.display_name_zh ?? '', typeLine: it.display_type_line ?? '',
    text: htmlToText(it.oracle_text_html), flavor: htmlToText(it.flavor_text_html),
    image: it.image_url && it.image_url.includes('/zhs/') ? it.image_url : '',
    backText: it.other_faces?.[0] ? htmlToText(it.other_faces[0].oracle_text_html) : '',
    backName: it.other_faces?.[0]?.display_name_zh ?? '',
    fetchedAt: now,
  }))
  await db.transaction('rw', db.zh, async () => { await db.zh.where('set').equals(set.toLowerCase()).delete(); await db.zh.bulkPut(rows) })
  return rows.length
}
