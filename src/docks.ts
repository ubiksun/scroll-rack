// Dock topology for v0.10. Every panel describes itself through dockview `params`, which round-trip through
// toJSON/fromJSON — so the whole multi-dock workspace persists inside the existing `dockLayout` setting, with no new
// Dexie table and no new settings key (bar the `dockLayoutV` migration stamp).
//
// Three kinds:
//   browse — owns a query (its own search box, filters, sort, selection)
//   card   — bound to ONE card by value; `primary:true` marks it as a browse dock's preview slot (VS Code semantics)
//   oracle — mirrors an owner card dock (ownerId), or follows the focused card dock when ownerId is null
import type { DockviewApi, IDockviewPanel } from 'dockview-react'
import type { Card } from './db'
import { DEFAULT_QUERY, type SerializedQuery } from './query'

export type OracleMode = 'shared' | 'attached' | 'section'
export type OracleLang = 'follow' | 'en' | 'zh'

export interface BrowseParams {
  kind: 'browse'
  pinned?: boolean
  scopeId: string
  q: SerializedQuery
  sel?: { set: string; oracleId: string } | null
}
export interface CardParams {
  kind: 'card'
  pinned?: boolean
  scopeId?: string                                 // which browse dock opened it
  primary?: boolean                                // true = that browse dock's preview slot (replaceable)
  set?: string
  oracleId?: string
}
export interface OracleParams {
  kind: 'oracle'
  pinned?: boolean
  ownerId?: string | null                          // null = shared mode: follow the focused card dock
}

// Component names are deliberately the v0.9.7 ones: a saved layout looks components up by contentComponent, and
// renaming any of them would make fromJSON throw and wipe the user's layout.
export const COMPONENT = { browse: 'browse', card: 'detail', oracle: 'oracle', graph: 'graph' } as const

type Params = Record<string, unknown> | undefined

export const asBrowse = (p: Params): BrowseParams => {
  const b = p as Partial<BrowseParams> | undefined
  return { kind: 'browse', scopeId: b?.scopeId ?? 'main', q: { ...DEFAULT_QUERY, ...(b?.q ?? {}) }, sel: b?.sel ?? null, pinned: b?.pinned === true }
}
export const asCard = (p: Params): CardParams => {
  const c = p as Partial<CardParams> | undefined
  return { kind: 'card', scopeId: c?.scopeId, primary: c?.primary === true, set: c?.set, oracleId: c?.oracleId, pinned: c?.pinned === true }
}
export const asOracle = (p: Params): OracleParams => {
  const o = p as Partial<OracleParams> | undefined
  return { kind: 'oracle', ownerId: o?.ownerId ?? null, pinned: o?.pinned === true }
}

const kindOf = (p: IDockviewPanel): string | undefined => (p.params as { kind?: string } | undefined)?.kind
export const isBrowsePanel = (p: IDockviewPanel) => kindOf(p) === 'browse' || p.api.component === COMPONENT.browse
export const isCardPanel = (p: IDockviewPanel) => kindOf(p) === 'card' || p.api.component === COMPONENT.card
export const isOraclePanel = (p: IDockviewPanel) => kindOf(p) === 'oracle' || p.api.component === COMPONENT.oracle

export function nextPanelId(api: DockviewApi, prefix: string): string {
  const taken = new Set(api.panels.map(p => p.id))
  let n = 1
  while (taken.has(`${prefix}-${n}`)) n++
  return `${prefix}-${n}`
}
// The first scope is always 'main' — a fresh install and a migrated legacy layout then agree.
export function nextScopeId(api: DockviewApi): string {
  const taken = new Set(api.panels.filter(isBrowsePanel).map(p => asBrowse(p.params).scopeId))
  if (!taken.has('main')) return 'main'
  let n = 2
  while (taken.has(`s${n}`)) n++
  return `s${n}`
}

export const browsePanelFor = (api: DockviewApi, scopeId: string) =>
  api.panels.find(p => isBrowsePanel(p) && asBrowse(p.params).scopeId === scopeId)
export const primaryCardFor = (api: DockviewApi, scopeId: string) =>
  api.panels.find(p => isCardPanel(p) && asCard(p.params).primary && asCard(p.params).scopeId === scopeId)
export const oracleFor = (api: DockviewApi, ownerId: string) =>
  api.panels.find(p => isOraclePanel(p) && asOracle(p.params).ownerId === ownerId)
export const sharedOracle = (api: DockviewApi) =>
  api.panels.find(p => isOraclePanel(p) && !asOracle(p.params).ownerId)

export function addBrowseDock(api: DockviewApi, seed?: Partial<SerializedQuery>): string {
  const id = nextPanelId(api, 'browse')
  const n = api.panels.filter(isBrowsePanel).length + 1
  const ref = api.panels.find(isBrowsePanel) ?? api.panels[0]
  api.addPanel({
    id, component: COMPONENT.browse, title: `Search ${n}`,
    params: { kind: 'browse', scopeId: nextScopeId(api), q: { ...DEFAULT_QUERY, ...(seed ?? {}) }, sel: null } satisfies BrowseParams,
    position: ref ? { referencePanel: ref.id, direction: 'within' } : undefined,
  })
  return id
}

