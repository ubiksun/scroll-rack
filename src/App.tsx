import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { DockviewReact, themeLight, type DockviewApi, type DockviewReadyEvent } from 'dockview-react'
import 'dockview-react/dist/styles/dockview.css'
import { importBundle, getSetting, setSetting } from './db'
import { exportCsv, exportDecklist, exportGraph, exportJson, exportMarkdown } from './export'
import { t, tx } from './i18n'
import { GraderProvider, useGrader } from './state'
import { DEFAULT_QUERY, TIER_SEP, type SerializedQuery, type SortRule } from './query'
import { addDock, asDock, defaultLayout, DOCK_KINDS, LAYOUT_VERSION, legacySeed, migrateChannels, openBlock, type DockKind } from './docks'
import { dockLabels as labels } from './labels'
import DockTab from './components/DockTab'
import SetPicker from './components/SetPicker'
import OptionsModal from './components/OptionsModal'
import OraclePopover from './components/OraclePopover'
import CoachTour from './components/CoachTour'
import ClassicShell from './classic/App'
import { DOCK_COMPONENTS } from './panels/TabPanel'
import { checkForUpdate, currentVersion, notesOf, type LatestInfo } from './update'
import { FEATURES } from './features'
import { useDockKeyboard } from './hooks/useDockKeyboard'

