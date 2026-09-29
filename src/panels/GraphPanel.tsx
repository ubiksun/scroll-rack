import { useState } from 'react'
import { t } from '../i18n'
import { useGrader } from '../state'
import type { DockviewPanelApi } from 'dockview-react'
import type { DockParams } from '../docks'
import { useDockCard, useShowCard } from '../hooks/useDockCard'
import GraphView from '../components/GraphView'

// The GRAPH dock: the link graph around the channel's card. Clicking a node loads it into the channel.
export default function GraphPanel({ api, params }: { api: DockviewPanelApi; params: DockParams }) {
  const g = useGrader()
  const card = useDockCard(params)
  const show = useShowCard(api, params)
  const [hops, setHops] = useState(1)
  return (
    <div className="pane">
      <div className="topbar sub-bar">
        <select value={hops} onChange={e => setHops(Number(e.target.value))}><option value={0}>{t('global')}</option><option value={1}>{t('hop1')}</option><option value={2}>{t('hop2')}</option></select>
        {card && <span className="status ell" style={{ maxWidth: 260 }}>{g.nameOf(card)}</span>}
      </div>
      <div className="content">
        <GraphView cards={g.cardsByOracle} edges={g.edges} tags={g.allTagRows}
          tierColorOf={oid => { const c = g.cardsByOracle.get(oid); const b = c ? g.badgesFor(c) : []; return b[0]?.color }}
          focus={hops === 0 ? null : card?.oracleId ?? null} hops={hops}
          onSelect={oid => { const c = g.cardsByOracle.get(oid); if (c) { g.ensureSetActive(c.set); show(c) } }} imageOf={g.imageOf} />
      </div>
    </div>
  )
}
