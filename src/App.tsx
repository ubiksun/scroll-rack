import { useEffect, useRef, useState } from 'react'
import { DockviewReact, themeLight, type DockviewApi, type DockviewReadyEvent, type IDockviewPanelProps } from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import { importBundle, getSetting, setSetting } from './db'
import { exportCsv, exportDecklist, exportGraph, exportJson, exportMarkdown } from './export'
import { t } from './i18n'
import { GraderProvider, useGrader } from './state'
import SetPicker from './components/SetPicker'
import OptionsModal from './components/OptionsModal'
import BrowsePanel from './panels/BrowsePanel'
import GraphPanel from './panels/GraphPanel'
import DetailPanel from './panels/DetailPanel'
import OraclePanel from './panels/OraclePanel'
import { checkForUpdate, currentVersion, type LatestInfo } from './update'
import { FEATURES } from './features'

// Docking layout (VS Code-style): every panel is a tab you can drag, split, stack or float. Layout persists.
const PANELS: Record<string, { title: string; component: string }> = {
  browse: { title: 'Browse', component: 'browse' },
  ...(FEATURES.links ? { graph: { title: 'Graph', component: 'graph' } } : {}),
  detail: { title: 'Card', component: 'detail' },
  oracle: { title: 'Oracle', component: 'oracle' },
}
const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  browse: () => <BrowsePanel />, graph: () => <GraphPanel />, detail: () => <DetailPanel />, oracle: () => <OraclePanel />,
}

function defaultLayout(api: DockviewApi) {
  api.clear()
  api.addPanel({ id: 'browse', component: 'browse', title: 'Browse' })
  if (FEATURES.links) api.addPanel({ id: 'graph', component: 'graph', title: 'Graph', position: { referencePanel: 'browse', direction: 'within' } })
  api.addPanel({ id: 'detail', component: 'detail', title: 'Card', position: { referencePanel: 'browse', direction: 'right' }, initialWidth: 380 })
  api.addPanel({ id: 'oracle', component: 'oracle', title: 'Oracle', position: { referencePanel: 'detail', direction: 'below' }, initialHeight: 220 })
  api.getPanel('browse')?.api.setActive()
}

