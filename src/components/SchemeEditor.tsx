import { useEffect, useState } from 'react'
import { db, type Scheme, type Tier } from '../db'
import { t as T } from '../i18n'

interface Props { scheme: Scheme; onClose: () => void }

// Tier order = array order, best first; drag a row to reorder. Renaming a tier does NOT migrate ratings already
// recorded under the old name. Saves as you go so the badge preview next door updates live.
export default function SchemeEditor({ scheme, onClose }: Props) {
  const [name, setName] = useState(scheme.name)
  const [tiers, setTiers] = useState<Tier[]>(scheme.tiers.map(x => ({ ...x })))
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  useEffect(() => { setName(scheme.name); setTiers(scheme.tiers.map(x => ({ ...x }))) }, [scheme.id])

  const update = (i: number, patch: Partial<Tier>) => setTiers(ts => ts.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const drop = (to: number) => setTiers(ts => {
    if (dragIdx === null || dragIdx === to) return ts
    const next = [...ts]; const [moved] = next.splice(dragIdx, 1); next.splice(to, 0, moved); return next
  })
  const save = async () => {
    const clean = tiers.filter(x => x.name.trim()).map(x => ({ ...x, name: x.name.trim() }))
    if (!clean.length) return
    await db.schemes.put({ ...scheme, name: name.trim() || scheme.name, tiers: clean })
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
          <span className="grip" title="drag to reorder">⠿</span>
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
