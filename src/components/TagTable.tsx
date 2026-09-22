import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, DEFAULT_SCHEME, type Context, type Scheme } from '../db'
import { t } from '../i18n'

interface Props { contexts: Context[]; schemes: Scheme[]; onEditTiers: (s: Scheme) => void }

// The comment list: one row per axis you grade cards on (Limited, Constructed, …). Name · tier set · badge on/off.
// Order is drag-only — the ↑/↓ buttons are gone, here and everywhere else.
export default function TagTable({ contexts, schemes, onEditTiers }: Props) {
  const badgeCtx = useLiveQuery(() => getSetting<string[] | null>('badgeContexts', null), [])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const shown = (id: string) => badgeCtx === null || badgeCtx === undefined || badgeCtx.includes(id)
  const toggleShown = (id: string) => {
    const cur = badgeCtx ?? contexts.map(c => c.id)
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
    void setSetting('badgeContexts', contexts.every(c => next.includes(c.id)) ? null : next)
  }
  const rename = async (c: Context) => {
    const n = (draft[c.id] ?? c.name).trim()
    if (n && n !== c.name) await db.contexts.update(c.id, { name: n })
    setDraft(d => { const { [c.id]: _x, ...rest } = d; return rest })
  }
  // drop onto a row → renumber the whole list so the dragged comment lands at that position
  const reorder = async (fromId: string, toIndex: number) => {
    const sorted = [...contexts].sort((a, b) => a.order - b.order)
    const from = sorted.findIndex(c => c.id === fromId)
    if (from < 0 || from === toIndex) return
    const next = [...sorted]; next.splice(from, 1); next.splice(toIndex, 0, sorted[from])
    await db.transaction('rw', db.contexts, async () => {
      for (let i = 0; i < next.length; i++) if (next[i].order !== i) await db.contexts.update(next[i].id, { order: i })
    })
  }
  const add = async () => {
    const id = `ctx${Date.now().toString(36)}`
    await db.contexts.add({ id, name: 'New', schemeId: schemes[0]?.id ?? DEFAULT_SCHEME.id, order: contexts.length })
    setDraft(d => ({ ...d, [id]: '' }))
  }
  const remove = async (c: Context) => {
    if (contexts.length <= 1) return
    if (!confirm(`Remove "${c.name}"? Its ratings stay in the database and come back if you re-add a comment with the same id.`)) return
    await db.contexts.delete(c.id)
  }

  return (
    <>
      <div className="sub" style={{ marginBottom: 8 }}>{t('commentsHint')}</div>
      <table className="tagtable">
        <thead><tr><th title="show as a badge on card images">{t('commentOnCard')}</th><th>{t('commentName')}</th><th>{t('commentTiers')}</th><th></th></tr></thead>
        <tbody>
          {contexts.map((c, i) => {
            const sc = schemes.find(s => s.id === c.schemeId)
            return (
              <tr key={c.id} draggable
                className={`draggable${dragId === c.id ? ' dragging' : ''}${dragId && overId === c.id && dragId !== c.id
                  ? (contexts.findIndex(x => x.id === dragId) < i ? ' drop-after' : ' drop-before') : ''}`}
                onDragStart={e => { setDragId(c.id); e.dataTransfer.setData('text/comment', c.id); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => { setDragId(null); setOverId(null) }}
                onDragOver={e => { e.preventDefault(); if (overId !== c.id) setOverId(c.id) }}
                onDragLeave={() => setOverId(cur => (cur === c.id ? null : cur))}
                onDrop={e => { e.preventDefault(); setOverId(null); setDragId(null); const from = e.dataTransfer.getData('text/comment'); if (from) void reorder(from, i) }}>
                <td><input type="checkbox" checked={shown(c.id)} onChange={() => toggleShown(c.id)} /></td>
                <td><input type="text" value={draft[c.id] ?? c.name} onChange={e => setDraft(d => ({ ...d, [c.id]: e.target.value }))}
                  onBlur={() => rename(c)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} /></td>
                <td>
                  <select value={c.schemeId} onChange={e => db.contexts.update(c.id, { schemeId: e.target.value })} title="tier set">
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.name} ({s.tiers.length})</option>)}
                  </select>
                  {sc && <button className="linkish" onClick={() => onEditTiers(sc)} title={sc.tiers.map(x => x.name).join(' / ')}>{t('commentEditTiers')}</button>}
                </td>
                <td><button onClick={() => remove(c)} disabled={contexts.length <= 1} title={t('removeComment')}>✕</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 8 }}><button onClick={add}>{t('addComment')}</button></div>
    </>
  )
}
