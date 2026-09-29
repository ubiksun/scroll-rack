import { useEffect, type ReactNode } from 'react'
import type { DockviewApi, DockviewPanelApi, IDockviewPanelProps } from 'dockview-react'
import type { Card } from '../db'
import { asDock, type DockParams } from '../docks'
import { t } from '../i18n'
import { useGrader } from '../state'
import { ScopeProvider } from '../scope'
import SearchPanel from './BrowsePanel'
import ImagePanel from './ImageZone'
import CommentPanel from './DetailPanel'
import OraclePanel from './OraclePanel'
import GraphPanel from './GraphPanel'

// Every dock renders inside a DockShell. It carries the data attributes the wire's hit-test reads, lights up as a
// member of the hovered group (glow) or as a drop target while a wire is being dragged, and — for a follower —
// freezes itself on its card the moment its search dock is closed.
function DockShell({ api, containerApi, params, children }: { api: DockviewPanelApi; containerApi: DockviewApi; params: DockParams; children: ReactNode }) {
  const g = useGrader()
  const isSearch = params.kind === 'search'
  const groupId = isSearch ? api.id : (params.linked ? params.channel : null)
  const glow = !!g.glow && (g.glow === groupId || g.glow === `self:${api.id}`)
  const target = !!(g.wiring || g.picking) && isSearch
  // icon style: this search dock was clicked while a follower was waiting for one → wire that follower here
  const pick = (e: React.MouseEvent) => {
    if (!g.picking || !isSearch) return
    const f = containerApi.getPanel(g.picking)
    if (f) f.api.updateParameters({ ...(f.params ?? {}), channel: api.id, linked: true, own: null })
    g.setPicking(null); e.stopPropagation(); e.preventDefault()
  }
  useEffect(() => {
    if (isSearch || !params.linked) return
    const d = containerApi.onDidRemovePanel(p => {
      if (p.id !== params.channel) return
      const cur = api.getParameters() as Record<string, unknown>
      api.updateParameters({ ...cur, linked: false, own: g.channelCards[params.channel] ?? null })
    })
    return () => d.dispose()
  }, [isSearch, params.linked, params.channel, containerApi, api, g.channelCards])
  return <div className={`dock-shell${glow ? ' glow' : ''}${target ? ' target' : ''}`} data-dock-id={api.id} data-dock-kind={params.kind} onClickCapture={pick}>{children}</div>
}

const shell = (p: IDockviewPanelProps, body: (d: DockParams) => ReactNode) => {
  const d = asDock(p.params)
  return <DockShell api={p.api} containerApi={p.containerApi} params={d}>{body(d)}</DockShell>
}

// The dockview component map (v0.13: flat docks wired to a search).
export const DOCK_COMPONENTS: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  search: p => shell(p, d => <ScopeProvider api={p.api} containerApi={p.containerApi} params={d}><SearchPanel /></ScopeProvider>),
  image: p => shell(p, d => <ImagePanel api={p.api} containerApi={p.containerApi} params={d} />),
  comment: p => shell(p, d => <CommentPanel api={p.api} containerApi={p.containerApi} params={d} />),
  oracle: p => shell(p, d => <OraclePanel containerApi={p.containerApi} params={d} />),
  graph: p => shell(p, d => <GraphPanel api={p.api} params={d} />),
}

// Shown inside a follower whose wire is pulled: the card it is frozen on, how to re-wire, and a way to push that
// card into a search so the other panels show it — the navigation that makes a frozen comments dock findable.
export function FrozenBar({ containerApi, card }: { containerApi: DockviewApi; card: Card }) {
  const g = useGrader()
  const searches = containerApi.panels.filter(p => asDock(p.params).kind === 'search')
  return (
    <div className="frozen-bar">
      <span>🔓 {t('frozenOn')} <b>{g.nameOf(card)}</b> · <span className="sub">{t('frozenHow')}</span></span>
      <span className="spacer" />
      {searches.map(s => (
        <button key={s.id} className="mini" onClick={() => g.setChannelCard(s.id, { set: card.set, oracleId: card.oracleId })}>{t('loadInto')} {s.api.title ?? s.id}</button>
      ))}
    </div>
  )
}
