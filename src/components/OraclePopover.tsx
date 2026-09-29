import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { useGrader } from '../state'

// Right-click a card anywhere → its oracle text floats at the pointer, like a hover card that stays until the next
// click, Escape, or scroll. Rendered once by the shell; opened through g.showPeek.
export default function OraclePopover() {
  const g = useGrader()
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const peek = g.peek
  useLayoutEffect(() => {
    if (!peek || !box.current) { setPos(null); return }
    const r = box.current.getBoundingClientRect()
    const left = Math.min(peek.x + 12, window.innerWidth - r.width - 8)
    const top = Math.min(peek.y + 12, window.innerHeight - r.height - 8)
    setPos({ left: Math.max(4, left), top: Math.max(4, top) })
  }, [peek])
  useEffect(() => {
    if (!peek) return
    const close = () => g.closePeek()
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') g.closePeek() }
    document.addEventListener('mousedown', close, true)
    document.addEventListener('keydown', key, true)
    document.addEventListener('wheel', close, { capture: true, passive: true })
    return () => { document.removeEventListener('mousedown', close, true); document.removeEventListener('keydown', key, true); document.removeEventListener('wheel', close, true) }
  }, [peek, g.closePeek])
  if (!peek) return null
  const c = peek.card
  return (
    <div ref={box} className="peek" style={{ left: pos?.left ?? peek.x, top: pos?.top ?? peek.y, visibility: pos ? 'visible' : 'hidden' }} onContextMenu={e => e.preventDefault()}>
      <img src={g.imageOf(c, 'small')} alt="" />
      <div className="peek-body">
        <b>{g.nameOf(c)}</b>
        <div className="sub">{c.manaCost} · {g.typeOf(c)} · {c.rarity} · {c.set.toUpperCase()} #{c.collectorNumber}</div>
        <div className="oracle">{g.oracleOf(c)}</div>
        {c.keywords.length > 0 && <div className="sub" style={{ marginTop: 6 }}>{t('keywords')}: {c.keywords.join(', ')}</div>}
      </div>
    </div>
  )
}
