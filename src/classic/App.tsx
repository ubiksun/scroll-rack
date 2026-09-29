import { useEffect, useState, type MutableRefObject } from 'react'
import { DockviewReact, themeLight, type DockviewApi, type DockviewReadyEvent, type IDockviewPanelProps } from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import { importBundle, getSetting, setSetting } from '../db'
import { exportCsv, exportDecklist, exportGraph, exportJson, exportMarkdown } from '../export'
import { t } from '../i18n'
import { useGrader } from '../state'
import { ScopeProvider } from './scope'
import { DEFAULT_QUERY, TIER_SEP, type SerializedQuery, type SortRule } from '../query'
import {
  COMPONENT, LAYOUT_VERSION, addBrowseDock, asBrowse, asCard, asOracle, closeCompanions, isBrowsePanel, isCardPanel,
  migrateLayout, nextPanelId, openCard, resolveOrphans, type OracleMode,
} from './docks'
import DockTab from './components/DockTab'
import SetPicker from '../components/SetPicker'
import BrowsePanel from './panels/BrowsePanel'
import GraphPanel from './panels/GraphPanel'
import DetailPanel from './panels/DetailPanel'
import OraclePanel from './panels/OraclePanel'
import { checkForUpdate, currentVersion, type LatestInfo } from '../update'
import { FEATURES } from '../features'
import { useDockKeyboard } from './hooks/useDockKeyboard'

// Docking layout (VS Code-style): every panel is a tab you can drag, split, stack or float. Layout persists.
// v0.10: Browse and Card docks are multi-instance — each describes itself through `params` (see src/docks.ts).
// There are no "reopen panel X" buttons: + Search / + Card mint fresh docks, and Oracle comes from a card panel's ⧉.
const components: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  browse: p => <ScopeProvider api={p.api} containerApi={p.containerApi} params={asBrowse(p.params)}><BrowsePanel /></ScopeProvider>,
  graph: p => <ScopeProvider api={p.api} containerApi={p.containerApi} params={asBrowse(p.params)}><GraphPanel /></ScopeProvider>,
  detail: p => <DetailPanel api={p.api} containerApi={p.containerApi} params={asCard(p.params)} />,
  oracle: p => <OraclePanel api={p.api} containerApi={p.containerApi} params={asOracle(p.params)} />,
}

function defaultLayout(api: DockviewApi, seed: SerializedQuery, oracleMode: OracleMode) {
  api.clear()
  api.addPanel({ id: 'browse', component: COMPONENT.browse, title: 'Browse', params: { kind: 'browse', scopeId: 'main', q: seed, sel: null } })
  api.addPanel({ id: 'detail', component: COMPONENT.card, title: 'Card', params: { kind: 'card', scopeId: 'main', primary: true }, position: { referencePanel: 'browse', direction: 'right' }, initialWidth: 380 })
  api.addPanel({ id: 'oracle', component: COMPONENT.oracle, title: 'Oracle', params: { kind: 'oracle', ownerId: oracleMode === 'attached' ? 'detail' : null }, position: { referencePanel: 'detail', direction: 'below' }, initialHeight: 220 })
  api.getPanel('browse')?.api.setActive()
}

