import { useEffect, useRef, useState } from 'react'
import { LINK_PALETTE, type LinkStyle } from '../docks'
import { t } from '../i18n'

// A working miniature of the workspace, drawn with the link style being chosen: two searches, an image panel and a
// comments panel. Everything on it is live — double-click a card to load it, use the tab control to wire, freeze,
// re-wire — so the three styles explain themselves instead of being described.
const CARDS = [['迫临末日伊莫库', '坚毅的阿耶尼', '学业飞升'], ['葬火诗人', 'Long-Bodied Grey Dog', 'Old Thrush']]
const LETTER = ['A', 'B']
type Fid = 'img' | 'cmt'
interface Follower { link: 0 | 1 | null; own: string }
const DRAG_MIN = 5

export default function LinkStyleDemo({ style }: { style: LinkStyle }) {
  const [loaded, setLoaded] = useState([CARDS[0][0], CARDS[1][0]])
  const [sel, setSel] = useState([CARDS[0][0], CARDS[1][0]])
  const [f, setF] = useState<Record<Fid, Follower>>({ img: { link: 0, own: '' }, cmt: { link: 0, own: '' } })
  const [glow, setGlow] = useState<string | null>(null)        // 's0' | 's1' | 'self:img' | 'self:cmt'
  const [picking, setPicking] = useState<Fid | null>(null)      // icon style
  const [menu, setMenu] = useState<Fid | null>(null)            // chip style
  const [wiring, setWiring] = useState(false)
  const [hot, setHot] = useState<0 | 1 | null>(null)
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => { setPicking(null); setMenu(null); setGlow(null) }, [style])
  useEffect(() => {
    if (!picking && !menu) return
    const down = (e: MouseEvent) => { const el = e.target as HTMLElement; if (!el.closest('.ldemo-menu') && !el.closest('[data-demo-search]') && !el.closest('.lg-link')) { setPicking(null); setMenu(null) } }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPicking(null); setMenu(null) } }
    document.addEventListener('mousedown', down, true); document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('mousedown', down, true); document.removeEventListener('keydown', key, true) }
  }, [picking, menu])

  const cardOf = (id: Fid) => { const x = f[id]; return x.link === null ? x.own : loaded[x.link] }
  const groupOf = (id: Fid) => { const x = f[id]; return x.link === null ? `self:${id}` : `s${x.link}` }
  const wire = (id: Fid, to: 0 | 1) => setF(m => ({ ...m, [id]: { link: to, own: '' } }))
  const freeze = (id: Fid) => setF(m => ({ ...m, [id]: { link: null, own: cardOf(id) } }))
  const busy = wiring || !!picking
  const hover = (grp: string | null) => { if (!busy) setGlow(grp) }
  const isGlow = (grp: string) => glow === grp

  // ---- wire style ----
  const startWire = (id: Fid) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault(); e.stopPropagation()
    const port = e.currentTarget, b = box.current
    if (!b) return
    const br = b.getBoundingClientRect(), pr = port.getBoundingClientRect()
    const x0 = pr.left + pr.width / 2 - br.left, y0 = pr.top + pr.height / 2 - br.top
    let moved = false
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - pr.left, ev.clientY - pr.top) < DRAG_MIN) return
      if (!moved) { moved = true; setWiring(true); setGlow(groupOf(id)) }
      setLine({ x1: x0, y1: y0, x2: ev.clientX - br.left, y2: ev.clientY - br.top })
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const s = el?.closest<HTMLElement>('[data-demo-search]')?.dataset.demoSearch
      setHot(s === '0' ? 0 : s === '1' ? 1 : null)
    }
    const up = (ev: PointerEvent) => {
      port.removeEventListener('pointermove', move); port.removeEventListener('pointerup', up); port.removeEventListener('pointercancel', up)
      try { port.releasePointerCapture(ev.pointerId) } catch { /* released */ }
      if (!moved) return
      const el = ev.type === 'pointerup' ? document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null : null
      const s = el?.closest<HTMLElement>('[data-demo-search]')?.dataset.demoSearch
      const inside = !!el && !!b.contains(el)
      setWiring(false); setLine(null); setHot(null); setGlow(null)
      if (s === '0' || s === '1') wire(id, s === '0' ? 0 : 1)
      else if (inside && f[id].link !== null) freeze(id)
    }
    port.setPointerCapture(e.pointerId)
    port.addEventListener('pointermove', move); port.addEventListener('pointerup', up); port.addEventListener('pointercancel', up)
  }

  const control = (id: Fid) => {
    const x = f[id]
    const linked = x.link !== null
    if (style === 'wire') return <button className={`lg-port${linked ? ' linked' : ''}`} title={linked ? t('portLinked') : t('portFrozen')} onPointerDown={startWire(id)} onMouseEnter={() => hover(groupOf(id))} onMouseLeave={() => hover(null)} />
    if (style === 'chip') return (
      <span className="ldemo-chipwrap">
        <button className={`lg-chip${linked ? '' : ' off'}`} style={linked ? { background: LINK_PALETTE[x.link!] } : undefined} title={linked ? t('chipLinked') : t('chipFrozen')}
          onClick={e => { e.stopPropagation(); setMenu(menu === id ? null : id) }} onMouseEnter={() => hover(groupOf(id))} onMouseLeave={() => hover(null)}>{linked ? LETTER[x.link!] : '🔓'}</button>
        {menu === id && (
          <div className="menu ldemo-menu">
            {([0, 1] as const).map(i => <div key={i} className={x.link === i ? 'on' : ''} onClick={() => { wire(id, i); setMenu(null) }}><span className="chan-dot" style={{ background: LINK_PALETTE[i] }} /> {LETTER[i]} · {t('followSearch')} {t('zoneSearch')} {i + 1}<span className="sub"> · {loaded[i]}</span></div>)}
            <div className="sep" />
            <div className={linked ? '' : 'on'} onClick={() => { freeze(id); setMenu(null) }}>🔓 {t('unfollow')}</div>
          </div>
        )}
      </span>
    )
    return <button className={`lg-link${linked ? '' : ' off'}${picking === id ? ' picking' : ''}`} title={linked ? t('iconLinked') : t('iconFrozen')}
      onClick={e => { e.stopPropagation(); if (linked) freeze(id); else setPicking(picking === id ? null : id) }} onMouseEnter={() => hover(groupOf(id))} onMouseLeave={() => hover(null)}>{linked ? '🔗' : '🔓'}</button>
  }

  const search = (i: 0 | 1) => (
    <div key={i} className={`ldemo-panel s${i}${isGlow(`s${i}`) ? ' glow' : ''}${busy ? ' target' : ''}${hot === i ? ' hot' : ''}`} data-demo-search={i}
      onClickCapture={e => { if (picking) { wire(picking, i); setPicking(null); e.stopPropagation() } }}>
      <div className="ldemo-tab" onMouseEnter={() => hover(`s${i}`)} onMouseLeave={() => hover(null)}>
        <span className="lg-grip">⋮⋮</span><span className="name">{t('zoneSearch')} {i + 1}</span>
        {style === 'chip' && <button className="lg-chip" style={{ background: LINK_PALETTE[i] }} title={t('chipSearch')}>{LETTER[i]}</button>}
        <span className="sub">{loaded[i]}</span>
      </div>
      <div className="ldemo-body list">
        {CARDS[i].map(c => (
          <div key={c} className={`${sel[i] === c ? 'sel' : ''}${loaded[i] === c ? ' loaded' : ''}`}
            onClick={() => setSel(s => s.map((v, k) => (k === i ? c : v)))}
            onDoubleClick={() => { setLoaded(l => l.map((v, k) => (k === i ? c : v))); setSel(s => s.map((v, k) => (k === i ? c : v))) }}>{c}</div>
        ))}
      </div>
    </div>
  )
  const follower = (id: Fid, title: string) => {
    const x = f[id]
    return (
      <div key={id} className={`ldemo-panel ${id}${isGlow(groupOf(id)) ? ' glow' : ''}`}>
        <div className="ldemo-tab">
          <span className="lg-grip">⋮⋮</span><span className="name">{title}</span>{control(id)}<span className="sub">{cardOf(id)}</span>
        </div>
        <div className="ldemo-body">
          <div className="big">{cardOf(id)}</div>
          <div className="sub">{x.link === null ? `🔓 ${t('frozenOn')} ${x.own}` : `${t('followSearch')} · ${t('zoneSearch')} ${x.link + 1}`}</div>
        </div>
      </div>
    )
  }

  return (
    <div ref={box} className={`ldemo${busy ? ' busy' : ''}`}>
      {search(0)}{search(1)}{follower('img', t('zoneImage'))}{follower('cmt', t('zoneComment'))}
      {line && <svg className="ldemo-wire"><line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} /></svg>}
      {(wiring || picking) && <div className="ldemo-hint">{wiring ? t('wireHint') : t('pickHint')}</div>}
    </div>
  )
}
