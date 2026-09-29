// Dock topology for v0.13: FLAT docks + WIRES. Every panel is one kind (search · image · comment · oracle · graph).
// A search dock loads a card (double-click / Enter). An image / comment / oracle / graph dock FOLLOWS one search dock:
// its `channel` is that search dock's panel id, and the wire is drawn by the user — drag the port on the follower's
// tab onto a search dock. Pull the wire away and the follower freezes on the card it was showing (`own`). Nothing
// is labelled; hovering a port lights the group. Layout persists as one dockview JSON, params carry everything.
//
// Single-writer rule per params key: `q` + `sel` by ScopeProvider (search docks); `channel` / `linked` / `own` /
// `pinned` by the tab (port drag, pin) and by the follower itself when its search closes; `title` by the rename box.
import type { DockviewApi, IDockviewPanel } from 'dockview-react'
import { DEFAULT_QUERY, type SerializedQuery } from './query'

export type DockKind = 'search' | 'image' | 'comment' | 'oracle' | 'graph'
export const DOCK_KINDS: DockKind[] = ['search', 'image', 'comment', 'oracle', 'graph']
export type TabPlacement = 'right' | 'within'
// How the wire between a follower and its search is shown and made (⚙ → Display). Same data underneath.
//   wire = drag the dot on the tab onto a search (default) · chip = a letter per search, click to pick from a menu
//   icon = 🔗 / 🔓: click to stop following, click again then click a search
export type LinkStyle = 'wire' | 'chip' | 'icon'
export const LINK_PALETTE = ['#634496', '#0E68AB', '#00733E', '#D3202A', '#B8860B', '#5F4F66']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export type OracleLang = 'follow' | 'en' | 'zh'
export interface CardRef { set: string; oracleId: string }
export const sameRef = (a?: CardRef | null, b?: CardRef | null) => !!a && !!b && a.set === b.set && a.oracleId === b.oracleId

export interface DockParams {
  kind: DockKind
  channel: string               // followers: the search dock they follow (its panel id) · search docks: their own id
  linked: boolean               // followers: wire connected · search docks: always true
  own?: CardRef | null          // a follower's frozen card while its wire is pulled
  pinned?: boolean              // protect from ✕
  // search docks only
  scopeId?: string
  q?: SerializedQuery
  sel?: CardRef | null          // the highlighted card (selection ≠ loaded card)
}

export const COMPONENT: Record<DockKind, DockKind> = { search: 'search', image: 'image', comment: 'comment', oracle: 'oracle', graph: 'graph' }
type Params = Record<string, unknown> | undefined

export const asDock = (p: Params): DockParams => {
  const d = p as Partial<DockParams> | undefined
  const kind = (d?.kind && DOCK_KINDS.includes(d.kind) ? d.kind : 'search') as DockKind
  return {
    kind, channel: typeof d?.channel === 'string' ? d.channel : '', linked: kind === 'search' ? true : d?.linked !== false, own: d?.own ?? null, pinned: d?.pinned === true,
    scopeId: d?.scopeId ?? (kind === 'search' ? 'main' : undefined),
    q: kind === 'search' ? { ...DEFAULT_QUERY, ...(d?.q ?? {}) } : undefined,
    sel: d?.sel ?? null,
  }
}
export const kindOf = (p: IDockviewPanel): DockKind => asDock(p.params).kind
export const isSearchPanel = (p: IDockviewPanel) => kindOf(p) === 'search'
// search docks in a stable order (by the number in their id) — the letter a search shows in the chip style
export const searchDocks = (api: DockviewApi) => api.panels.filter(isSearchPanel).sort((a, b) => (parseInt(a.id.replace(/\D/g, ''), 10) || 0) - (parseInt(b.id.replace(/\D/g, ''), 10) || 0))
export const letterOf = (searches: IDockviewPanel[], id: string) => { const i = searches.findIndex(s => s.id === id); return i < 0 ? '?' : LETTERS[i % 26] }
export const colorOf = (searches: IDockviewPanel[], id: string) => LINK_PALETTE[Math.max(0, searches.findIndex(s => s.id === id)) % LINK_PALETTE.length]

// A saved workspace: the whole dockview layout (every dock's params ride inside) plus the card each search had loaded.
export interface Workspace { id: string; name: string; savedAt: number; layout: unknown; channelCards: Record<string, CardRef | null> }

export function nextPanelId(api: DockviewApi, prefix: string): string {
  const taken = new Set(api.panels.map(p => p.id))
  let n = 1
  while (taken.has(`${prefix}-${n}`)) n++
  return `${prefix}-${n}`
}
export function nextScopeId(api: DockviewApi): string {
  const taken = new Set(api.panels.filter(isSearchPanel).map(p => asDock(p.params).scopeId))
  if (!taken.has('main')) return 'main'
  let n = 2
  while (taken.has(`s${n}`)) n++
  return `s${n}`
}

export type Dir = 'right' | 'below' | 'left' | 'above' | 'within'
export interface AddDockOptions {
  kind: DockKind
  title: string
  channel?: string              // followers: the search dock to follow; omitted = frozen on `own`
  own?: CardRef | null
  q?: Partial<SerializedQuery>
  refId?: string
  direction?: Dir
  initialWidth?: number
  initialHeight?: number
  inactive?: boolean
}

