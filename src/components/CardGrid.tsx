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
  onSelect: (c: Card) => void
  community?: Map<string, number>       // card name → GIH WR percentile (only when shown)
  linkedIds: Set<string>                // oracleIds that have ≥1 edge
  imageOf: (c: Card) => string
  nameOf?: (c: Card) => string
}

export default function CardGrid({ cards, badgesFor, selectedId, onSelect, community, linkedIds, imageOf, nameOf }: Props) {
  if (!cards.length) return <div className="empty">{t('noCards')}</div>
  return (
    <div className="grid">
      {cards.map(c => {
        const p = community?.get(c.name)
        return (
          <div key={c.id} className={`card${c.id === selectedId ? ' selected' : ''}`} onClick={() => onSelect(c)} title={nameOf ? nameOf(c) : c.name}>
            <img src={imageOf(c)} alt={c.name} loading="lazy" />
            <BadgeStacks badges={badgesFor(c)} />
            {linkedIds.has(c.oracleId) && <span className="dot" title="has links" />}
            {p !== undefined && <span className="comm">P{p}</span>}
          </div>
        )
      })}
    </div>
  )
}
