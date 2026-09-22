import type { Card, BadgeStyle } from '../db'
import { t } from '../i18n'

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
  onSelect: (c: Card, e: React.MouseEvent) => void
  community?: Map<string, number>       // card name → GIH WR percentile (only when shown)
  linkedIds: Set<string>                // oracleIds that have ≥1 edge
  imageOf: (c: Card, size?: 'small' | 'normal' | 'large') => string
  nameOf?: (c: Card) => string
  zoom?: number                         // minimum thumbnail width in px; the grid still fills the panel
}

export default function CardGrid({ cards, badgesFor, selectedId, onSelect, community, linkedIds, imageOf, nameOf, zoom }: Props) {
  if (!cards.length) return <div className="empty">{t('noCards')}</div>
  // Scryfall's `small` scan is 146px wide. The grid used to always ask for it, so the thumbnails were already soft on
  // a HiDPI screen and turned to mush once the zoom control could push a tile past 146 CSS px. Pick the size from the
  // pixels actually needed; `normal` (488px) costs more bytes, but the images are lazy-loaded and CDN-cached.
  // Scryfall scan widths: small 146 · normal 488 · large 672. Step up before the browser has to stretch anything —
  // on a 2x screen a 150px tile already needs 300 real pixels.
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const need = (zoom ?? 150) * dpr
  const size: 'small' | 'normal' | 'large' = need > 488 ? 'large' : need > 146 ? 'normal' : 'small'
  return (
    <div className="grid" style={zoom ? ({ '--card-min': `${zoom}px` } as React.CSSProperties) : undefined}>
      {cards.map(c => {
        const p = community?.get(c.name)
        return (
          <div key={c.id} className={`card${c.id === selectedId ? ' selected' : ''}`} onClick={e => onSelect(c, e)} title={nameOf ? nameOf(c) : c.name}>
            <img src={imageOf(c, size)} alt={c.name} loading="lazy" />
            <BadgeStacks badges={badgesFor(c)} />
            {linkedIds.has(c.oracleId) && <span className="dot" title="has links" />}
            {p !== undefined && <span className="comm">P{p}</span>}
          </div>
        )
      })}
    </div>
  )
}
