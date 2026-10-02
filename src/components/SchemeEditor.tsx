import { useEffect, useState } from 'react'
import { db, type Scheme, type Tier } from '../db'
import { t as T } from '../i18n'

interface Props { scheme: Scheme; onClose: () => void }

// Tier order = array order, best first; drag a row to reorder. Renaming a tier does NOT migrate ratings already
// recorded under the old name. Saves as you go so the badge preview next door updates live.
export default function SchemeEditor({ scheme, onClose }: Props) {
  const [name, setName] = useState(scheme.name)
  // each row remembers the name it was loaded with, so a rename can carry the ratings given under the old name
  const [tiers, setTiers] = useState<(Tier & { orig?: string })[]>(scheme.tiers.map(x => ({ ...x, orig: x.name })))
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  useEffect(() => { setName(scheme.name); setTiers(scheme.tiers.map(x => ({ ...x, orig: x.name }))) }, [scheme.id])

  const update = (i: number, patch: Partial<Tier>) => setTiers(ts => ts.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const drop = (to: number) => setTiers(ts => {
    if (dragIdx === null || dragIdx === to) return ts
    const next = [...ts]; const [moved] = next.splice(dragIdx, 1); next.splice(to, 0, moved); return next
  })
  const save = async () => {
    const rows = tiers.filter(x => x.name.trim()).map(x => ({ ...x, name: x.name.trim() }))
    if (!rows.length) return
    const clean: Tier[] = rows.map(({ name, color }) => ({ name, color }))
    // old name → new name for every renamed row; applied in ONE pass so swapping two names cannot collide
    const renames: Record<string, string> = {}
    for (const r of rows) if (r.orig && r.orig !== r.name) renames[r.orig] = r.name
    await db.transaction('rw', db.schemes, db.contexts, db.ratings, async () => {
      await db.schemes.put({ ...scheme, name: name.trim() || scheme.name, tiers: clean })
      if (!Object.keys(renames).length) return
      const ctxIds = (await db.contexts.toArray()).filter(c => c.schemeId === scheme.id).map(c => c.id)
      if (!ctxIds.length) return
      await db.ratings.where('context').anyOf(ctxIds).modify(r => { if (r.tier && renames[r.tier] !== undefined) r.tier = renames[r.tier] })
    })
    onClose()
  }

  return (
    <div className="scheme-edit">
      <div className="row" style={{ marginBottom: 10 }}>
        <label>{T('name')} <input value={name} onChange={e => setName(e.target.value)} /></label>
      </div>
      {tiers.map((x, i) => (
        <div key={i} draggable
          className={`tier-edit draggable${dragIdx === i ? ' dragging' : ''}${dragIdx !== null && overIdx === i && dragIdx !== i
            ? (dragIdx < i ? ' drop-after' : ' drop-before') : ''}`}
          onDragStart={e => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/tier', String(i)) }}
          onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
          onDragOver={e => { e.preventDefault(); if (overIdx !== i) setOverIdx(i) }}
          onDragLeave={() => setOverIdx(cur => (cur === i ? null : cur))}
          onDrop={e => { e.preventDefault(); setOverIdx(null); drop(i); setDragIdx(null) }}>
          <span className="grip" title={T('dragReorder')}>⠿</span>
          <input type="text" value={x.name} onChange={e => update(i, { name: e.target.value })} />
          <input type="color" value={x.color} onChange={e => update(i, { color: e.target.value })} />
          <button onClick={() => setTiers(ts => ts.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={() => setTiers(ts => [...ts, { name: '', color: '#888888' }])}>{T('tier')}</button>
        <span className="spacer" style={{ flex: 1 }} />
        <button onClick={onClose}>{T('cancel')}</button>
        <button className="active" onClick={save}>{T('save')}</button>
      </div>
    </div>
  )
}
