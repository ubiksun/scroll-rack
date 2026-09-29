import { Fragment, useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { useGrader } from '../state'
import { addEdge, db, type Card } from '../db'
import { hasCardDrag, readCardDrag } from '../dnd'
import type { DockviewApi, DockviewPanelApi } from 'dockview-react'
import type { DockParams } from '../docks'
import { useDockCard, useShowCard } from '../hooks/useDockCard'
import { useCardData } from '../hooks/useCardData'
import ArtPicker from '../components/ArtPicker'
import { FrozenBar } from './TabPanel'

// The IMAGE dock: the channel's card, fitted to the dock on both axes (resizing the dock is the zoom; never a
// scrollbar). ← → step through the channel's search list and load. Linked cards stand beside the image as a
// reminder strip — smaller than an Echoverse pair, which shares the stage as an equal. Drop a card on it to link.
export default function ImagePanel({ api, containerApi, params }: { api: DockviewPanelApi; containerApi: DockviewApi; params: DockParams }) {
  const g = useGrader()
  const card = useDockCard(params)
  const load = useShowCard(api, params)
  const { edges, partner } = useCardData(card)
  const [over, setOver] = useState(false)
  const [unlinking, setUnlinking] = useState<number | null>(null)   // edge id of the strip thumbnail being dragged
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => { const end = () => setOver(false); document.addEventListener('dragend', end); document.addEventListener('drop', end); return () => { document.removeEventListener('dragend', end); document.removeEventListener('drop', end) } }, [])
  const nav = params.linked ? g.navOfChannel(params.channel) : undefined
  const peek = (c: Card, e: React.MouseEvent) => { e.preventDefault(); g.showPeek(c, e.clientX, e.clientY) }
  if (!card) return <div className="empty">{t('selectCardHint')}</div>
  const linked = edges.map(e => ({ edge: e, c: g.cardsByOracle.get(e.a === card.oracleId ? e.b : e.a) })).filter((x): x is { edge: typeof x.edge; c: Card } => !!x.c)
  // Drag a linked thumbnail OUT of the strip and let go anywhere else → the link is removed (the reverse of dropping
  // a card on the panel). Releasing it back inside the strip keeps it. Chrome reports the release point on dragend.
  const unlinkStart = (e: React.DragEvent, edgeId: number) => { e.stopPropagation(); e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'move'; setUnlinking(edgeId) }
  const unlinkEnd = async (e: React.DragEvent, other: Card, edgeId: number) => {
    setUnlinking(null)
    const r = strip.current?.getBoundingClientRect()
    const inside = !!r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    if (inside || (e.clientX === 0 && e.clientY === 0)) return
    await db.edges.delete(edgeId)
    g.setStatus(`${t('unlinked')}: ${g.nameOf(card)} ⇆ ${g.nameOf(other)}`)
  }
  const showPair = partner && g.pairMode
  const pic = (c: Card) => (
    <div key={c.id} className="single-pic" onContextMenu={e => peek(c, e)}>
      <ArtPicker card={c} src={g.imageOf(c, 'large')} className={showPair ? 'single-img pair-img' : 'single-img'} artPref={g.artPrefs.get(`${c.set}:${c.oracleId}`)} artMode={g.artMode} onSetArt={id => g.setArtPref(c, id)} />
    </div>
  )
  const onDragOver = (e: React.DragEvent) => { if (unlinking !== null || !hasCardDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'link'; if (!over) setOver(true) }
  const onDrop = async (e: React.DragEvent) => {
    if (!hasCardDrag(e)) return
    e.preventDefault(); setOver(false)
    const d = readCardDrag(e)
    if (!d || d.oracleId === card.oracleId) return
    await addEdge(card.oracleId, d.oracleId)
    g.setStatus(`${t('linked')}: ${g.nameOf(card)} ⇆ ${d.name}`)
  }
  return (
    <div className={`single imgdock${over ? ' drop-link' : ''}`} onDragOver={onDragOver} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }} onDrop={onDrop}>
      {over && <div className="drop-hint">{t('dropToLink')}</div>}
      {!params.linked && <FrozenBar containerApi={containerApi} card={card} />}
      <div className="single-nav compact">
        <button onClick={() => nav?.loadStep?.(-1)} disabled={!nav} title={t('prev')}>←</button>
        <span className="status ell" style={{ maxWidth: 220 }}>{g.nameOf(card)}</span>
        <button onClick={() => nav?.loadStep?.(1)} disabled={!nav} title={t('next')}>→</button>
      </div>
      <div className="img-stage">
        {!showPair ? pic(card) : (() => {
          const num = (c: Card) => parseInt(c.collectorNumber.replace(/\D/g, ''), 10) || 0
          const [left, right] = num(card) <= num(partner) ? [card, partner] : [partner, card]
          return (
            <div className="pair-view">
              {[left, right].map((c, i) => (
                <Fragment key={c.id}>
                  {i === 1 && <div className="pair-glyph">⇆</div>}
                  <div className={`pair-side${c.id === card.id ? ' focus' : ''}`} onDoubleClick={() => load(c)}>{pic(c)}<div className="sub">#{c.collectorNumber} · {g.nameOf(c)}</div></div>
                </Fragment>
              ))}
            </div>
          )
        })()}
        {linked.length > 0 && (
          <div ref={strip} className={`link-strip${unlinking !== null ? ' unlinking' : ''}`}>
            <div className="sub">⇆ {t('linkedCards')} ({linked.length})</div>
            {linked.map(({ edge, c }) => (
              <img key={edge.id} src={g.imageOf(c, 'normal')} alt={g.nameOf(c)} className={unlinking === edge.id ? 'ghost' : ''} draggable
                onDragStart={e => unlinkStart(e, edge.id!)} onDragEnd={e => void unlinkEnd(e, c, edge.id!)}
                onDoubleClick={() => load(c)} onContextMenu={e => peek(c, e)} />
            ))}
            {unlinking !== null && <div className="sub unlink-hint">{t('dragOutToUnlink')}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
