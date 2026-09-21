import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, DEFAULT_BADGE_STYLE, DEFAULT_SCHEME, type BadgeStyle, type Context, type Scheme } from '../db'
import SchemeEditor from './SchemeEditor'

interface Props { contexts: Context[]; schemes: Scheme[] }
let styleQueue: Promise<void> = Promise.resolve()

// One table for everything about a rating dimension ("tag" in the user's words): show-on-card checkbox · name ·
// arrangement (expand → corner / shape / size / label, following Material Design 3 badge anchoring) · tiers · order.
export default function TagTable({ contexts, schemes }: Props) {
  const badgeCtx = useLiveQuery(() => getSetting<string[] | null>('badgeContexts', null), [])
  const styles = useLiveQuery(() => getSetting<Record<string, Partial<BadgeStyle>>>('badgeStyles', {}), []) ?? {}
  const [open, setOpen] = useState<string | null>(null)
  const [editScheme, setEditScheme] = useState<Scheme | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})

  const shown = (id: string) => badgeCtx === null || badgeCtx === undefined || badgeCtx.includes(id)
  const toggleShown = (id: string) => {
    const cur = badgeCtx ?? contexts.map(c => c.id)
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    void setSetting('badgeContexts', contexts.every(c => next.includes(c.id)) ? null : next)
  }
  const styleOf = (id: string): BadgeStyle => ({ ...DEFAULT_BADGE_STYLE, ...(styles[id] ?? {}) })
  // serialized read-modify-write so rapid successive edits don't clobber each other
  const setStyle = (id: string, patch: Partial<BadgeStyle>) => { styleQueue = styleQueue.then(async () => { const cur = await getSetting<Record<string, Partial<BadgeStyle>>>('badgeStyles', {}); await setSetting('badgeStyles', { ...cur, [id]: { ...(cur[id] ?? {}), ...patch } }) }) }
  const rename = async (c: Context) => { const n = (draft[c.id] ?? c.name).trim(); if (n && n !== c.name) await db.contexts.update(c.id, { name: n }); setDraft(d => { const { [c.id]: _x, ...rest } = d; return rest }) }
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= contexts.length) return
    const a = contexts[i], b = contexts[j]
    await db.transaction('rw', db.contexts, async () => { await db.contexts.update(a.id, { order: b.order }); await db.contexts.update(b.id, { order: a.order }) })
  }
  const add = async () => {
    const id = `ctx${Date.now().toString(36)}`
    await db.contexts.add({ id, name: 'New', schemeId: schemes[0]?.id ?? DEFAULT_SCHEME.id, order: contexts.length })
    setDraft(d => ({ ...d, [id]: '' }))
  }
  const remove = async (c: Context) => {
    if (contexts.length <= 1) return
    if (!confirm(`Remove "${c.name}"? Its ratings stay in the database and come back if you re-add a dimension with the same id.`)) return
    await db.contexts.delete(c.id)
  }
  const POS: { v: BadgeStyle['pos']; l: string }[] = [{ v: 'tl', l: '↖ top-left' }, { v: 'tr', l: '↗ top-right' }, { v: 'bl', l: '↙ bottom-left' }, { v: 'br', l: '↘ bottom-right' }]

  return (
    <>
      <table className="tagtable">
        <thead><tr><th title="show as a badge on card images">On card</th><th>Name</th><th>Arrangement</th><th>Tiers</th><th></th></tr></thead>
        <tbody>
          {contexts.map((c, i) => {
            const st = styleOf(c.id); const sc = schemes.find(s => s.id === c.schemeId)
            return (
              <FragmentRow key={c.id}>
                <tr>
                  <td><input type="checkbox" checked={shown(c.id)} onChange={() => toggleShown(c.id)} /></td>
                  <td><input type="text" value={draft[c.id] ?? c.name} onChange={e => setDraft(d => ({ ...d, [c.id]: e.target.value }))} onBlur={() => rename(c)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} /></td>
                  <td><button onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? '▾' : '▸'} {POS.find(p => p.v === st.pos)?.l} · {st.shape} · {st.size.toUpperCase()}{st.label === 'full' ? ' · labelled' : ''}</button></td>
                  <td><button onClick={() => sc && setEditScheme(sc)} title={sc?.tiers.map(t => t.name).join(' / ')}>{sc?.name ?? '—'} ({sc?.tiers.length ?? 0})</button>
                    <select value={c.schemeId} onChange={e => db.contexts.update(c.id, { schemeId: e.target.value })} title="tier scheme" style={{ marginLeft: 4 }}>{schemes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></td>
                  <td style={{ whiteSpace: 'nowrap' }}><button onClick={() => move(i, -1)} disabled={i === 0}>↑</button> <button onClick={() => move(i, 1)} disabled={i === contexts.length - 1}>↓</button> <button onClick={() => remove(c)} disabled={contexts.length <= 1} title="remove dimension">✕</button></td>
                </tr>
                {open === c.id && (
                  <tr className="detail"><td colSpan={5}>
                    <div className="row" style={{ gap: 18, flexWrap: 'wrap' }}>
                      <label>Corner <select value={st.pos} onChange={e => setStyle(c.id, { pos: e.target.value as BadgeStyle['pos'] })}>{POS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}</select></label>
                      <label>Shape <select value={st.shape} onChange={e => setStyle(c.id, { shape: e.target.value as BadgeStyle['shape'] })}><option value="pill">pill</option><option value="circle">circle</option><option value="square">square</option></select></label>
                      <label>Size <select value={st.size} onChange={e => setStyle(c.id, { size: e.target.value as BadgeStyle['size'] })}><option value="s">S</option><option value="m">M</option><option value="l">L</option></select></label>
                      <label>Label <select value={st.label} onChange={e => setStyle(c.id, { label: e.target.value as BadgeStyle['label'] })}><option value="tier">tier only (A)</option><option value="full">dimension: tier ({c.name}: A)</option></select></label>
                      <span className="sub">Badges sharing a corner stack away from it, in dimension order (Material Design 3 badge anchoring).</span>
                    </div>
                  </td></tr>
                )}
              </FragmentRow>
            )
          })}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 8 }}><button onClick={add}>+ add dimension</button></div>
      {editScheme && <SchemeEditor scheme={editScheme} onClose={() => setEditScheme(null)} />}
    </>
  )
}

function FragmentRow({ children }: { children: React.ReactNode }) { return <>{children}</> }
