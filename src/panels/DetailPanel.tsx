import { FEATURES } from '../features'
import { useGrader } from '../state'
import CardPanel from '../components/CardPanel'

// Rating contexts · tags · links (+ big image when Browse isn't already showing it). Oracle has its own panel.
export default function DetailPanel() {
  const g = useGrader()
  if (!g.selected) return <div className="empty">Select a card.</div>
  const s = g.selected
  const pid = g.partnerOf.get(s.oracleId); const partner = pid ? g.cardsByOracle.get(pid) : undefined
  const community = FEATURES.community ? { row: g.communityRows.get(s.name), percentile: g.percentiles.get(s.name), fetchedAt: g.communitySnaps.find(x => x.set === s.set)?.fetchedAt, onRefresh: g.pullCommunity } : null
  return (
    <div className="panel">
      <CardPanel card={s} contexts={g.contexts} schemes={g.schemes} ratings={g.selRatings} tags={g.selTags} allTags={g.allTags}
        allCards={g.allCards} edges={g.selEdges} cardsByOracle={g.cardsByOracle} community={community}
        onJump={g.jump} onClose={() => g.setSelected(null)}
        image={g.imageOf(s, 'normal')} artPref={g.artPrefs.get(`${s.set}:${s.oracleId}`)} artMode={g.artMode} onSetArt={id => g.setArtPref(s, id)}
        sections={g.sections.filter(x => x !== 'oracle')} onMoveSection={g.moveSection} collapsed={g.collapsed} onToggleCollapse={g.toggleCollapse} hideImage={g.view === 'single'}
        communityTags={g.taggerOn ? g.community : undefined} onRefreshCommunity={g.refreshCommunity}
        display={g.cardLang === 'zh' ? { name: g.nameOf(s), type: g.typeOf(s) } : undefined}
        pair={partner ? { partner, partnerName: g.nameOf(partner), setting: g.pairSetting, onSetSetting: g.setPairSetting, onShowOnce: () => { g.showPairOnce(s.oracleId); g.setView('single') }, onJump: () => g.jump(partner.oracleId) } : undefined} />
    </div>
  )
}
