import { useEffect, useState } from 'react'
import { FEATURES } from '../features'
import { addEdge, type Card } from '../db'
import { hasCardDrag, readCardDrag } from '../dnd'
import { t } from '../i18n'
import { useGrader } from '../state'
import type { DockviewApi, DockviewPanelApi } from 'dockview-react'
import type { DockParams } from '../docks'
import { useDockCard, useShowCard } from '../hooks/useDockCard'
import { useCardData, useCommunityTags } from '../hooks/useCardData'
import CardPanel from '../components/CardPanel'
import { FrozenBar } from './TabPanel'

// The COMMENTS dock: ratings per dimension, notes, tags, links (+ oracle text as a collapsible section) for the
// channel's card — or, unlinked, for the card it was frozen on. Drop a card on it to link the two.
export default function CommentPanel({ api, containerApi, params }: { api: DockviewPanelApi; containerApi: DockviewApi; params: DockParams }) {
  const g = useGrader()
  const card = useDockCard(params)
  const show = useShowCard(api, params)
  const { ratings, tags, edges, partner } = useCardData(card)
  const [over, setOver] = useState(false)
  useEffect(() => { const end = () => setOver(false); document.addEventListener('dragend', end); document.addEventListener('drop', end); return () => { document.removeEventListener('dragend', end); document.removeEventListener('drop', end) } }, [])
  const communityOpen = g.taggerOn && !g.collapsed.has('tags')
  const { row: communityTags, refresh: refreshCommunity } = useCommunityTags(card, communityOpen)
  if (!card) return <div className="empty">{t('selectCardHint')}</div>
  const community = FEATURES.community ? { row: g.communityRows.get(card.name), percentile: g.percentiles.get(card.name), fetchedAt: g.communitySnaps.find(x => x.set === card.set)?.fetchedAt, onRefresh: g.pullCommunity } : null
  // jumping to another card = loading it into this dock's channel (a frozen dock just re-freezes on the target)
  const jump = (target: Card) => { g.ensureSetActive(target.set); show(target) }
  const onDragOver = (e: React.DragEvent) => { if (!hasCardDrag(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'link'; if (!over) setOver(true) }
  const onDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false) }
  const onDrop = async (e: React.DragEvent) => {
    if (!hasCardDrag(e)) return
    e.preventDefault(); setOver(false)
    const d = readCardDrag(e)
    if (!d || d.oracleId === card.oracleId) return
    await addEdge(card.oracleId, d.oracleId)
    g.setStatus(`${t('linked')}: ${g.nameOf(card)} ⇆ ${d.name}`)
  }
  return (
    <div className={`panel droppable${over ? ' drop-link' : ''}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      {over && <div className="drop-hint">{t('dropToLink')}</div>}
      {!params.linked && <FrozenBar containerApi={containerApi} card={card} />}
      <CardPanel domId={api.id} card={card} contexts={g.contexts} schemes={g.schemes} ratings={ratings} tags={tags} allTags={g.allTags}
        allCards={g.allCards} edges={edges} cardsByOracle={g.cardsByOracle} community={community}
        onJump={oid => { const target = g.cardsByOracle.get(oid); if (target) jump(target) }}
        image={g.imageOf(card, 'large')} artPref={g.artPrefs.get(`${card.set}:${card.oracleId}`)} artMode={g.artMode} onSetArt={id => g.setArtPref(card, id)}
        sections={g.sections.filter(x => x !== 'image')} onReorderSection={g.reorderSection} collapsed={g.collapsed} onToggleCollapse={g.toggleCollapse}
        heights={g.sectionHeights} onResizeSection={g.setSectionHeight}
        hideImage
        communityTags={g.taggerOn ? communityTags : undefined} onRefreshCommunity={refreshCommunity}
        display={g.cardLang === 'zh' ? { name: g.nameOf(card), type: g.typeOf(card) } : undefined}
        pair={partner ? {
          partner, partnerName: g.nameOf(partner), setting: g.pairSetting, onSetSetting: g.setPairSetting,
          onShowOnce: () => jump(partner),
          onJump: () => jump(partner),
        } : undefined} />
    </div>
  )
}