// The one place a dock is ever minted. A search dock's channel is itself.
export function addDock(api: DockviewApi, o: AddDockOptions): string {
  const id = nextPanelId(api, o.kind)
  const ref = (o.refId ? api.getPanel(o.refId) : undefined) ?? api.activePanel ?? api.panels[0]
  const params: DockParams = o.kind === 'search'
    ? { kind: 'search', channel: id, linked: true, scopeId: nextScopeId(api), q: { ...DEFAULT_QUERY, ...(o.q ?? {}) }, sel: null }
    : { kind: o.kind, channel: o.channel ?? '', linked: !!o.channel, own: o.channel ? null : (o.own ?? null) }
  api.addPanel({
    id, component: COMPONENT[o.kind], title: o.title, params,
    position: ref && o.direction ? { referencePanel: ref.id, direction: o.direction } : undefined,
    ...(o.initialWidth ? { initialWidth: o.initialWidth } : {}), ...(o.initialHeight ? { initialHeight: o.initialHeight } : {}),
    ...(o.inactive ? { inactive: true } : {}),
  })
  return id
}

export interface Labels { search: string; image: string; comment: string; oracle: string; graph: string }

// Default workspace: search on the left · image top-right · comments bottom-right, both wired to the search.
// Returns the search dock's id (= its channel).
export function defaultLayout(api: DockviewApi, seed: SerializedQuery, L: Labels): string {
  api.clear()
  const w = Math.max(api.width, 1000), h = Math.max(api.height, 600)
  const right = Math.round(Math.min(600, Math.max(380, w * 0.42)))
  const s = addDock(api, { kind: 'search', title: L.search, q: seed })
  const i = addDock(api, { kind: 'image', title: L.image, channel: s, refId: s, direction: 'right', initialWidth: right })
  addDock(api, { kind: 'comment', title: L.comment, channel: s, refId: i, direction: 'below', initialHeight: Math.round(h * 0.48) })
  api.getPanel(s)?.api.setSize({ width: w - right })
  api.getPanel(i)?.api.setSize({ height: Math.round(h * 0.52) })
  api.getPanel(s)?.api.setActive()
  return s
}

// A new BLOCK: image + comments, either wired to `channel` or frozen on `own`, split beside `refId` (or stacked).
export function openBlock(api: DockviewApi, L: Labels, o: { channel?: string; own?: CardRef | null; refId?: string; placement: TabPlacement }): { image: string; comment: string } {
  const h = Math.max(api.height, 600)
  const image = addDock(api, { kind: 'image', title: L.image, channel: o.channel, own: o.own, refId: o.refId, direction: o.placement === 'right' ? 'right' : 'within', initialWidth: 480 })
  const comment = addDock(api, { kind: 'comment', title: L.comment, channel: o.channel, own: o.own, refId: image, direction: 'below', initialHeight: Math.round(h * 0.48) })
  api.getPanel(image)?.api.setSize({ height: Math.round(h * 0.52) })
  return { image, comment }
}

export const LAYOUT_VERSION = 5

// Anything older than v0.12 (v0.9.7 docks, v0.10 docks, v0.11 tabs) is rebuilt as the default workspace; only the
// first search's query and its card are carried over.
export function legacySeed(saved: unknown, seed: SerializedQuery): { q: SerializedQuery; card: CardRef | null } {
  const root = saved as { panels?: Record<string, { contentComponent?: string; params?: Record<string, unknown> }> } | null
  if (!root?.panels) return { q: seed, card: null }
  for (const p of Object.values(root.panels)) {
    const params = (p.params ?? {}) as { kind?: string; q?: Partial<SerializedQuery>; sel?: CardRef | null }
    if (params.kind === 'tab' || params.kind === 'browse' || p.contentComponent === 'browse') return { q: { ...seed, ...(params.q ?? {}) }, card: params.sel ?? null }
  }
  return { q: seed, card: null }
}

// v0.12 (layout v4) tied docks by four letter channels; v0.13 wires a follower to a search dock by its panel id.
// Each letter maps to the first search dock that drove it; followers of a letter nobody drives freeze on its card.
// Returns [searchId, letter] pairs so the caller can move the channel's card over.
export function migrateChannels(api: DockviewApi, cards: Record<string, CardRef | null>): [string, string][] {
  const byLetter = new Map<string, string>()
  for (const p of api.panels) { const d = asDock(p.params); if (d.kind === 'search' && d.channel && !byLetter.has(d.channel)) byLetter.set(d.channel, p.id) }
  for (const p of api.panels) {
    const cur = (p.params ?? {}) as Record<string, unknown>
    const d = asDock(cur)
    if (d.kind === 'search') { p.api.updateParameters({ ...cur, channel: p.id, linked: true }); continue }
    const to = byLetter.get(d.channel)
    if (d.linked && to) p.api.updateParameters({ ...cur, channel: to })
    else p.api.updateParameters({ ...cur, channel: to ?? '', linked: false, own: d.own ?? cards[d.channel] ?? null })
  }
  return [...byLetter.entries()].map(([letter, id]) => [id, letter])
}
