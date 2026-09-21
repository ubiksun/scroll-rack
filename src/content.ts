// scryfall.com content script. NO runtime imports (bundles as a plain script). Talks to background.ts via messages.
//  • card page  /card/{set}/{cn}/…  → floating, draggable panel: tiers per context · note · tags · links · 17lands
//  • search grid                     → tier badge on every .card-grid-item we have a rating for
import type { Badge, BadgeMap, Msg, OverlayCard, OverlayLookup } from './messages'

const send = <T,>(msg: Msg) => new Promise<T>(res => chrome.runtime.sendMessage(msg, res))
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e
}

type SectionId = 'rate' | 'note' | 'tags' | 'links' | 'community'
const ALL_SECTIONS: SectionId[] = ['rate', 'note', 'tags', 'links', 'community']
interface OverlayPrefs { x: number; y: number; collapsed: boolean; sections: SectionId[] }
const DEFAULT_PREFS: OverlayPrefs = { x: Math.max(16, window.innerWidth - 324), y: 72, collapsed: false, sections: ALL_SECTIONS }   // right edge, under Scryfall's header

async function loadPrefs(): Promise<OverlayPrefs> {
  const r = await chrome.storage.local.get('overlayPrefs')
  return { ...DEFAULT_PREFS, ...(r.overlayPrefs ?? {}) }
}
const savePrefs = (p: OverlayPrefs) => chrome.storage.local.set({ overlayPrefs: p })

// ---------- card page ----------
function parseCardUrl(): { set: string; cn: string } | null {
  const m = location.pathname.match(/^\/card\/([a-z0-9]+)\/([^/]+)/i)
  return m ? { set: m[1].toLowerCase(), cn: decodeURIComponent(m[2]) } : null
}

let panel: HTMLDivElement | null = null

async function renderCardPanel() {
  const where = parseCardUrl()
  if (!where) return
  const prefs = await loadPrefs()
  const data = await send<OverlayLookup>({ type: 'lookup', set: where.set, collectorNumber: where.cn })

  panel?.remove()
  panel = el('div', 'lg-panel')
  panel.style.left = `${prefs.x}px`; panel.style.top = `${prefs.y}px`
  if (prefs.collapsed) panel.classList.add('lg-collapsed')

  // header (drag handle)
  const head = el('div', 'lg-head')
  head.append(el('span', 'lg-title', 'Scroll Rack'))
  const tools = el('span', 'lg-tools')
  const gear = el('button', 'lg-btn', '⚙'); gear.title = 'sections'
  const openBtn = el('button', 'lg-btn', '↗'); openBtn.title = 'open Scroll Rack'
  const collapse = el('button', 'lg-btn', prefs.collapsed ? '▸' : '▾')
  tools.append(gear, openBtn, collapse); head.append(tools); panel.append(head)
  openBtn.onclick = () => void send({ type: 'openApp' })
  collapse.onclick = () => { prefs.collapsed = !prefs.collapsed; panel!.classList.toggle('lg-collapsed', prefs.collapsed); collapse.textContent = prefs.collapsed ? '▸' : '▾'; void savePrefs(prefs) }

  // drag
  let drag: { dx: number; dy: number } | null = null
  head.onpointerdown = e => { if ((e.target as HTMLElement).tagName === 'BUTTON') return; drag = { dx: e.clientX - panel!.offsetLeft, dy: e.clientY - panel!.offsetTop }; head.setPointerCapture(e.pointerId) }
  head.onpointermove = e => { if (!drag) return; prefs.x = Math.max(0, e.clientX - drag.dx); prefs.y = Math.max(0, e.clientY - drag.dy); panel!.style.left = `${prefs.x}px`; panel!.style.top = `${prefs.y}px` }
  head.onpointerup = () => { if (drag) { drag = null; void savePrefs(prefs) } }

  const body = el('div', 'lg-body'); panel.append(body)

  // section chooser (modular: toggle + reorder)
  const chooser = el('div', 'lg-chooser'); chooser.hidden = true
  const drawChooser = () => {
    chooser.replaceChildren()
    for (const id of ALL_SECTIONS) {
      const row = el('div', 'lg-chooser-row')
      const cb = el('input') as HTMLInputElement; cb.type = 'checkbox'; cb.checked = prefs.sections.includes(id)
      cb.onchange = () => { prefs.sections = cb.checked ? ALL_SECTIONS.filter(s => prefs.sections.includes(s) || s === id) : prefs.sections.filter(s => s !== id); void savePrefs(prefs); drawBody() }
      const up = el('button', 'lg-btn', '↑'), dn = el('button', 'lg-btn', '↓')
      up.onclick = () => { const i = prefs.sections.indexOf(id); if (i > 0) { [prefs.sections[i - 1], prefs.sections[i]] = [prefs.sections[i], prefs.sections[i - 1]]; void savePrefs(prefs); drawChooser(); drawBody() } }
      dn.onclick = () => { const i = prefs.sections.indexOf(id); if (i >= 0 && i < prefs.sections.length - 1) { [prefs.sections[i + 1], prefs.sections[i]] = [prefs.sections[i], prefs.sections[i + 1]]; void savePrefs(prefs); drawChooser(); drawBody() } }
      row.append(cb, el('span', '', id), up, dn); chooser.append(row)
    }
  }
  gear.onclick = () => { chooser.hidden = !chooser.hidden; if (!chooser.hidden) drawChooser() }
  panel.append(chooser)

  const drawBody = () => {
    body.replaceChildren()
    if (!data.found) {
      body.append(el('div', 'lg-muted', data.setLoaded ? `Not in cached ${data.set.toUpperCase()} (re-fetch the set in the grader).` : `Set ${data.set.toUpperCase()} not loaded.`))
      if (!data.setLoaded) {
        const b = el('button', 'lg-btn lg-wide', `Load ${data.set.toUpperCase()} now`)
        b.onclick = async () => { b.textContent = 'loading…'; b.disabled = true; await send({ type: 'fetchSet', set: data.set }); void renderCardPanel() }
        body.append(b)
      }
      return
    }
    for (const id of prefs.sections) body.append(section(id, data))
  }
  drawBody()
  document.body.append(panel)
}