export function addOracleDock(api: DockviewApi, ownerId: string | null, title: string): string {
  const id = nextPanelId(api, 'oracle')
  const ref = ownerId ? api.getPanel(ownerId) : (api.panels.find(isCardPanel) ?? api.panels[0])
  api.addPanel({
    id, component: COMPONENT.oracle, title,
    params: { kind: 'oracle', ownerId } satisfies OracleParams,
    position: ref ? { referencePanel: ref.id, direction: 'below' } : undefined,
    initialHeight: 220,
  })
  return id
}

export type OpenMode = 'primary' | 'new' | 'replace'

// The one place a card ever lands in a dock. 'primary' replaces the scope's preview slot in place (and does NOT steal
// focus, so you can keep arrowing through the grid); 'new' mints an inert dock nothing will ever replace (⌘-click).
export function openCard(
  api: DockviewApi,
  card: Card,
  o: { mode: OpenMode; scopeId?: string; selfId?: string; title: string; oracleMode?: OracleMode; place?: 'within' | 'below' },
): string | undefined {
  const bound = { set: card.set, oracleId: card.oracleId }
  if (o.mode === 'replace') {
    const self = o.selfId ? api.getPanel(o.selfId) : undefined
    if (!self) return undefined
    self.api.updateParameters({ ...asCard(self.params), ...bound })
    self.api.setTitle(o.title)
    return self.id
  }
  if (o.mode === 'primary' && o.scopeId) {
    const slot = primaryCardFor(api, o.scopeId)
    if (slot) {
      slot.api.updateParameters({ ...asCard(slot.params), ...bound })
      slot.api.setTitle(o.title)
      return slot.id
    }
  }
  const id = nextPanelId(api, 'card')
  const primary = o.mode === 'primary'
  const ref = primary
    ? (o.scopeId ? browsePanelFor(api, o.scopeId) : undefined) ?? api.panels.find(isBrowsePanel) ?? api.panels[0]
    : (o.scopeId ? primaryCardFor(api, o.scopeId) : undefined) ?? api.panels.find(isCardPanel) ?? api.panels[0]
  api.addPanel({
    id, component: COMPONENT.card, title: o.title,
    params: { kind: 'card', scopeId: o.scopeId, primary, ...bound } satisfies CardParams,
    // ⌘-click splits BELOW the preview slot (the point is seeing two cards at once); the toolbar's + Card stacks
    // as a sibling tab in the existing card dock, matching how + Search behaves.
    position: ref ? { referencePanel: ref.id, direction: primary ? 'right' : (o.place ?? 'below') } : undefined,
    ...(primary ? { initialWidth: 380, inactive: true } : {}),
  })
  if (o.oracleMode === 'attached') addOracleDock(api, id, `Oracle · ${o.title}`)
  return id
}

// Close the oracle dock that belongs to a card dock (attached mode). Deferred a tick: this is called from dockview's
// own onDidRemovePanel, and closing a second panel inside that mutation throws "invalid operation".
export function closeCompanions(api: DockviewApi, cardPanelId: string) {
  const companion = oracleFor(api, cardPanelId)
  if (companion) setTimeout(() => { if (api.getPanel(companion.id)) companion.api.close() }, 0)
}

export const LAYOUT_VERSION = 2

// v0.9.7 layouts have panel ids browse / detail / oracle and NO params. Their shape is already what the new model
// wants (one browse driving one preview slot, oracle beneath it), so migration only ANNOTATES: nothing is added,
// removed, moved or resized. asBrowse/asCard/asOracle defaulting is the second net if this never runs.
export function migrateLayout(saved: unknown, legacyQ: SerializedQuery, oracleMode: OracleMode): unknown {
  const root = saved as { panels?: Record<string, { contentComponent?: string; params?: Record<string, unknown> }> } | null
  if (!root?.panels) return saved
  const detailId = Object.keys(root.panels).find(id => root.panels![id].contentComponent === COMPONENT.card)
  for (const [, p] of Object.entries(root.panels)) {
    if ((p.params as { kind?: string } | undefined)?.kind) continue          // already v2
    switch (p.contentComponent) {
      case COMPONENT.browse:
      case COMPONENT.graph:
        p.params = { ...(p.params ?? {}), kind: 'browse', scopeId: 'main', q: legacyQ, sel: null }
        break
      case COMPONENT.card:
        p.params = { ...(p.params ?? {}), kind: 'card', scopeId: 'main', primary: true }
        break
      case COMPONENT.oracle:
        p.params = { ...(p.params ?? {}), kind: 'oracle', ownerId: oracleMode === 'attached' ? (detailId ?? null) : null }
        break
    }
  }
  return saved
}

// After a restore: a preview slot whose browse dock is gone degrades to a pinned card view. Never deletes a dock.
export function resolveOrphans(api: DockviewApi) {
  const scopes = new Set(api.panels.filter(isBrowsePanel).map(p => asBrowse(p.params).scopeId))
  for (const p of api.panels) {
    if (!isCardPanel(p)) continue
    const c = asCard(p.params)
    if (c.primary && c.scopeId && !scopes.has(c.scopeId)) p.api.updateParameters({ ...c, primary: false })
  }
}
