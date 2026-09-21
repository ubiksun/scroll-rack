import { useState } from 'react'
import { db, type Scheme, type Tier } from '../db'
import { t as T } from '../i18n'

interface Props { scheme: Scheme; onClose: () => void }

// Tier order = array order, best first. Renaming a tier does NOT migrate existing ratings (prototype).
export default function SchemeEditor({ scheme, onClose }: Props) {
  const [name, setName] = useState(scheme.name)
  const [tiers, setTiers] = useState<Tier[]>(scheme.tiers.map(t => ({ ...t })))

  const update = (i: number, patch: Partial<Tier>) => setTiers(ts => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)))
  const move = (i: number, d: -1 | 1) => setTiers(ts => {
    const j = i + d; if (j < 0 || j >= ts.length) return ts
    const copy = [...ts]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy
  })
  const save = async () => {
    const clean = tiers.filter(t => t.name.trim()).map(t => ({ ...t, name: t.name.trim() }))
    if (!clean.length) return
    await db.schemes.put({ ...scheme, name: name.trim() || scheme.name, tiers: clean })
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>{T('schemeTitle')}</h2>
        <div className="row" style={{ marginBottom: 10 }}>
          <label>{T('name')} <input value={name} onChange={e => setName(e.target.value)} /></label>
        </div>
        {tiers.map((t, i) => (
          <div className="tier-edit" key={i}>
            <input type="text" value={t.name} onChange={e => update(i, { name: e.target.value })} />
            <input type="color" value={t.color} onChange={e => update(i, { color: e.target.value })} />
            <button onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button onClick={() => move(i, 1)} disabled={i === tiers.length - 1}>↓</button>
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
    </div>
  )
}