function section(id: SectionId, d: OverlayCard): HTMLElement {
  const wrap = el('div', 'lg-sec')
  switch (id) {
    case 'rate': {
      for (const ctx of d.contexts) {
        const scheme = d.schemes.find(s => s.id === ctx.schemeId) ?? d.schemes[0]
        const r = d.ratings.find(x => x.context === ctx.id)
        const row = el('div', `lg-ctx${ctx.id === d.activeContext ? ' lg-active' : ''}`)
        row.append(el('span', 'lg-ctx-name', ctx.name))
        const tiers = el('span', 'lg-tiers')
        for (const tier of scheme?.tiers ?? []) {
          const b = el('button', 'lg-tier', tier.name)
          b.style.borderColor = tier.color
          if (r?.tier === tier.name) { b.style.background = tier.color; b.classList.add('lg-on') }
          b.onclick = async () => {
            const next = r?.tier === tier.name ? null : tier.name
            await send({ type: 'rate', set: d.set, oracleId: d.oracleId, context: ctx.id, tier: next })
            if (r) r.tier = next; else d.ratings.push({ context: ctx.id, tier: next, note: '' })
            tiers.querySelectorAll<HTMLButtonElement>('.lg-tier').forEach(x => { x.classList.remove('lg-on'); x.style.background = '' })
            if (next) { b.classList.add('lg-on'); b.style.background = tier.color }
            void renderCardImageBadges()
          }
          tiers.append(b)
        }
        row.append(tiers); wrap.append(row)
      }
      break
    }
    case 'note': {
      const r = d.ratings.find(x => x.context === d.activeContext)
      const ta = el('textarea', 'lg-note') as HTMLTextAreaElement
      ta.placeholder = `notes — ${d.contexts.find(c => c.id === d.activeContext)?.name ?? d.activeContext}`
      ta.value = r?.note ?? ''
      let h: number | undefined
      ta.oninput = () => { clearTimeout(h); h = window.setTimeout(() => void send({ type: 'note', set: d.set, oracleId: d.oracleId, context: d.activeContext, note: ta.value }), 500) }
      wrap.append(ta)
      break
    }
    case 'tags': {
      const chips = el('div', 'lg-chips')
      const draw = () => {
        chips.replaceChildren()
        for (const tg of d.tags) {
          const c = el('span', 'lg-chip', `#${tg}`)
          const x = el('span', 'lg-x', '✕'); x.onclick = async () => { await send({ type: 'tag', oracleId: d.oracleId, tag: tg, remove: true }); d.tags = d.tags.filter(z => z !== tg); draw() }
          c.append(x); chips.append(c)
        }
        const inp = el('input', 'lg-tag-in') as HTMLInputElement; inp.placeholder = 'add tag…'
        inp.onkeydown = async e => { if (e.key === 'Enter' && inp.value.trim()) { const tg = inp.value.trim().toLowerCase().replace(/^#/, ''); await send({ type: 'tag', oracleId: d.oracleId, tag: tg }); if (!d.tags.includes(tg)) d.tags.push(tg); draw() } }
        chips.append(inp)
      }
      draw(); wrap.append(chips)
      break
    }
    case 'links': {
      wrap.append(el('div', 'lg-h', `Links (${d.links.length})`))
      for (const l of d.links) {
        const row = el('div', 'lg-link')
        const a = el('a', 'lg-name', l.name); a.href = `https://scryfall.com/search?q=${encodeURIComponent(`!"${l.name}"`)}`
        row.append(a); for (const tg of l.tags) row.append(el('span', 'lg-type', `#${tg}`))
        if (l.note) { const n = el('span', 'lg-muted', ' ✎'); n.title = l.note; row.append(n) }
        wrap.append(row)
      }
      if (!d.links.length) wrap.append(el('div', 'lg-muted', 'no links — add them in the grader'))
      break
    }
    case 'community': {
      wrap.append(el('div', 'lg-h', '17lands'))
      if (!d.community) { wrap.append(el('div', 'lg-muted', 'no snapshot for this set')); break }
      const c = d.community
      const pct = (v: number | null) => v == null ? '—' : `${(v * 100).toFixed(1)}%`
      const kv = el('div', 'lg-kv')
      const add = (k: string, v: string) => { kv.append(el('b', '', k), el('span', '', v)) }
      add('GIH WR', `${pct(c.gih)}${c.percentile != null ? ` (P${c.percentile})` : ''}`)
      add('OH WR', pct(c.oh)); add('IWD', c.iwd == null ? '—' : `${(c.iwd * 100).toFixed(1)}pp`)
      add('ALSA / ATA', `${c.alsa?.toFixed(2) ?? '—'} / ${c.ata?.toFixed(2) ?? '—'}`); add('Games', c.games.toLocaleString())
      wrap.append(kv)
      break
    }
  }
  return wrap
}

// ---------- badges on card images ----------
function badgeStack(badges: Badge[]): HTMLElement {
  const wrap = el('span', 'lg-badgewrap')
  const corners: Record<string, Badge[]> = { tl: [], tr: [], bl: [], br: [] }
  for (const b of badges) corners[b.style?.pos ?? 'tl'].push(b)
  for (const [pos, list] of Object.entries(corners)) {
    if (!list.length) continue
    const stack = el('span', `lg-badges lg-pos-${pos}`)
    for (const b of list) { const x = el('span', `lg-badge lg-shape-${b.style?.shape ?? 'pill'} lg-size-${b.style?.size ?? 'm'}`, b.style?.label === 'full' ? `${b.ctx}: ${b.tier}` : b.tier); x.style.background = b.color; x.title = `${b.ctx}: ${b.tier}`; stack.append(x) }
    wrap.append(stack)
  }
  return wrap
}

// Search grid: one stack per .card-grid-item
async function renderGridBadges() {
  const items = [...document.querySelectorAll<HTMLElement>('.card-grid-item[data-card-id]')].filter(x => !x.dataset.lgDone)
  if (!items.length) return
  const ids = items.map(x => x.dataset.cardId!)
  const map = await send<BadgeMap>({ type: 'badges', printingIds: ids })
  for (const item of items) {
    item.dataset.lgDone = '1'
    const b = map[item.dataset.cardId!]
    if (!b?.length) continue
    item.style.position = 'relative'; item.append(badgeStack(b))
  }
}

// Card page: stack on the main card image. Re-run after rating from the panel so it updates live.
async function renderCardImageBadges() {
  const where = parseCardUrl(); if (!where) return
  const face = document.querySelector<HTMLElement>('.card-image-front') ?? document.querySelector<HTMLElement>('.card-image')
  if (!face) return
  face.querySelectorAll('.lg-badgewrap').forEach(x => x.remove())
  const b = await send<Badge[]>({ type: 'badgesForCard', set: where.set, collectorNumber: where.cn })
  if (!b?.length) return
  face.style.position = 'relative'; face.append(badgeStack(b))
}

// ---------- boot ----------
function boot() {
  if (parseCardUrl()) { void renderCardPanel(); void renderCardImageBadges() }
  void renderGridBadges()
  new MutationObserver(() => void renderGridBadges()).observe(document.body, { childList: true, subtree: true })
}
boot()
