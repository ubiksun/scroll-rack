import { useEffect, useRef, useState } from 'react'
import type { Card, BadgeStyle } from '../db'
import { t } from '../i18n'
import { setCardDrag } from '../dnd'

export interface BadgeInfo { ctxId: string; ctx: string; tier: string; color: string; style?: BadgeStyle }

export function BadgeStacks({ badges }: { badges: BadgeInfo[] }) {
  const corners: Record<string, BadgeInfo[]> = { tl: [], tr: [], bl: [], br: [] }
  for (const b of badges) corners[b.style?.pos ?? 'tl'].push(b)
  return <>{Object.entries(corners).filter(([, v]) => v.length).map(([pos, v]) => (
    <span key={pos} className={`badges pos-${pos}`}>{v.map(b => <span key={b.ctxId} className={`badge shape-${b.style?.shape ?? 'pill'} size-${b.style?.size ?? 'm'}`} style={{ background: b.color }} title={`${b.ctx}: ${b.tier}`}>{b.style?.label === 'full' ? `${b.ctx}: ${b.tier}` : b.tier}</span>)}</span>
  ))}</>
}

interface Props {
  cards: Card[]
  badgesFor: (c: Card) => BadgeInfo[]   // one badge per context that has a tier
  selectedId: string | null
  onSelect: (c: Card) => void                       // single click: highlight
  onOpen: (c: Card, e: React.MouseEvent) => void    // double click: load
  onPeek: (c: Card, e: React.MouseEvent) => void    // right click: oracle text at the pointer
  community?: Map<string, number>       // card name → GIH WR percentile (only when shown)
  linkedIds: Set<string>                // oracleIds that have ≥1 edge
  imageOf: (c: Card, size?: 'small' | 'normal' | 'large') => string
  nameOf?: (c: Card) => string
  cols: number                          // cards per row — the zoom. One column per step, so nothing re-flows mid-drag.
}

const GAP = 10

export default function CardGrid({ cards, badgesFor, selectedId, onSelect, onOpen, onPeek, community, linkedIds, imageOf, nameOf, cols }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!el.current) return
    const ro = new ResizeObserver(en => setWidth(Math.round(en[0].contentRect.width)))
    ro.observe(el.current)
    return () => ro.disconnect()
  }, [])
  if (!cards.length) return <div className="empty">{t('noCards')}</div>
  // Scryfall scan widths: small 146 · normal 488 · large 672. Step up before the browser has to stretch anything —
  // on a 2x screen a 150px tile already needs 300 real pixels.
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const tile = width ? (width - GAP * (cols - 1)) / cols : 150
  const need = tile * dpr
  const size: 'small' | 'normal' | 'large' = need > 488 ? 'large' : need > 146 ? 'normal' : 'small'
  return (
    <div ref={el} className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}>
      {cards.map(c => {
        const p = community?.get(c.name)
        return (
          <div key={c.id} className={`card${c.id === selectedId ? ' selected' : ''}`} title={nameOf ? nameOf(c) : c.name}
            onClick={() => onSelect(c)} onDoubleClick={e => onOpen(c, e)} onContextMenu={e => onPeek(c, e)}
            draggable onDragStart={e => { setCardDrag(e, c, nameOf ? nameOf(c) : c.name); e.dataTransfer.effectAllowed = 'all' }}>
            <img src={imageOf(c, size)} alt={c.name} loading="lazy" draggable={false} />
            <BadgeStacks badges={badgesFor(c)} />
            {linkedIds.has(c.oracleId) && <span className="dot" title={t('hasLinks')} />}
            {p !== undefined && <span className="comm">P{p}</span>}
          </div>
        )
      })}
    </div>
  )
}
