import type { DockviewApi, DockviewPanelApi } from 'dockview-react'
import { FEATURES } from '../features'
import { t } from '../i18n'
import { useEffect, useState } from 'react'
import { useGrader } from '../state'
import { useCardData, useCommunityTags } from '../hooks/useCardData'
import { addOracleDock, oracleFor, openCard, type CardParams } from '../docks'
import CardPanel from '../components/CardPanel'

interface Props { api: DockviewPanelApi; containerApi: DockviewApi; params: CardParams }

// One card, bound by value. v0.10: there can be many of these at once. `params.primary` marks the dock as a Browse
// dock's preview slot — clicking in that grid replaces this card in place. Without it, the dock is pinned forever.
export default function DetailPanel({ api, containerApi, params }: Props) {
  const g = useGrader()
  const panelId = api.id
  const card = params.set && params.oracleId ? g.cardByKey.get(`${params.set}:${params.oracleId}`) ?? null : null
  const { ratings, tags, edges, partner } = useCardData(card)
  const communityOpen = g.taggerOn && !g.collapsed.has('tags')
  const { row: communityTags, refresh: refreshCommunity } = useCommunityTags(card, communityOpen)
  // panels come and go outside React, so re-read the companion oracle whenever the dock set changes
  const [dockTick, setDockTick] = useState(0)
  useEffect(() => {
    const add = containerApi.onDidAddPanel(() => setDockTick(x => x + 1))
    const rm = containerApi.onDidRemovePanel(() => setDockTick(x => x + 1))
    return () => { add.dispose(); rm.dispose() }
  }, [containerApi])
  void dockTick
  if (!card) return <div className="empty">Select a card.</div>
  const community = FEATURES.community ? { row: g.communityRows.get(card.name), percentile: g.percentiles.get(card.name), fetchedAt: g.communitySnaps.find(x => x.set === card.set)?.fetchedAt, onRefresh: g.pullCommunity } : null
  const oracleDock = oracleFor(containerApi, panelId)
  const hasOracleDock = !!oracleDock
  const showOracleSection = g.oracleMode === 'section' || (g.oracleMode === 'shared' ? false : !hasOracleDock)
  const nav = params.scopeId ? g.navOf(params.scopeId) : undefined
  return (
    <div className="panel">
      <div className="dock-actions">
        {g.oracleMode !== 'section' && (
          <button className={hasOracleDock ? 'active' : ''} title={hasOracleDock ? t('closeOracle') : t('popOracle')}
            onClick={() => hasOracleDock ? oracleDock!.api.close() : addOracleDock(containerApi, panelId, `${t('oracle')} · ${g.nameOf(card)}`)}>⧉</button>
        )}
      </div>
      <CardPanel domId={panelId} card={card} contexts={g.contexts} schemes={g.schemes} ratings={ratings} tags={tags} allTags={g.allTags}
        allCards={g.allCards} edges={edges} cardsByOracle={g.cardsByOracle} community={community}
        onJump={oid => { const target = g.cardsByOracle.get(oid); if (!target) return; g.ensureSetActive(target.set); openCard(containerApi, target, { mode: 'replace', selfId: panelId, title: g.nameOf(target) }) }}
        onClose={() => api.close()}
        image={g.imageOf(card, 'large')} artPref={g.artPrefs.get(`${card.set}:${card.oracleId}`)} artMode={g.artMode} onSetArt={id => g.setArtPref(card, id)}
        sections={g.sections.filter(x => x !== 'oracle' || showOracleSection)} onReorderSection={g.reorderSection} collapsed={g.collapsed} onToggleCollapse={g.toggleCollapse}
        heights={g.sectionHeights} onResizeSection={g.setSectionHeight}
        hideImage={nav?.view === 'single' && nav?.selected?.id === card.id}
        communityTags={g.taggerOn ? communityTags : undefined} onRefreshCommunity={refreshCommunity}
        display={g.cardLang === 'zh' ? { name: g.nameOf(card), type: g.typeOf(card) } : undefined}
        pair={partner ? {
          partner, partnerName: g.nameOf(partner), setting: g.pairSetting, onSetSetting: g.setPairSetting,
          onShowOnce: () => { nav?.showPairOnce(card.oracleId); nav?.setView('single') },
          onJump: () => { g.ensureSetActive(partner.set); openCard(containerApi, partner, { mode: 'replace', selfId: panelId, title: g.nameOf(partner) }) },
        } : undefined} />
    </div>
  )
}
