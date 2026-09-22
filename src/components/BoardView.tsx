import { useState } from 'react'
import { upsertRating, type Card, type Context, type Rating, type Scheme } from '../db'

interface Props {
  cards: Card[]                                 // current filter
  contexts: Context[]
  schemes: Scheme[]
  ratingOf: (c: Card, ctx: string) => Rating | undefined
  imageOf: (c: Card, size?: 'small' | 'normal' | 'large') => string
  selectedId: string | null
  onSelect: (c: Card, e: React.MouseEvent) => void
}

// Tier board: one zone per tier + an Unrated pool. Drag a card onto a zone to rate it. Cards inside a zone sit in an
// overlapping stack (snap = the flex layout); hovering a stack fans it out. Context tabs pick which rating you're setting.
export default function BoardView({ cards, contexts, schemes, ratingOf, imageOf, selectedId, onSelect }: Props) {
  // the stack renders each card at 100px, which needs 200 real pixels on a HiDPI screen — more than `small` has
  const stackSize = (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1) > 1 ? 'normal' : 'small'
  const [ctxId, setCtxId] = useState(contexts[0]?.id ?? 'limited')
  const [over, setOver] = useState<string | null>(null)
  const ctx = contexts.find(c => c.id === ctxId) ?? contexts[0]
  const scheme = schemes.find(s => s.id === ctx?.schemeId) ?? schemes[0]
  if (!ctx || !scheme) return null

  const zones: { key: string; label: string; color: string; cards: Card[] }[] = [
    ...scheme.tiers.map(t => ({ key: t.name, label: t.name, color: t.color, cards: [] as Card[] })),
    { key: '', label: 'Unrated', color: '#3a3d48', cards: [] as Card[] },
  ]
  for (const c of cards) {
    const tier = ratingOf(c, ctx.id)?.tier ?? ''
    ;(zones.find(z => z.key === tier) ?? zones[zones.length - 1]).cards.push(c)
  }

  const drop = async (zoneKey: string, e: React.DragEvent) => {
    e.preventDefault(); setOver(null)
    const id = e.dataTransfer.getData('text/card')
    const c = cards.find(x => x.id === id)
    if (c) await upsertRating(c.set, c.oracleId, ctx.id, { tier: zoneKey || null })
  }

  return (
    <div className="board">
      <div className="row" style={{ marginBottom: 8 }}>
        {contexts.map(c => <button key={c.id} className={c.id === ctx.id ? 'active' : ''} onClick={() => setCtxId(c.id)}>{c.name}</button>)}
        <span className="status" style={{ marginLeft: 8 }}>drag a card onto a row to rate it</span>
      </div>
      {zones.map(z => (
        <div key={z.key || '_unrated'} className={`zone${z.key ? '' : ' unrated'}${over === z.key ? ' over' : ''}`}
          onDragOver={e => { e.preventDefault(); if (over !== z.key) setOver(z.key) }} onDragLeave={() => setOver(null)} onDrop={e => drop(z.key, e)}>
          <div className="zone-label" style={{ background: z.color }}>{z.label}<span className="sub"> {z.cards.length}</span></div>
          <div className="stack">
            {z.cards.map(c => (
              <img key={c.id} src={imageOf(c, stackSize)} alt={c.name} title={c.name} draggable
                className={c.id === selectedId ? 'sel' : ''}
                onDragStart={e => { e.dataTransfer.setData('text/card', c.id); e.dataTransfer.effectAllowed = 'move' }}
                onClick={e => onSelect(c, e)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
