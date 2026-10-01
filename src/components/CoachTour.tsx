import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listSets } from '../api/scryfall'
import { getSetting, setSetting } from '../db'
import { t } from '../i18n'
import { useGrader } from '../state'

// First-run guidance as coach marks over the REAL controls. The dim layer is one SVG with holes cut for the step's
// targets (a step may light two: the grid card AND the card panel), so the targets stay live while everything
// else is inert. Each step invites the action and shows ✓ once its effect is visible, but never blocks "Next" —
// it is a guide, not a gate. The "getting started" checklist (top-left) sits BELOW the dim while the tour runs and
// stays afterwards until its four outcomes are done or it is dismissed; its items and the tip's dots jump to a step.
type Side = 'top' | 'bottom' | 'left' | 'right'
type StepId = 'sets' | 'search' | 'scope' | 'card' | 'tags' | 'links' | 'tiers'
interface Step { id: StepId; sels: string[]; side: Side; item?: number }
const ITEMS = 4
const PAD = 6
const STEPS: Step[] = [
  { id: 'sets', sels: ['[data-tour="sets"]', '.setmenu'], side: 'bottom', item: 0 },   // the open set menu must stay clickable
  { id: 'search', sels: ['[data-tour="search"]'], side: 'bottom' },
  { id: 'scope', sels: ['[data-tour="scope"]'], side: 'bottom' },
  { id: 'card', sels: ['.grid .card', '[data-tour="cardpanel"]'], side: 'right', item: 1 },
  { id: 'tags', sels: ['[data-tour="tags"]'], side: 'left', item: 2 },
  { id: 'links', sels: ['[data-tour="links"]', '[data-tour="cardpanel"]', '.grid'], side: 'left' },   // the whole card panel is the drop target; the grid stays live to drag from
  { id: 'tiers', sels: ['[data-tour="tiers"]'], side: 'left', item: 3 },
]
const RELEASE_WINDOW_DAYS = 14   // a set counts as current up to two weeks before release — prerelease season

const cardOpen = () => !!document.querySelector('[data-tour="tiers"]')
interface R { x: number; y: number; w: number; h: number }

