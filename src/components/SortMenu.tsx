import { useEffect, useRef, useState } from 'react'
import { useGrader, type SortKey, type SortRule } from '../state'
import { FEATURES } from '../features'

// Notion-style sort: an ordered list of rules, each with a key and direction. First rule wins, ties fall through.
export default function SortMenu() {
  const g = useGrader()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', down); return () => document.removeEventListener('mousedown', down)
  }, [open])

  const keys: { key: SortKey; label: string }[] = [
    { key: 'number', label: 'Collector number' }, { key: 'name', label: 'Name' }, { key: 'cmc', label: 'Mana value' },
    { key: 'color', label: 'Color (WUBRG · colorless · multi)' }, { key: 'rarity', label: 'Rarity' },
    ...g.contexts.map(c => ({ key: `tier:${c.id}` as SortKey, label: `My tier · ${c.name}` })),
    ...(g.hasPairs ? [{ key: 'pair' as SortKey, label: 'Echoverse pair' }] : []),
    ...(FEATURES.community ? [{ key: 'community' as SortKey, label: '17lands GIH WR' }] : []),
  ]
  const label = (k: SortKey) => keys.find(x => x.key === k)?.label ?? k
  const update = (i: number, patch: Partial<SortRule>) => g.setSorts(g.sorts.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => g.setSorts(g.sorts.filter((_, j) => j !== i))
  const add = () => { const used = new Set(g.sorts.map(r => r.key)); const next = keys.find(k => !used.has(k.key)); if (next) g.setSorts([...g.sorts, { key: next.key, dir: 'asc' }]) }
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= g.sorts.length) return; const c = [...g.sorts]; [c[i], c[j]] = [c[j], c[i]]; g.setSorts(c) }
  const summary = g.sorts.length ? g.sorts.map(r => `${label(r.key)} ${r.dir === 'asc' ? '↑' : '↓'}`).join(' › ') : 'Collector number ↑'

  return (
    <span className="menu-wrap" ref={wrap}>
      <button className={g.sorts.length > 1 || (g.sorts[0] && g.sorts[0].key !== 'number') ? 'active' : ''} onClick={() => setOpen(v => !v)} title={summary}>⇅ Sort{g.sorts.length > 1 ? ` (${g.sorts.length})` : ''}</button>
      {open && (
        <div className="menu sortmenu">
          {g.sorts.map((r, i) => (
            <div className="sortrow" key={i}>
              <span className="sub">{i === 0 ? 'sort by' : 'then by'}</span>
              <select value={r.key} onChange={e => update(i, { key: e.target.value as SortKey })}>{keys.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
              <button onClick={() => update(i, { dir: r.dir === 'asc' ? 'desc' : 'asc' })} title="direction">{r.dir === 'asc' ? '↑ asc' : '↓ desc'}</button>
              <button onClick={() => move(i, -1)} disabled={i === 0}>↑</button><button onClick={() => move(i, 1)} disabled={i === g.sorts.length - 1}>↓</button>
              <button onClick={() => remove(i)} title="remove">✕</button>
            </div>
          ))}
          <div className="row" style={{ marginTop: 6 }}>
            <button onClick={add} disabled={g.sorts.length >= keys.length}>+ add sort</button>
            <span style={{ flex: 1 }} />
            <button onClick={() => g.setSorts([{ key: 'number', dir: 'asc' }])}>reset</button>
          </div>
        </div>
      )}
    </span>
  )
}
