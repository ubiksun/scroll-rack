import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting } from '../db'
import { asDock, colorOf, letterOf, searchDocks } from '../docks'
import { t } from '../i18n'
import { useGrader } from '../state'

// The dock's tab: grip (the drag handle) · title · LINK CONTROL · card name · rename ✎ · pin 📌 · close ✕.
// The link control is how a follower is wired to a search dock; ⚙ → Display picks one of three looks over the
// same data (user's pick 2026-09-24 was the wire, the other two came back as options on 9/25):
//   wire — a dot: filled = wired, hollow = not. Drag it onto a search dock to follow it, anywhere else to freeze.
//   chip — a letter per search (A, B, …): click a follower's chip to pick a search from a menu, or to freeze.
//   icon — 🔗 / 🔓: click 🔗 to freeze; click 🔓 then click a search dock.
// Whatever the look: hovering the control lights the whole group, hovering a search tab lights its followers.

const DRAG_MIN = 6

// the search dock under a viewport point — both the tab and the content shell carry the data attributes
const searchUnder = (x: number, y: number): string | null => {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  return el?.closest<HTMLElement>('[data-dock-kind="search"]')?.dataset.dockId ?? null
}
const clearHot = () => document.querySelectorAll('.target-hot').forEach(el => el.classList.remove('target-hot'))