function Shell() {
  const g = useGrader()
  const [options, setOptions] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const apiRef = useRef<DockviewApi | null>(null)
  const [latest, setLatest] = useState<LatestInfo | null>(null)
  useEffect(() => { void checkForUpdate().then(setLatest) }, [])

  const onReady = async (e: DockviewReadyEvent) => {
    apiRef.current = e.api
    const saved = await getSetting<object | null>('dockLayout', null)
    try { if (saved) e.api.fromJSON(saved as never); else defaultLayout(e.api) } catch { defaultLayout(e.api) }
    if (!FEATURES.links) e.api.getPanel('graph')?.api.close()
    if (e.api.panels.length === 0) defaultLayout(e.api)
    let h: number | undefined
    e.api.onDidLayoutChange(() => { clearTimeout(h); h = window.setTimeout(() => void setSetting('dockLayout', e.api.toJSON()), 300) })
  }
  const showPanel = (id: string) => {
    const api = apiRef.current; if (!api) return
    const p = api.getPanel(id)
    if (p) { p.api.setActive(); return }
    const ref = api.panels[0]
    api.addPanel({ id, component: PANELS[id].component, title: PANELS[id].title, position: ref ? { referencePanel: ref.id, direction: id === 'detail' || id === 'oracle' ? 'right' : 'within' } : undefined })
  }
  const resetLayout = () => { const api = apiRef.current; if (api) { defaultLayout(api); void setSetting('dockLayout', api.toJSON()) } }

  useEffect(() => {
    if (!exportOpen) return
    const down = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.menu-wrap')) setExportOpen(false) }
    document.addEventListener('mousedown', down); return () => document.removeEventListener('mousedown', down)
  }, [exportOpen])

  if (!g.ready) return null
  const communityForCsv = () => new Map(g.cards.map(c => [c.name, { gih: g.communityRows.get(c.name)?.ever_drawn_win_rate ?? null, pct: g.percentiles.get(c.name) }]))
  const doImport = async (f: File | undefined) => { if (!f) return; try { await importBundle(JSON.parse(await f.text())); g.setStatus(`Imported ${f.name}`) } catch (e) { g.setStatus(String(e)) } }

  return (
    <div className="app dock">
      <div className="topbar">
        <SetPicker local={g.localSets} active={g.activeSets} onToggle={g.toggleSet} onPull={g.pullSet} onPullMany={g.pullMany} busy={g.busySet} />
        <div className="group">
          {Object.entries(PANELS).map(([id, p]) => <button key={id} onClick={() => showPanel(id)} title={`show ${p.title} panel`}>{p.title}</button>)}
          <button onClick={resetLayout} title="Reset panel layout">⟲ layout</button>
        </div>
        <div className="group search-group">
          <input placeholder={g.searchScope === 'all' ? 'Search all of Scryfall (Scryfall syntax) …' : t('search')} value={g.textF} onChange={e => g.setTextF(e.target.value)} className={`search${g.searchState === 'error' ? ' err' : ''}`} />
          <button className={g.searchScope === 'all' ? 'active' : ''} onClick={() => g.setSearchScope(g.searchScope === 'all' ? 'active' : 'all')} title={g.searchScope === 'all' ? 'Searching every set on Scryfall (results are cached as you open them). Click to search only the active sets.' : 'Searching the active sets only. Click to search all of Scryfall.'}>{g.searchScope === 'all' ? '🌐 all sets' : '▣ active sets'}</button>
          <span className="status">{g.searchState === 'busy' ? t('searching') : g.searchState === 'error' ? t('syntaxError') : g.searchState === 'local' ? t('localSearch') : ''}</span>
        </div>
        <span className="spacer" />
        <div className="group">
          <span className="menu-wrap">
            <button onClick={() => setExportOpen(v => !v)} title="Download your data as files">{t('export')} ▾</button>
            {exportOpen && (
              <div className="menu" onClick={() => setExportOpen(false)}>
                <div onClick={exportJson}>{t('exportJson')}</div>
                {g.activeSets.map(code => g.contexts.map(ctx => <div key={code + ctx.id} onClick={() => exportCsv(code, ctx, communityForCsv())}>CSV — {code.toUpperCase()} · {ctx.name}</div>))}
                {g.activeSets.map(code => <div key={code} onClick={() => exportMarkdown(code, g.contexts, g.schemes)}>Markdown / Obsidian — {code.toUpperCase()}</div>)}
                <div onClick={() => exportDecklist(g.filtered, `${g.activeSets.map(s => s.toUpperCase()).join('+')}${g.tierF ? '_' + g.tierF.replace('\u0000', '-') : ''}`)}>{t('exportList')}</div>
                {FEATURES.links && <div onClick={exportGraph}>{t('exportGraph')}</div>}
              </div>
            )}
          </span>
          <label className="row"><button onClick={e => (e.currentTarget.nextElementSibling as HTMLInputElement).click()} title="Merge a JSON backup from another machine">{t('import')}</button><input type="file" accept="application/json" hidden onChange={e => doImport(e.target.files?.[0])} /></label>
          <button className="gear" onClick={() => setOptions(true)} title="Options / 設定" aria-label="Options"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </div>

      <div className="dock-host">
        <DockviewReact components={components} onReady={onReady} theme={themeLight} />
      </div>

      {latest && (
        <div className="update-banner">
          New version <b>v{latest.version}</b> available (you have v{currentVersion()}). <a href={latest.zip} target="_blank" rel="noreferrer">Download zip</a> → unzip over your existing folder → chrome://extensions ↻. Your data is kept.
          {latest.notes && <span className="sub"> · {latest.notes}</span>}
          <button onClick={() => setLatest(null)} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
      )}
      <div className="statusbar">
        <span>v{currentVersion()} · {g.status}</span>
        <span className="spacer" />
        <span>{g.activeSets.length ? `${g.activeSets.map(s => s.toUpperCase()).join(' + ')} · ${g.cards.length} cards · ${g.ratedCount} rated · ${g.edges.length} links · ${g.allTagRows.length} tags` : ''}</span>
      </div>

      {options && <OptionsModal contexts={g.contexts} schemes={g.schemes} onClose={() => setOptions(false)} />}
    </div>
  )
}

export default function App() {
  return <GraderProvider><Shell /></GraderProvider>
}
