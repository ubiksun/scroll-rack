import { useEffect, useRef, useState } from 'react'
import { useGrader, type SortKey, type SortRule } from '../state'
import { useQueryScope } from '../scope'
import { FEATURES } from '../features'
import { t, tx } from '../i18n'

// Notion-style sort: an ordered list of rules, each with a key and direction. First rule wins, ties fall through.
export default function SortMenu() {
  const g = useGrader()
  const sc = useQueryScope()
  const sorts = sc.q.sorts
  const setSorts = (v: SortRule[]) => sc.patch({ sorts: v })
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', down); return () => document.removeEventListener('mousedown', down)
  }, [open])

  const keys: { key: SortKey; label: string }[] = [
    { key: 'number', label: t('sortNumber') }, { key: 'name', label: t('sortName') }, { key: 'cmc', label: t('sortCmc') },
    { key: 'color', label: t('sortColor') }, { key: 'rarity', label: t('sortRarity') },
    ...g.contexts.map(c => ({ key: `tier:${c.id}` as SortKey, label: tx('sortTier', { name: c.name }) })),
    ...(g.hasPairs ? [{ key: 'pair' as SortKey, label: t('sortPair') }] : []),
    ...(FEATURES.community ? [{ key: 'community' as SortKey, label: t('sortCommunity') }] : []),
  ]
  const label = (k: SortKey) => keys.find(x => x.key === k)?.label ?? k
  const update = (i: number, patch: Partial<SortRule>) => setSorts(sorts.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const remove = (i: number) => setSorts(sorts.filter((_, j) => j !== i))
  const add = () => { const used = new Set(sorts.map(r => r.key)); const next = keys.find(k => !used.has(k.key)); if (next) setSorts([...sorts, { key: next.key, dir: 'asc' }]) }
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= sorts.length) return; const c = [...sorts]; [c[i], c[j]] = [c[j], c[i]]; setSorts(c) }
  const summary = sorts.length ? sorts.map(r => `${label(r.key)} ${r.dir === 'asc' ? '↑' : '↓'}`).join(' › ') : `${t('sortNumber')} ↑`

  return (
    <span className="menu-wrap" ref={wrap}>
      <button className={sorts.length > 1 || (sorts[0] && sorts[0].key !== 'number') ? 'active' : ''} onClick={() => setOpen(v => !v)} title={summary}>⇅ {t('sortBtn')}{sorts.length > 1 ? ` (${sorts.length})` : ''}</button>
      {open && (
        <div className="menu sortmenu">
          {sorts.map((r, i) => (
            <div className="sortrow" key={i}>
              <span className="sub">{i === 0 ? t('sortBy') : t('thenBy')}</span>
              <select value={r.key} onChange={e => update(i, { key: e.target.value as SortKey })}>{keys.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
              <button onClick={() => update(i, { dir: r.dir === 'asc' ? 'desc' : 'asc' })} title={t('sortDir')}>{r.dir === 'asc' ? t('sortAsc') : t('sortDesc')}</button>
              <button onClick={() => move(i, -1)} disabled={i === 0}>↑</button><button onClick={() => move(i, 1)} disabled={i === sorts.length - 1}>↓</button>
              <button onClick={() => remove(i)} title={t('sortRemove')}>✕</button>
            </div>
          ))}
          <div className="row" style={{ marginTop: 6 }}>
            <button onClick={add} disabled={sorts.length >= keys.length}>{t('sortAdd')}</button>
            <span style={{ flex: 1 }} />
            <button onClick={() => setSorts([{ key: 'number', dir: 'asc' }])}>{t('sortReset')}</button>
          </div>
        </div>
      )}
    </span>
  )
}