export default function CoachTour({ open, onClose, startAt }: { open: boolean; onClose: () => void; startAt?: number }) {
  const g = useGrader()
  const [i, setI] = useState(0)
  const [holes, setHoles] = useState<R[]>([])
  const [tipPos, setTipPos] = useState({ x: 0, y: 0, ax: 0, ay: 0 })
  const tip = useRef<HTMLDivElement>(null)
  const scrolledFor = useRef(-1)
  const [pulling, setPulling] = useState(false)
  const listDismissed = useLiveQuery(() => getSetting<boolean>('checklistDismissed', false), []) ?? false
  const [collapsed, setCollapsed] = useState(true)
  const [tick, setTick] = useState(0)
  void tick

  const done = [g.activeSets.length > 0, cardOpen() || g.ratedCount > 0, g.allTagRows.length > 0, g.ratedCount > 0]
  const doneCount = done.filter(Boolean).length
  const step = STEPS[Math.min(i, STEPS.length - 1)]
  const classic = g.workspaceMode === 'classic'
  const text: Record<StepId, { title: string; body: string }> = {
    sets: { title: t('tourSetsTitle'), body: t('tourSetsBody') },
    search: { title: t('tourSearchTitle'), body: t('tourSearchBody') },
    scope: { title: t('tourScopeTitle'), body: t('tourScopeBody') },
    links: { title: t('tourLinksTitle'), body: t('tourLinksBody') },
    card: { title: t('tourCardTitle'), body: classic ? t('tourCardBodyClassic') : t('tourCardBodyWired') },
    tags: { title: t('tourTagsTitle'), body: t('tourTagsBody') },
    tiers: { title: t('tourTiersTitle'), body: t('tourTiersBody') },
  }
  const prepare = useCallback((id: StepId) => {
    if (id === 'tags' || id === 'links') { if (g.collapsed.has(id)) g.toggleCollapse(id) }
    if (id === 'tiers') { if (g.collapsed.has('contexts')) g.toggleCollapse('contexts'); const first = g.contexts[0]; if (first && g.collapsed.has(first.id)) g.toggleCollapse(first.id) }
  }, [g.collapsed, g.toggleCollapse, g.contexts])

  // locate the targets every 300 ms; a step whose FIRST target is missing (no card open yet) falls back to the
  // nearest earlier step that is on screen
  const place = useCallback(() => {
    setTick(x => x + 1)
    if (!open) return
    let k = i
    let els: HTMLElement[] = []
    while (k >= 0) { els = STEPS[k].sels.map(s => document.querySelector<HTMLElement>(s)).filter((e): e is HTMLElement => !!e); if (els.length && document.querySelector(STEPS[k].sels[0])) break; k-- }
    if (!els.length) { onClose(); return }
    if (k !== i) { setI(k); return }
    prepare(step.id)
    // scroll the target into view ONCE per step — doing it on every poll fought the user's own scrolling of the panel
    if (scrolledFor.current !== i) { scrolledFor.current = i; els[0].scrollIntoView({ block: 'nearest', inline: 'nearest' }) }
    setHoles(els.map(e => { const r = e.getBoundingClientRect(); return { x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 } }))
  }, [open, i, onClose, prepare, step.id, g.activeSets.length])
  useLayoutEffect(place, [place])
  useEffect(() => { const h = window.setInterval(place, 300); window.addEventListener('resize', place); return () => { window.clearInterval(h); window.removeEventListener('resize', place) } }, [place])
  useLayoutEffect(() => {
    const r = holes[0]
    if (!r || !tip.current) return
    const W = tip.current.offsetWidth, H = tip.current.offsetHeight, gap = 14
    let x = 0, y = 0
    if (step.side === 'bottom') { x = r.x + r.w / 2 - W / 2; y = r.y + r.h + gap }
    if (step.side === 'top') { x = r.x + r.w / 2 - W / 2; y = r.y - H - gap }
    if (step.side === 'left') { x = r.x - W - gap; y = r.y + r.h / 2 - H / 2 }
    if (step.side === 'right') { x = r.x + r.w + gap; y = r.y + r.h / 2 - H / 2 }
    x = Math.max(8, Math.min(x, window.innerWidth - W - 8)); y = Math.max(8, Math.min(y, window.innerHeight - H - 8))
    setTipPos({ x, y, ax: Math.max(12, Math.min(r.x + r.w / 2 - x - 6, W - 24)), ay: Math.max(12, Math.min(r.y + r.h / 2 - y - 6, H - 24)) })
  }, [holes, step.side, i])

  const finish = () => { void setSetting('onboarded', true); onClose() }
  const next = () => { if (i >= STEPS.length - 1) finish(); else setI(i + 1) }
  const prev = () => { if (i > 0) setI(i - 1) }
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
      if (e.key === 'Escape') { e.stopPropagation(); if (typing) el.blur(); else finish() }
      if (typing) return
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); prev() }
    }
    document.addEventListener('keydown', key, true); return () => document.removeEventListener('keydown', key, true)
  })
  useEffect(() => { if (open) { setI(startAt ?? 0); scrolledFor.current = -1 } }, [open, startAt])

  const pullNewest = async () => {
    setPulling(true)
    try {
      const limit = new Date(Date.now() + RELEASE_WINDOW_DAYS * 86400e3).toISOString().slice(0, 10)
      const sets = (await listSets()).filter(s => (s.set_type === 'expansion' || s.set_type === 'core') && s.released_at <= limit && !s.digital)
      sets.sort((a, b) => b.released_at.localeCompare(a.released_at))
      if (sets[0]) await g.pullSet(sets[0].code)
    } catch (e) { g.setStatus(String(e)) } finally { setPulling(false) }
  }
  const jump = (k: number) => { setI(k); if (!open) window.dispatchEvent(new CustomEvent('sr:guide', { detail: k })) }
  const showList = doneCount < ITEMS && !listDismissed
  const vw = window.innerWidth, vh = window.innerHeight
  // evenodd paints an overlap of two holes AGAIN (the Links section sat dimmed inside the card panel's hole), so the
  // mask is cut from the UNION of the holes: split the plane on every hole edge and emit each covered cell once
  const xs = [...new Set(holes.flatMap(r => [r.x, r.x + r.w]))].sort((a, b) => a - b)
  const ys = [...new Set(holes.flatMap(r => [r.y, r.y + r.h]))].sort((a, b) => a - b)
  const cells: string[] = []
  for (let a = 0; a < xs.length - 1; a++) for (let b = 0; b < ys.length - 1; b++) {
    const cx = (xs[a] + xs[a + 1]) / 2, cy = (ys[b] + ys[b + 1]) / 2
    if (holes.some(r => cx > r.x && cx < r.x + r.w && cy > r.y && cy < r.y + r.h)) cells.push(`M${xs[a]} ${ys[b]}H${xs[a + 1]}V${ys[b + 1]}H${xs[a]}Z`)
  }
  const d = holes.length ? `M0 0H${vw}V${vh}H0Z ` + cells.join(' ') : ''

  return (
    <>
      {showList && (
        <div className={`checklist${collapsed ? ' collapsed' : ''}`}>
          <div className="head" onClick={() => setCollapsed(v => !v)}>
            <span>{t('guideTitle')}</span><span className="sub">{doneCount} / {ITEMS}</span>
            <span className="caret">{collapsed ? '▾' : '▴'}</span>
            <span className="x" title={t('close')} onClick={e => { e.stopPropagation(); void setSetting('checklistDismissed', true) }}>✕</span>
          </div>
          <div className="bar"><i style={{ width: `${doneCount / ITEMS * 100}%` }} /></div>
          <ul>
            {[t('tourItemSet'), t('tourItemCard'), t('tourItemTag'), t('tourItemTier')].map((label, k) => (
              <li key={k} className={done[k] ? 'done' : ''} onClick={() => jump(STEPS.findIndex(s => s.item === k))}><span className="box">{done[k] ? '✓' : ''}</span>{label}</li>
            ))}
          </ul>
        </div>
      )}
      {open && holes.length > 0 && (
        <>
          <svg className="tour-dim" width={vw} height={vh}><path d={d} fillRule="evenodd" /></svg>
          {holes.map((r, k) => <div key={k} className="tour-spot" style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />)}
          <div ref={tip} className="tip" data-side={step.side} style={{ left: tipPos.x, top: tipPos.y }} role="dialog" aria-label={text[step.id].title}>
            <div className="arrow" style={step.side === 'bottom' || step.side === 'top' ? { left: tipPos.ax } : { top: tipPos.ay }} />
            <div className="k">{t('tourStep')} {i + 1} / {STEPS.length}</div>
            <h3>{text[step.id].title}</h3>
            <p>{text[step.id].body}</p>
            {step.id === 'sets' && g.activeSets.length === 0 && (
              <div className="tour-action"><button className="active" disabled={pulling || !!g.busySet} onClick={() => void pullNewest()}>{pulling || g.busySet ? t('guidePulling') : t('guidePullNewest')}</button>{g.status && <span className="sub">{g.status}</span>}</div>
            )}
            <div className="nav">
              <button onClick={finish}>{t('guideSkip')}</button>
              <span className="spacer" />
              <span className="dots">{STEPS.map((s, k) => <i key={k} className={k === i ? 'on' : ''} title={text[s.id].title} onClick={() => jump(k)} />)}</span>
              <button disabled={i === 0} onClick={prev}>{t('guidePrev')}</button>
              <button className="active" onClick={next}>{i === STEPS.length - 1 ? t('guideDone') : t('guideNext')}</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