// The v0.10.0 workspace (what is published on GitHub), kept whole as the DEFAULT mode while the wired workspace
// (src/App.tsx WiredShell) is still being tested. Its layout lives under its own keys so the two never collide.
export default function ClassicShell({ dockRef, openOptions }: { dockRef: MutableRefObject<DockviewApi | null>; openOptions: () => void }) {
  const g = useGrader()
  const [exportOpen, setExportOpen] = useState(false)
  const apiRef = dockRef
  const [latest, setLatest] = useState<LatestInfo | null>(null)
  useEffect(() => { void checkForUpdate().then(setLatest) }, [])
  useDockKeyboard(apiRef)

  const onReady = async (e: DockviewReadyEvent) => {
    apiRef.current = e.api
    const saved = await getSetting<object | null>('dockLayoutClassic', null)
    const ver = await getSetting<number>('dockLayoutClassicV', LAYOUT_VERSION)
    const oracleMode = await getSetting<OracleMode>('oracleMode', 'shared')
    // v0.9.7 persisted one global sort + search scope; they seed the 'main' scope and every newly opened dock.
    const seed: SerializedQuery = {
      ...DEFAULT_QUERY,
      sorts: await getSetting<SortRule[]>('sorts', [{ key: 'number', dir: 'asc' }]),
      searchScope: await getSetting<'active' | 'all'>('searchScope', 'active'),
    }
    try { if (saved) e.api.fromJSON((ver < LAYOUT_VERSION ? migrateLayout(saved, seed, oracleMode) : saved) as never); else defaultLayout(e.api, seed, oracleMode) }
    catch { defaultLayout(e.api, seed, oracleMode) }
    e.api.getPanel('graph')?.api.close()   // 2026-09-28: the graph tab is gone from the classic workspace
    if (e.api.panels.length === 0) defaultLayout(e.api, seed, oracleMode)
    resolveOrphans(e.api)
    if (saved && ver < LAYOUT_VERSION) g.setStatus(t('searchMovedHint'))
    void setSetting('dockLayoutClassicV', LAYOUT_VERSION)
    // focus-follows-last-touched, per kind: a Card dock never steals the arrow keys from a Browse dock
    e.api.onDidActivePanelChange(ev => {
      const p = ev.panel
      if (!p) return
      if (isBrowsePanel(p)) g.setActiveScope(asBrowse(p.params).scopeId)
      else if (isCardPanel(p)) g.setActiveCardPanel(p.id)
    })
    e.api.onDidRemovePanel(p => { if (isCardPanel(p)) closeCompanions(e.api, p.id) })
    let h: number | undefined
    e.api.onDidLayoutChange(() => { clearTimeout(h); h = window.setTimeout(() => void setSetting('dockLayoutClassic', e.api.toJSON()), 300) })
  }
  const newSearch = () => { const api = apiRef.current; if (api) addBrowseDock(api) }
  const resetLayout = async () => {
    const api = apiRef.current; if (!api) return
    defaultLayout(api, DEFAULT_QUERY, g.oracleMode)
    void setSetting('dockLayoutClassic', api.toJSON())
  }

  useEffect(() => {
    if (!exportOpen) return
    const down = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.menu-wrap')) setExportOpen(false) }
    document.addEventListener('mousedown', down); return () => document.removeEventListener('mousedown', down)
  }, [exportOpen])

  if (!g.ready) return null
  const communityForCsv = () => new Map(g.cards.map(c => [c.name, { gih: g.communityRows.get(c.name)?.ever_drawn_win_rate ?? null, pct: g.percentiles.get(c.name) }]))
  const doImport = async (f: File | undefined) => { if (!f) return; try { await importBundle(JSON.parse(await f.text())); g.setStatus(`Imported ${f.name}`) } catch (e) { g.setStatus(String(e)) } }
  // the decklist export follows the focused search dock — that's the list you are looking at
  const exportCurrentList = () => {
    const r = g.navOf(g.activeScopeId)
    const sets = g.activeSets.map(s => s.toUpperCase()).join('+')
    exportDecklist(r?.filtered ?? [], `${sets}${r?.tierF ? '_' + r.tierF.replace(TIER_SEP, '-') : ''}`)
  }

  return (
    <div className="app dock">
      <div className="topbar">
        <SetPicker local={g.localSets} active={g.activeSets} onToggle={g.toggleSet} onPull={g.pullSet} onPullMany={g.pullMany} busy={g.busySet} />
        <div className="group">
          <button onClick={newSearch} title="Open another search panel with its own query">{t('newSearch')}</button>
          <button onClick={resetLayout} title="Reset panel layout">⟲ layout</button>
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
                <div onClick={exportCurrentList}>{t('exportList')}</div>
                {FEATURES.links && <div onClick={exportGraph}>{t('exportGraph')}</div>}
              </div>
            )}
          </span>
          <label className="row"><button onClick={e => (e.currentTarget.nextElementSibling as HTMLInputElement).click()} title="Merge a JSON backup from another machine">{t('import')}</button><input type="file" accept="application/json" hidden onChange={e => doImport(e.target.files?.[0])} /></label>
          <button className="gear" onClick={openOptions} title="Options / 设定" aria-label="Options"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </div>

      <div className="dock-host">
        <DockviewReact components={components} defaultTabComponent={DockTab} onReady={onReady} theme={themeLight} />
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

    </div>
  )
}
