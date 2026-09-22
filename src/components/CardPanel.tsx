import { Fragment, useEffect, useMemo, useState } from 'react'
import { db, upsertRating, addTag, removeTag, addEdge as dbAddEdge, tagEdge, type ArtMode, type ArtPref, type Card, type CardTag, type CommunityRow, type CommunityTagsRow, type Context, type Edge, type Rating, type Scheme } from '../db'
import { pct } from '../api/seventeen'
import { FEATURES } from '../features'
import { t } from '../i18n'
import ArtPicker from './ArtPicker'

// Fixed sections + one collapsible block per rating context (each with tiers + its own note).
export const PANEL_SECTIONS = ['image', 'contexts', 'tags', 'links', 'oracle', 'community'] as const
export type SectionId = typeof PANEL_SECTIONS[number]

interface Props {
  domId: string                       // this dock's panel id — prefixes every DOM id (N CardPanels can be mounted)
  card: Card
  contexts: Context[]
  schemes: Scheme[]
  ratings: Rating[]                   // all contexts for this card
  tags: CardTag[]
  allTags: string[]
  allCards: Card[]
  edges: Edge[]
  cardsByOracle: Map<string, Card>
  community: { row: CommunityRow | undefined; percentile: number | undefined; fetchedAt?: number; onRefresh: () => void } | null
  onJump: (oracleId: string) => void
  onClose: () => void
  image: string
  artPref: ArtPref | undefined
  artMode: ArtMode
  onSetArt: (printingId: string | null) => void
  sections: SectionId[]
  onReorderSection: (id: SectionId, toIndex: number) => void
  collapsed: Set<string>              // collapsed block ids (context ids, 'links', 'oracle', 'tags')
  onToggleCollapse: (id: string) => void
  heights: Record<string, number>     // per-section height in px — the user drags the section's bottom-right corner
  onResizeSection: (id: string, px: number | null) => void
  hideImage?: boolean                 // Card view: the big image is on the left already
  communityTags?: CommunityTagsRow | null   // Scryfall Tagger (experimental); undefined = feature off
  onRefreshCommunity?: () => void
  display?: { name: string; type: string; original?: string }   // localized name/type (大學院廢墟); original = English name when different
  pair?: { partner: Card; partnerName?: string; setting: 'auto' | 'off' | undefined; onSetSetting: (v: 'auto' | 'off') => void; onShowOnce: () => void; onJump: () => void }
}


function ContextBlock({ uid, card, ctx, scheme, rating, open, onToggle, onDropCtx, dropSide, onDragCtx, onOverCtx }: { uid: (s: string) => string; card: Card; ctx: Context; scheme: Scheme | undefined; rating: Rating | undefined; open: boolean; onToggle: () => void; onDropCtx: (fromId: string) => void; dropSide: string; onDragCtx: (id: string | null) => void; onOverCtx: (id: string | null) => void }) {
  const [note, setNote] = useState(rating?.note ?? '')
  useEffect(() => { setNote(rating?.note ?? '') }, [card.id, ctx.id])
  useEffect(() => {
    if (note === (rating?.note ?? '')) return
    const h = setTimeout(() => { void upsertRating(card.set, card.oracleId, ctx.id, { note }) }, 500)
    return () => clearTimeout(h)
  }, [note])
  const tier = scheme?.tiers.find(x => x.name === rating?.tier)
  return (
    <div className={`block${dropSide}`}
      onDragOver={e => { e.preventDefault(); onOverCtx(ctx.id) }}
      onDragLeave={() => onOverCtx(null)}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); onOverCtx(null); onDragCtx(null); const from = e.dataTransfer.getData('text/context'); if (from && from !== ctx.id) onDropCtx(from) }}>
      <div className="block-head draggable" draggable onClick={onToggle}
        onDragStart={e => { e.stopPropagation(); onDragCtx(ctx.id); e.dataTransfer.setData('text/context', ctx.id); e.dataTransfer.effectAllowed = 'move' }}
        onDragEnd={() => { onDragCtx(null); onOverCtx(null) }}
        title="click to collapse · drag to reorder">
        <span className="caret">{open ? '▾' : '▸'}</span>
        <b>{ctx.name}</b>
        {tier && <span className="badge-inline" style={{ background: tier.color }}>{tier.name}</span>}
        {!open && rating?.note && <span className="sub ell">{rating.note}</span>}
      </div>
      {open && (
        <div className="block-body">
          <div className="tiers">
            {scheme?.tiers.map(x => (
              <button key={x.name} onClick={() => upsertRating(card.set, card.oracleId, ctx.id, { tier: rating?.tier === x.name ? null : x.name })}
                className={rating?.tier === x.name ? 'active' : ''}
                style={rating?.tier === x.name ? { background: x.color, borderColor: x.color } : { borderColor: x.color }}>{x.name}</button>
            ))}
          </div>
          <textarea id={uid(`note-${ctx.id}`)} placeholder={`${ctx.name} — ${t('notes')}`} value={note} onChange={e => setNote(e.target.value)} />
        </div>
      )}
    </div>
  )
}