export default function DockTab({ api, containerApi }: IDockviewPanelHeaderProps) {
  const g = useGrader()
  const [title, setTitle] = useState(api.title ?? '')
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const [tick, setTick] = useState(0)
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null)
  const showRename = useLiveQuery(() => getSetting<boolean>('tabRenameButton', true), []) ?? true

  useEffect(() => { const d = api.onDidTitleChange(e => setTitle(e.title ?? '')); return () => d.dispose() }, [api])
  useEffect(() => { const d = api.onDidParametersChange(() => setTick(x => x + 1)); return () => d.dispose() }, [api])
  // letters follow the set of search docks, so re-render when docks come and go
  useEffect(() => {
    const a = containerApi.onDidAddPanel(() => setTick(x => x + 1)); const r = containerApi.onDidRemovePanel(() => setTick(x => x + 1))
    return () => { a.dispose(); r.dispose() }
  }, [containerApi])
  useEffect(() => {
    if (!menu) return
    const down = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.chan-menu')) setMenu(null) }
    document.addEventListener('mousedown', down); return () => document.removeEventListener('mousedown', down)
  }, [menu])
  // icon style: while this follower waits for a search, a click anywhere that is not a search dock cancels
  useEffect(() => {
    if (g.picking !== api.id) return
    const down = (e: MouseEvent) => { const el = e.target as HTMLElement; if (!el.closest('[data-dock-kind="search"]') && !el.closest('.lg-link')) g.setPicking(null) }
    document.addEventListener('mousedown', down, true); return () => document.removeEventListener('mousedown', down, true)
  }, [g.picking, api.id, g.setPicking])
  void tick

  const panel = containerApi.getPanel(api.id)
  const raw = (panel?.params ?? {}) as Record<string, unknown>
  const p = asDock(raw)
  const pinned = p.pinned
  const isSearch = p.kind === 'search'
  const groupId = isSearch ? api.id : (p.linked ? p.channel : null)
  const ref = isSearch ? null : (p.linked ? g.channelCards[p.channel] : p.own)
  const card = ref ? g.cardByKey.get(`${ref.set}:${ref.oracleId}`) : undefined
  const glow = !!g.glow && (g.glow === groupId || g.glow === `self:${api.id}`)
  const target = !!(g.wiring || g.picking) && isSearch
  const searches = searchDocks(containerApi)
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()

  const commit = (value: string) => {
    const name = value.trim()
    setEditing(false)
    if (!name) return
    api.setTitle(name)   // the ONLY title writer — that is what makes a rename stick
  }
  const togglePin = () => api.updateParameters({ ...raw, pinned: !pinned })
  const wireTo = (id: string) => api.updateParameters({ ...(api.getParameters() as Record<string, unknown>), channel: id, linked: true, own: null })
  const freeze = () => api.updateParameters({ ...(api.getParameters() as Record<string, unknown>), linked: false, own: g.channelCards[p.channel] ?? p.own ?? null })
  const hoverIn = () => { if (!g.wiring && !g.picking) g.setGlow(groupId ?? `self:${api.id}`) }
  const hoverOut = () => { if (!g.wiring && !g.picking) g.setGlow(null) }
  const openMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setMenu(menu ? null : { top: r.bottom + 4, left: Math.max(4, Math.min(r.left, window.innerWidth - 260)) })
  }
  // icon style: a search tab clicked while a follower is waiting → wire it here
  const pickHere = (e: React.MouseEvent) => {
    if (!isSearch || !g.picking) return
    const f = containerApi.getPanel(g.picking)
    if (f) f.api.updateParameters({ ...(f.params ?? {}), channel: api.id, linked: true, own: null })
    g.setPicking(null); e.stopPropagation(); e.preventDefault()
  }

  // ---- wire style: pointer capture on the port, an SVG line on <body>, hit-test on release ----
  const startWire = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault(); e.stopPropagation()
    const port = e.currentTarget
    const pr = port.getBoundingClientRect()
    const x0 = pr.left + pr.width / 2, y0 = pr.top + pr.height / 2
    let moved = false
    let svg: SVGSVGElement | null = null, line: SVGLineElement | null = null, hint: HTMLDivElement | null = null
    const begin = () => {
      moved = true
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'wire-overlay')
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      for (const [k, v] of [['x1', x0], ['y1', y0], ['x2', x0], ['y2', y0]] as const) line.setAttribute(k, String(v))
      svg.appendChild(line); document.body.appendChild(svg)
      hint = document.createElement('div'); hint.className = 'wire-hint'; hint.textContent = t('wireHint'); document.body.appendChild(hint)
      port.classList.add('dragging')
      g.setWiring(api.id); g.setGlow(groupId ?? `self:${api.id}`)
    }
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < DRAG_MIN) return
      if (!moved) begin()
      line!.setAttribute('x2', String(ev.clientX)); line!.setAttribute('y2', String(ev.clientY))
      const hit = searchUnder(ev.clientX, ev.clientY)
      clearHot()
      if (hit) document.querySelectorAll(`[data-dock-id="${hit}"]`).forEach(el => el.classList.add('target-hot'))
    }
    const up = (ev: PointerEvent) => {
      port.removeEventListener('pointermove', move); port.removeEventListener('pointerup', up); port.removeEventListener('pointercancel', up)
      try { port.releasePointerCapture(ev.pointerId) } catch { /* already released */ }
      if (!moved) return   // a plain click: the hover glow was the feedback
      svg?.remove(); hint?.remove(); port.classList.remove('dragging'); clearHot()
      g.setWiring(null); g.setGlow(null)
      const hit = ev.type === 'pointerup' ? searchUnder(ev.clientX, ev.clientY) : null
      if (hit) wireTo(hit)
      else if (ev.type === 'pointerup' && p.linked) freeze()
    }
    port.setPointerCapture(e.pointerId)
    port.addEventListener('pointermove', move); port.addEventListener('pointerup', up); port.addEventListener('pointercancel', up)
  }

  // ---- the link control, by style ----
  let control: ReactNode = null
  if (g.linkStyle === 'wire' && !isSearch) {
    control = (
      <button className={`lg-port${p.linked ? ' linked' : ''}`} title={p.linked ? t('portLinked') : t('portFrozen')} aria-label={p.linked ? t('portLinked') : t('portFrozen')}
        onMouseDown={stop} onClick={stop} onPointerDown={startWire} onMouseEnter={hoverIn} onMouseLeave={hoverOut} />
    )
  } else if (g.linkStyle === 'chip') {
    const id = isSearch ? api.id : p.channel
    const on = isSearch || p.linked
    control = (
      <button className={`lg-chip${on ? '' : ' off'}`} style={on ? { background: colorOf(searches, id) } : undefined}
        title={isSearch ? t('chipSearch') : p.linked ? t('chipLinked') : t('chipFrozen')}
        onMouseDown={stop} onClick={e => { e.stopPropagation(); if (!isSearch) openMenu(e) }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{on ? letterOf(searches, id) : '🔓'}</button>
    )
  } else if (g.linkStyle === 'icon' && !isSearch) {
    const picking = g.picking === api.id
    control = (
      <button className={`lg-link${p.linked ? '' : ' off'}${picking ? ' picking' : ''}`} title={p.linked ? t('iconLinked') : t('iconFrozen')}
        onMouseDown={stop} onClick={e => { e.stopPropagation(); if (p.linked) freeze(); else g.setPicking(picking ? null : api.id) }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{p.linked ? '🔗' : '🔓'}</button>
    )
  }

  return (
    <div className={`lg-tab${pinned ? ' pinned' : ''}${glow ? ' glow' : ''}${target ? ' target' : ''}`} data-dock-id={api.id} data-dock-kind={p.kind}
      onDoubleClick={e => { e.stopPropagation(); setEditing(true) }} onClickCapture={pickHere}
      onMouseEnter={() => { if (isSearch && !g.wiring && !g.picking) g.setGlow(api.id) }} onMouseLeave={() => { if (isSearch && !g.wiring && !g.picking) g.setGlow(null) }}>
      <span className="lg-grip" title={t('dragHint')}>⋮⋮</span>
      {editing ? (
        <input ref={input} className="lg-tab-input" defaultValue={title} autoFocus
          onFocus={e => e.target.select()}
          onClick={stop} onMouseDown={stop}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
            if (e.key === 'Escape') setEditing(false)
          }} />
      ) : (
        <span className="lg-tab-name">{title}</span>
      )}
      {control}
      {card && <span className="lg-tab-sub" title={g.nameOf(card)}>{g.nameOf(card)}</span>}
      {menu && (
        <div className="menu chan-menu" style={{ position: 'fixed', top: menu.top, left: menu.left }} onMouseDown={stop}>
          {searches.map(s => {
            const c = g.channelCards[s.id]
            const cc = c ? g.cardByKey.get(`${c.set}:${c.oracleId}`) : undefined
            return (
              <div key={s.id} className={p.linked && p.channel === s.id ? 'on' : ''} onClick={() => { wireTo(s.id); setMenu(null) }}>
                <span className="chan-dot" style={{ background: colorOf(searches, s.id) }} /> {letterOf(searches, s.id)} · {t('followSearch')} {s.api.title ?? s.id}
                {cc && <span className="sub"> · {g.nameOf(cc)}</span>}
              </div>
            )
          })}
          <div className="sep" />
          <div className={p.linked ? '' : 'on'} onClick={() => { freeze(); setMenu(null) }}>🔓 {t('unfollow')}</div>
        </div>
      )}
      {g.picking === api.id && <div className="wire-hint">{t('pickHint')}</div>}
      <span className="lg-tab-actions" onMouseDown={stop}>
        <button className={pinned ? 'on' : ''} title={pinned ? t('unpinDock') : t('pinDock')}
          onClick={e => { e.stopPropagation(); togglePin() }}>📌</button>
        {showRename && (
          <button title={t('renameDock')} onClick={e => { e.stopPropagation(); setEditing(true) }}>✎</button>
        )}
      </span>
      {!pinned && (
        <span className="lg-tab-close" title={t('close')} onMouseDown={stop}
          onClick={e => { e.stopPropagation(); api.close() }}>✕</span>
      )}
    </div>
  )
}
