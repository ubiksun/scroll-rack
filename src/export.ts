import { db, type Card, type Context, type Rating, type Scheme } from './db'
import { exportBundle } from './db'

function download(name: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
}
const today = () => new Date().toISOString().slice(0, 10)
const csvCell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export async function exportJson() {
  download(`scroll-rack_${today()}.json`, JSON.stringify(await exportBundle(), null, 2), 'application/json')
}

export async function exportCsv(set: string, context: Context, community: Map<string, { gih: number | null; pct: number | undefined }>) {
  const cards = await db.cards.where('set').equals(set).sortBy('collectorNumber')
  const ratings = new Map((await db.ratings.where('[set+context]').equals([set, context.id]).toArray()).map(r => [r.oracleId, r]))
  const tags = await db.cardTags.toArray()
  const tagsBy = new Map<string, string[]>(); tags.forEach(t => tagsBy.set(t.oracleId, [...(tagsBy.get(t.oracleId) ?? []), t.tag]))
  const head = ['name', 'set', 'collector', 'rarity', 'colors', 'cmc', 'type', `tier_${context.id}`, 'note', 'tags', 'gih_wr', 'gih_percentile']
  const rows = cards.map(c => {
    const r = ratings.get(c.oracleId); const cm = community.get(c.name)
    return [c.name, c.set, c.collectorNumber, c.rarity, c.colors.join(''), c.cmc, c.typeLine, r?.tier ?? '', r?.note ?? '', (tagsBy.get(c.oracleId) ?? []).join(' '), cm?.gih == null ? '' : (cm.gih * 100).toFixed(1), cm?.pct ?? ''].map(csvCell).join(',')
  })
  download(`${set.toUpperCase()}_${context.id}_${today()}.csv`, [head.join(','), ...rows].join('\n'), 'text/csv')
}

// One note per card; tiers for every context; tags as #tags; edges as [[Card Name]] wikilinks → drop into a vault, get a graph.
export async function exportMarkdown(set: string, contexts: Context[], schemes: Scheme[]) {
  const cards = await db.cards.where('set').equals(set).sortBy('collectorNumber')
  const ratings = await db.ratings.where('set').equals(set).toArray()
  const byCard = new Map<string, Rating[]>(); ratings.forEach(r => byCard.set(r.oracleId, [...(byCard.get(r.oracleId) ?? []), r]))
  const tags = await db.cardTags.toArray()
  const tagsBy = new Map<string, string[]>(); tags.forEach(t => tagsBy.set(t.oracleId, [...(tagsBy.get(t.oracleId) ?? []), t.tag]))
  const edges = await db.edges.toArray()
  const names = new Map((await db.cards.toArray()).map(c => [c.oracleId, c.name]))
  const setMeta = await db.sets.get(set)
  const out: string[] = [`# ${setMeta?.name ?? set.toUpperCase()} — card notes`, '', `exported ${today()}`, '']
  for (const c of cards) {
    out.push(`## ${c.name}`, '')
    out.push(`- set: ${c.set.toUpperCase()} #${c.collectorNumber} · ${c.rarity} · ${c.manaCost} · ${c.typeLine}`)
    for (const r of byCard.get(c.oracleId) ?? []) {
      if (!r.tier && !r.note) continue
      const ctx = contexts.find(x => x.id === r.context)
      out.push(`- ${ctx?.name ?? r.context}: **${r.tier ?? '—'}**${r.note ? ` — ${r.note.replace(/\n+/g, ' ')}` : ''}`)
    }
    const tg = tagsBy.get(c.oracleId); if (tg?.length) out.push(`- tags: ${tg.map(t => `#${t}`).join(' ')}`)
    const es = edges.filter(e => e.a === c.oracleId || e.b === c.oracleId)
    if (es.length) out.push(`- links: ${es.map(e => { const o = e.a === c.oracleId ? e.b : e.a; const meta = [e.tags.map(t => `#${t}`).join(' '), e.note].filter(Boolean).join(': '); return `[[${names.get(o) ?? o}]]${meta ? ` (${meta})` : ''}` }).join(', ')}`)
    out.push('')
  }
  void schemes
  download(`${set.toUpperCase()}_notes_${today()}.md`, out.join('\n'), 'text/markdown')
}

// Plain "1 Card Name" lines — paste into Moxfield / Arena / MTGO.
export function exportDecklist(cards: Card[], label: string) {
  download(`${label}_${today()}.txt`, cards.map(c => `1 ${c.name}`).join('\n'))
}

export async function exportGraph() {
  const edges = await db.edges.toArray()
  const ids = new Set<string>(); edges.forEach(e => { ids.add(e.a); ids.add(e.b) })
  const cards = await db.cards.toArray()
  const byOracle = new Map(cards.map(c => [c.oracleId, c]))
  const tags = await db.cardTags.toArray()
  const nodes = [...ids].map(id => ({ id, name: byOracle.get(id)?.name ?? id, tags: tags.filter(t => t.oracleId === id).map(t => t.tag) }))
  download(`graph_${today()}.json`, JSON.stringify({ nodes, edges: edges.map(e => ({ source: e.a, target: e.b, tags: e.tags, kind: e.source, note: e.note })) }, null, 2), 'application/json')
}