export default function CardPanel(p: Props) {
  const { domId, card, contexts, schemes, ratings, tags, allTags, allCards, edges, cardsByOracle, community, onJump, onClose, image, artPref, artMode, onSetArt, sections, onReorderSection, collapsed, onToggleCollapse, heights, onResizeSection, hideImage, communityTags, onRefreshCommunity, pair, display } = p
  const uid = (s: string) => `${domId}-${s}`
  const [askPair, setAskPair] = useState(false)
  const [q, setQ] = useState('')
  const [tagQ, setTagQ] = useState('')
  const [edgeNote, setEdgeNote] = useState('')
  const [edgeTagQ, setEdgeTagQ] = useState<Record<number, string>>({})
  const [dragSec, setDragSec] = useState<SectionId | null>(null)      // section being dragged
  const [overSec, setOverSec] = useState<SectionId | null>(null)      // section it is hovering over
  const [dragCtx, setDragCtx] = useState<string | null>(null)
  const [overCtx, setOverCtx] = useState<string | null>(null)
  useEffect(() => { setQ(''); setEdgeNote(''); setTagQ(''); setEdgeTagQ({}) }, [card.id])
  const allEdgeTags = useMemo(() => [...new Set(edges.flatMap(e => e.tags))].sort(), [edges])

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const linked = new Set(edges.map(e => (e.a === card.oracleId ? e.b : e.a)))
    return allCards.filter(c => c.oracleId !== card.oracleId && !linked.has(c.oracleId) && c.name.toLowerCase().includes(s)).slice(0, 12)
  }, [q, allCards, edges, card.oracleId])
  const tagSuggestions = useMemo(() => {
    const s = tagQ.trim().toLowerCase(); const have = new Set(tags.map(x => x.tag))
    return allTags.filter(x => !have.has(x) && (!s || x.includes(s))).slice(0, 8)
  }, [tagQ, allTags, tags])
  const addEdge = async (target: Card) => {
    await dbAddEdge(card.oracleId, target.oracleId, edgeNote.trim())
    setQ(''); setEdgeNote('')
  }

  // drag a rating dimension onto another → renumber the whole list so the dropped one lands at that position
  const reorderContext = async (fromId: string, toIndex: number) => {
    const sorted = [...contexts].sort((a, b) => a.order - b.order)
    const from = sorted.findIndex(c => c.id === fromId)
    if (from < 0 || from === toIndex) return
    const next = [...sorted]; next.splice(from, 1); next.splice(toIndex, 0, sorted[from])
    await db.transaction('rw', db.contexts, async () => {
      for (let i = 0; i < next.length; i++) if (next[i].order !== i) await db.contexts.update(next[i].id, { order: i })
    })
  }

  // The title IS the control: click to collapse, drag it to reorder the sections. No ↑/↓ buttons.
  const head = (id: SectionId, title: string) => (
    <div className="block-head draggable" draggable onClick={() => onToggleCollapse(id)}
      onDragStart={e => { setDragSec(id); e.dataTransfer.setData('text/section', id); e.dataTransfer.effectAllowed = 'move' }}
      onDragEnd={() => { setDragSec(null); setOverSec(null) }}
      title="click to collapse · drag to reorder">
      <span className="caret">{collapsed.has(id) ? '▸' : '▾'}</span>
      <b>{title}</b>
      <span className="sec-move" onClick={e => e.stopPropagation()}>
        {heights[id] && <button onClick={() => onResizeSection(id, null)} title="fit to content">⤢</button>}
      </span>
    </div>
  )

  // Sections are user-resizable. An explicit full-width grip at the bottom rather than the native CSS `resize`
  // corner: a section taller than the panel puts that corner outside the scroll viewport, where it can never be
  // grabbed. Drag the grip; ⤢ in the header clears the stored height and goes back to fitting the content.
  const box = (id: SectionId, children: React.ReactNode) => {
    const h = heights[id]
    // live drop indicator: the target shows a line on the side the dragged section will land on
    const dropSide = dragSec && overSec === id && dragSec !== id
      ? (sections.indexOf(dragSec) < sections.indexOf(id) ? ' drop-after' : ' drop-before')
      : ''
    return (
      <div className={`section sizable${h ? ' sized' : ''}${dropSide}`} key={id} style={h ? { height: h } : undefined}
        onDragOver={e => { e.preventDefault(); if (overSec !== id) setOverSec(id) }}
        onDragLeave={() => setOverSec(cur => (cur === id ? null : cur))}
        onDrop={e => {
          e.preventDefault(); setOverSec(null); setDragSec(null)
          const from = e.dataTransfer.getData('text/section') as SectionId
          if (from && from !== id) onReorderSection(from, sections.indexOf(id))
        }}>
        {children}
      </div>
    )
  }

  const render = (id: SectionId) => {
    switch (id) {
      case 'image':
        if (hideImage) return null
        return box(id, (
          <>
            {head(id, t('imageSection'))}
            {!collapsed.has(id) && <ArtPicker card={card} src={image} className="big" artPref={artPref} artMode={artMode} onSetArt={onSetArt} />}
          </>
        ))
      case 'contexts':
        return box(id, (
          <>
            {head(id, t('ratingsSection'))}
            {!collapsed.has(id) && contexts.map((ctx, i) => (
              <ContextBlock key={ctx.id} uid={uid} card={card} ctx={ctx} scheme={schemes.find(s => s.id === ctx.schemeId)} rating={ratings.find(r => r.context === ctx.id)}
                open={!collapsed.has(ctx.id)} onToggle={() => onToggleCollapse(ctx.id)}
                onDropCtx={from => reorderContext(from, i)}
                dropSide={dragCtx && overCtx === ctx.id && dragCtx !== ctx.id
                  ? (contexts.findIndex(x => x.id === dragCtx) < i ? ' drop-after' : ' drop-before') : ''}
                onDragCtx={setDragCtx} onOverCtx={setOverCtx} />
            ))}
          </>
        ))
      case 'tags':
        return box(id, (
          <>
            {head(id, `${t('tags')} (${tags.length})`)}
            {!collapsed.has(id) && <>
              <div className="chips">
                {tags.map(x => <span className="chip" key={x.key}>#{x.tag}<span className="x" onClick={() => removeTag(card.oracleId, x.tag)}>✕</span></span>)}
                <span className="typeahead">
                  <input placeholder={t('addTag')} value={tagQ} onChange={e => setTagQ(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && tagQ.trim()) { void addTag(card.oracleId, tagQ); setTagQ('') } }} />
                  {tagQ && tagSuggestions.length > 0 && <div className="search-results">{tagSuggestions.map(s => <div key={s} onClick={() => { void addTag(card.oracleId, s); setTagQ('') }}>#{s}</div>)}</div>}
                </span>
              </div>
              {communityTags !== undefined && (
                <div className="tagger">
                  <div className="sub row" style={{ gap: 6 }}><span>◈ Scryfall Tagger</span>{communityTags && <span>· {new Date(communityTags.fetchedAt).toLocaleDateString()}</span>}<button onClick={onRefreshCommunity} title="re-fetch">↻</button></div>
                  {communityTags === null && <div className="sub">loading… (or unavailable)</div>}
                  {communityTags && communityTags.cardTags.length === 0 && <div className="sub">no card tags yet</div>}
                  {communityTags && communityTags.cardTags.length > 0 && (
                    <div className="chips">
                      {communityTags.cardTags.map(tg => {
                        const mine = tags.some(x => x.tag === tg.toLowerCase())
                        return <span className={`chip tagger-chip${mine ? ' adopted' : ''}`} key={tg} title={mine ? 'already in your tags' : 'click + to add to your tags (stays here too)'}>{tg} <span className="ico">◈</span>{!mine && <span className="x add" onClick={() => addTag(card.oracleId, tg)}>+</span>}{mine && <span className="x">✓</span>}</span>
                      })}
                    </div>
                  )}
                  {communityTags && communityTags.relationships.length > 0 && (
                    <div className="sub" style={{ marginTop: 4 }}>{communityTags.relationships.map((r, i) => <span key={i}>{r.kind} <b>{r.name}</b>{i < communityTags.relationships.length - 1 ? ' · ' : ''}</span>)}</div>
                  )}
                </div>
              )}
            </>}
          </>
        ))
      case 'links':
        if (!FEATURES.links) return null
        return box(id, (
          <>
            {head(id, `${t('links')} (${edges.length})`)}
            {!collapsed.has(id) && <>
              {edges.map(e => {
                const otherId = e.a === card.oracleId ? e.b : e.a
                const other = cardsByOracle.get(otherId)
                const tq = edgeTagQ[e.id!] ?? ''
                return (
                  <div className="edge" key={e.id}>
                    <div className="edge-row">
                      <span className="name" onClick={() => onJump(otherId)}>{other?.name ?? otherId}</span>
                      {e.source !== 'manual' && <span className="type">{e.source}</span>}
                      {e.note && <span className="sub" title={e.note}>✎</span>}
                      <span className="x" role="button" onClick={() => e.id !== undefined && db.edges.delete(e.id)}>✕</span>
                    </div>
                    <div className="chips small">
                      {e.tags.map(tg => <span className="chip" key={tg}>#{tg}<span className="x" onClick={() => tagEdge(e.id!, tg, true)}>✕</span></span>)}
                      <input placeholder="+ tag" value={tq} list={uid(`edge-tags-${e.id}`)} onChange={ev => setEdgeTagQ(m => ({ ...m, [e.id!]: ev.target.value }))}
                        onKeyDown={ev => { if (ev.key === 'Enter' && tq.trim()) { void tagEdge(e.id!, tq); setEdgeTagQ(m => ({ ...m, [e.id!]: '' })) } }} />
                      <datalist id={uid(`edge-tags-${e.id}`)}>{allEdgeTags.filter(x => !e.tags.includes(x)).map(x => <option key={x} value={x} />)}</datalist>
                    </div>
                  </div>
                )
              })}
              <div className="row" style={{ marginTop: 6 }}>
                <input placeholder={t('why')} value={edgeNote} onChange={e => setEdgeNote(e.target.value)} style={{ flex: 1 }} />
              </div>
              <span className="typeahead block">
                <input placeholder={t('linkTo')} value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
                {results.length > 0 && <div className="search-results">{results.map(c => <div key={c.id} onClick={() => addEdge(c)}>{c.name} <span className="sub">({c.set.toUpperCase()})</span></div>)}</div>}
              </span>
            </>}
          </>
        ))
      case 'oracle':
        return box(id, (
          <>
            {head(id, t('oracle'))}
            {!collapsed.has(id) && <>
              <div className="oracle">{card.oracleText}</div>
              {card.keywords.length > 0 && <div className="sub" style={{ marginTop: 6 }}>{t('keywords')}: {card.keywords.join(', ')}</div>}
            </>}
          </>
        ))
      case 'community':
        if (!FEATURES.community) return null
        return box(id, (
          <>
            {head(id, t('communityTitle'))}
            {!collapsed.has(id) && <>
              <div className="row"><button onClick={community?.onRefresh}>↻ refresh 17lands</button>{community?.fetchedAt && <span className="sub">snapshot {new Date(community.fetchedAt).toLocaleDateString()}</span>}</div>
              {!community?.row && <div className="sub">{community ? t('notInCommunity') : t('noSnapshot')}</div>}
              {community?.row && (
                <div className="kv">
                  <b>GIH WR</b><span>{pct(community.row.ever_drawn_win_rate)} {community.percentile !== undefined && <span className="sub">(P{community.percentile})</span>}</span>
                  <b>OH WR</b><span>{pct(community.row.opening_hand_win_rate)}</span>
                  <b>IWD</b><span>{community.row.drawn_improvement_win_rate == null ? '—' : `${(community.row.drawn_improvement_win_rate * 100).toFixed(1)}pp`}</span>
                  <b>ALSA / ATA</b><span>{community.row.avg_seen?.toFixed(2) ?? '—'} / {community.row.avg_pick?.toFixed(2) ?? '—'}</span>
                  <b>Games</b><span>{community.row.game_count.toLocaleString()}</span>
                </div>
              )}
            </>}
          </>
        ))
    }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{display?.name ?? card.name}{display?.original && <span className="sub orig"> {display.original}</span>}</h2>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="sub">{card.manaCost} · {display?.type ?? card.typeLine} · {card.rarity} · {card.set.toUpperCase()} #{card.collectorNumber} · <a href={card.scryfallUri} target="_blank" rel="noreferrer">Scryfall</a></div>
      {pair && (
        <div className="pairbar">
          <button className="pairbtn" onClick={() => { if (pair.setting === undefined) setAskPair(true); else if (pair.setting === 'auto') pair.onJump(); else pair.onShowOnce() }} title={pair.setting === 'auto' ? 'jump to the other half' : 'show both halves side by side'}>
            <img src={pair.partner.imageSmall || pair.partner.imageNormal} alt="" /> ⇆ Echoverse pair · {pair.partnerName ?? pair.partner.name}
          </button>
          {askPair && (
            <div className="pairask">
              <div><b>Echoverse pairs</b> — FRA prints every legend from #195 up twice, once per universe. Show both halves side by side automatically whenever you open one of them?</div>
              <div className="row" style={{ marginTop: 6 }}>
                <button className="active" onClick={() => { pair.onSetSetting('auto'); setAskPair(false) }}>Always</button>
                <button onClick={() => { pair.onShowOnce(); setAskPair(false) }}>Just this once</button>
                <button onClick={() => { pair.onSetSetting('off'); pair.onJump(); setAskPair(false) }}>No, just jump to it</button>
              </div>
              <div className="sub" style={{ marginTop: 4 }}>Change later in ⚙ Options → Echoverse pairs.</div>
            </div>
          )}
        </div>
      )}
      {(() => {
        const shown = sections.map(id => ({ id, node: render(id) })).filter(x => x.node)
        const grab = (id: SectionId) => (e: React.PointerEvent<HTMLDivElement>) => {
          e.preventDefault()
          const sec = e.currentTarget.previousElementSibling as HTMLElement | null
          if (!sec) return
          const startY = e.clientY
          const startH = sec.getBoundingClientRect().height
          // pin the height and clip straight away, or the content just overflows and the drag looks like it lags
          sec.style.height = `${Math.round(startH)}px`
          sec.classList.add('sized', 'resizing')
          const move = (ev: PointerEvent) => { sec.style.height = `${Math.max(64, Math.round(startH + ev.clientY - startY))}px` }
          const up = () => {
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up)
            sec.classList.remove('resizing')
            onResizeSection(id, Math.round(sec.getBoundingClientRect().height))
          }
          document.addEventListener('pointermove', move); document.addEventListener('pointerup', up)
        }
        return shown.map((x, i) => (
          <Fragment key={x.id}>
            {x.node}
            {i < shown.length - 1 && <div className="sec-divider" onPointerDown={grab(x.id)} title="drag to resize the section above" />}
          </Fragment>
        ))
      })()}
    </div>
  )
}