// Workspace (v0.13): flat docks — search · image · comments · oracle · graph — every one a dockview panel you can
// drag, split, stack, pin, rename. A follower is WIRED to a search dock (drag the port on its tab onto the search):
// the search loads a card, its followers show it. See src/docks.ts.
function WiredShell({ dockRef, openOptions }: { dockRef: MutableRefObject<DockviewApi | null>; openOptions: () => void }) {
  const g = useGrader()
  const [exportOpen, setExportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const apiRef = dockRef
  const seedRef = useRef<SerializedQuery>(DEFAULT_QUERY)
  const [latest, setLatest] = useState<LatestInfo | null>(null)
  useEffect(() => { void checkForUpdate().then(setLatest) }, [])
  useDockKeyboard(apiRef)

  const onReady = async (e: DockviewReadyEvent) => {
    apiRef.current = e.api
    const saved = await getSetting<object | null>('dockLayout', null)
    const ver = await getSetting<number>('dockLayoutV', 1)
    const seed: SerializedQuery = {
      ...DEFAULT_QUERY,
      sorts: await getSetting<SortRule[]>('sorts', [{ key: 'number', dir: 'asc' }]),
      searchScope: await getSetting<'active' | 'all'>('searchScope', 'active'),
    }
    seedRef.current = seed
    if (!saved || ver < 4) {
      // pre-v0.12 layouts are rebuilt as the default workspace; the first search's query + card carry over
      const legacy = legacySeed(saved, seed)
      const s = defaultLayout(e.api, legacy.q, labels())
      if (legacy.card) g.setChannelCard(s, legacy.card)
      if (saved) g.setStatus(t('workspaceMovedHint'))
    } else {
      try { e.api.fromJSON(saved as never) } catch { defaultLayout(e.api, seed, labels()) }
      if (e.api.panels.length === 0) defaultLayout(e.api, seed, labels())
      else if (ver === 4) {
        // v0.12 letter channels → wires to the search dock that drove each letter; the letter's card moves with it
        for (const [searchId, letter] of migrateChannels(e.api, g.channelCards)) g.setChannelCard(searchId, g.channelCards[letter] ?? null)
        g.setStatus(t('workspaceMovedHint'))
      }
    }
    void setSetting('dockLayoutV', LAYOUT_VERSION)
    const track = (id: string | null) => {
      g.setActiveDock(id)
      const p = id ? e.api.getPanel(id) : undefined
      if (p) { const d = asDock(p.params); if (d.kind === 'search') g.setActiveScope(d.scopeId ?? 'main') }
    }
    track(e.api.activePanel?.id ?? null)
    e.api.onDidActivePanelChange(ev => track(ev.panel?.id ?? null))
    let h: number | undefined
    e.api.onDidLayoutChange(() => { clearTimeout(h); h = window.setTimeout(() => void setSetting('dockLayout', e.api.toJSON()), 300) })
  }
  // a new follower is wired the way the dock you are in is wired: to that search, or to its search, or frozen on its card
  const wiringOfActive = (api: DockviewApi) => {
    const active = api.activePanel
    const d = active ? asDock(active.params) : null
    if (!active || !d) return { channel: undefined, own: null }
    if (d.kind === 'search') return { channel: active.id, own: null }
    return d.linked ? { channel: d.channel, own: null } : { channel: undefined, own: d.own ?? null }
  }
  const addPanel = (kind: DockKind) => {
    const api = apiRef.current; if (!api) return
    const w = wiringOfActive(api)
    addDock(api, { kind, title: labels()[kind], channel: w.channel, own: w.own, refId: api.activePanel?.id, direction: 'right', initialWidth: 420, q: kind === 'search' ? seedRef.current : undefined })
    setAddOpen(false)
  }
  const addBlock = () => {
    const api = apiRef.current; if (!api) return
    const w = wiringOfActive(api)
    openBlock(api, labels(), { channel: w.channel, own: w.own, refId: api.activePanel?.id, placement: 'right' })
    setAddOpen(false)
  }

  const resetLayout = () => {
    const api = apiRef.current; if (!api) return
    defaultLayout(api, seedRef.current, labels())
    void setSetting('dockLayout', api.toJSON())
  }

  useEffect(() => {
    if (!exportOpen && !addOpen) return
    const down = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.menu-wrap')) { setExportOpen(false); setAddOpen(false) } }
    document.addEventListener('mousedown', down); return () => document.removeEventListener('mousedown', down)
  }, [exportOpen, addOpen])

  if (!g.ready) return null
  const communityForCsv = () => new Map(g.cards.map(c => [c.name, { gih: g.communityRows.get(c.name)?.ever_drawn_win_rate ?? null, pct: g.percentiles.get(c.name) }]))
  const doImport = async (f: File | undefined) => { if (!f) return; try { await importBundle(JSON.parse(await f.text())); g.setStatus(tx('stImported', { name: f.name })) } catch (e) { g.setStatus(String(e)) } }
  // the decklist export follows the search dock last touched — that's the list you are looking at
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
          <span className="menu-wrap">
            <button onClick={() => setAddOpen(v => !v)} title={t('newPanelHint')}>{t('newPanel')} ▾</button>
            {addOpen && (
              <div className="menu" style={{ left: 0, right: 'auto', minWidth: 220 }}>
                {DOCK_KINDS.filter(k => k !== 'graph').map(k => <div key={k} onClick={() => addPanel(k)}>{labels()[k]}</div>)}
                <div className="sep" />
                <div onClick={addBlock}>{t('newBlock')}</div>
              </div>
            )}
          </span>
          <button onClick={resetLayout} title={t('resetLayout')}>{t('resetLayoutBtn')}</button>
        </div>
        <span className="spacer" />
        <div className="group">
          <span className="menu-wrap">
            <button onClick={() => setExportOpen(v => !v)} title={t('exportHint')}>{t('export')} ▾</button>
            {exportOpen && (
              <div className="menu" onClick={() => setExportOpen(false)}>
                <div onClick={exportJson}>{t('exportJson')}</div>
                {g.activeSets.map(code => g.contexts.map(ctx => <div key={code + ctx.id} onClick={() => exportCsv(code, ctx, communityForCsv())}>{tx('exportCsvItem', { set: code.toUpperCase(), ctx: ctx.name })}</div>))}
                {g.activeSets.map(code => <div key={code} onClick={() => exportMarkdown(code, g.contexts, g.schemes)}>{tx('exportMdItem', { set: code.toUpperCase() })}</div>)}
                <div onClick={exportCurrentList}>{t('exportList')}</div>
                {FEATURES.links && <div onClick={exportGraph}>{t('exportGraph')}</div>}
              </div>
            )}
          </span>
          <label className="row"><button onClick={e => (e.currentTarget.nextElementSibling as HTMLInputElement).click()} title={t('importHint')}>{t('import')}</button><input type="file" accept="application/json" hidden onChange={e => doImport(e.target.files?.[0])} /></label>
          <button className="gear" data-tour="gear" onClick={openOptions} title={t('optionsBtn')} aria-label={t('optionsBtn')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg></button>
        </div>
      </div>

      <div className="dock-host">
        <DockviewReact components={DOCK_COMPONENTS} defaultTabComponent={DockTab} onReady={onReady} theme={themeLight} />
      </div>

      {latest && (
        <div className="update-banner">
          {tx('updateNew', { v: latest.version, cur: currentVersion() })} <a href={latest.zip} target="_blank" rel="noreferrer">{t('downloadZip')}</a> {t('updateHow')}
          {notesOf(latest) && <span className="sub"> · {notesOf(latest)}</span>}
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

// The shell is picked by the workspace-mode setting (⚙ Experimental). The options modal and the first-run tour
// sit above both, sharing the dock api of whichever shell is mounted.
function Root() {
  const g = useGrader()
  const dockRef = useRef<DockviewApi | null>(null)
  const [options, setOptions] = useState(false)
  const [guide, setGuide] = useState(false)
  const [guideAt, setGuideAt] = useState(0)
  const onboarded = useLiveQuery(() => getSetting<boolean>('onboarded', false), [])
  useEffect(() => { if (onboarded === false) setGuide(true) }, [onboarded])
  useEffect(() => { const open = (e: Event) => { setGuideAt(typeof (e as CustomEvent).detail === 'number' ? (e as CustomEvent).detail : 0); setGuide(true) }; window.addEventListener('sr:guide', open); return () => window.removeEventListener('sr:guide', open) }, [])
  if (!g.ready) return null
  const seed = (): SerializedQuery => DEFAULT_QUERY
  return (
    <>
      {g.workspaceMode === 'wired'
        ? <WiredShell key="wired" dockRef={dockRef} openOptions={() => setOptions(true)} />
        : <ClassicShell key="classic" dockRef={dockRef} openOptions={() => setOptions(true)} />}
      <OraclePopover />
      {options && <OptionsModal contexts={g.contexts} schemes={g.schemes} dock={{ api: () => dockRef.current, seed }} onClose={() => setOptions(false)} />}
      <CoachTour open={guide} startAt={guideAt} onClose={() => setGuide(false)} />
    </>
  )
}

export default function App() {
  return <GraderProvider><Root /></GraderProvider>
}
