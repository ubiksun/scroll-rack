import { useState } from 'react'
import { t } from '../i18n'
import { useGrader } from '../state'
import GraphView from '../components/GraphView'
import NavBar from './NavBar'

export default function GraphPanel() {
  const g = useGrader()
  const [hops, setHops] = useState(1)
  return (
    <div className="pane">
      <div className="topbar sub-bar">
        <select value={hops} onChange={e => setHops(Number(e.target.value))}><option value={0}>{t('global')}</option><option value={1}>{t('hop1')}</option><option value={2}>{t('hop2')}</option></select>
        <NavBar />
      </div>
      <div className="content">
        <GraphView cards={g.cardsByOracle} edges={g.edges} tags={g.allTagRows}
          tierColorOf={oid => { const c = g.cardsByOracle.get(oid); const b = c ? g.badgesFor(c) : []; return b[0]?.color }}
          focus={hops === 0 ? null : g.selected?.oracleId ?? null} hops={hops} onSelect={g.jump} imageOf={g.imageOf} />
      </div>
    </div>
  )
}
