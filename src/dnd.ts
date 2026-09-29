import type { Card } from './db'

// Card drag payload shared by every drag source (grid, board) and drop target (comments zone → link). Plain HTML5 dnd,
// so it crosses dockview instances and tabs; dockview ignores foreign drags, so no dock overlays light up.
export const CARD_MIME = 'application/x-scroll-rack-card'
export interface CardDrag { set: string; oracleId: string; name: string }

export function setCardDrag(e: React.DragEvent, c: Card, name: string) {
  e.dataTransfer.setData(CARD_MIME, JSON.stringify({ set: c.set, oracleId: c.oracleId, name } satisfies CardDrag))
  e.dataTransfer.setData('text/plain', name)
}
export const hasCardDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(CARD_MIME)
export function readCardDrag(e: React.DragEvent): CardDrag | null {
  try { const raw = e.dataTransfer.getData(CARD_MIME); return raw ? (JSON.parse(raw) as CardDrag) : null } catch { return null }
}
