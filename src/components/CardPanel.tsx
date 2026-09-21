import { useEffect, useMemo, useState } from 'react'
import { db, upsertRating, addTag, removeTag, addEdge as dbAddEdge, tagEdge, type ArtMode, type ArtPref, type Card, type CardTag, type CommunityRow, type CommunityTagsRow, type Context, type Edge, type Rating, type Scheme } from '../db'
import { pct } from '../api/seventeen'
import { FEATURES } from '../features'
import { t } from '../i18n'
import ArtPicker from './ArtPicker'

// Fixed sections + one collapsible block per rating context (each with tiers + its own note).
export const PANEL_SECTIONS = ['image', 'contexts', 'tags', 'links', 'oracle', 'community'] as const
export type SectionId = typeof PANEL_SECTIONS[number]

interface Props {
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
  onMoveSection: (id: SectionId, dir: -1 | 1) => void
  collapsed: Set<string>              // collapsed block ids (context ids, 'links', 'oracle', 'tags')
  onToggleCollapse: (id: string) => void
  hideImage?: boolean                 // Card view: the big image is on the left already
  communityTags?: CommunityTagsRow | null   // Scryfall Tagger (experimental); undefined = feature off
  onRefreshCommunity?: () => void
  display?: { name: string; type: string; original?: string }   // localized name/type (大學院廢墟); original = English name when different
  pair?: { partner: Card; partnerName?: string; setting: 'auto' | 'off' | undefined; onSetSetting: (v: 'auto' | 'off') => void; onShowOnce: () => void; onJump: () => void }
}


function ContextBlock({ card, ctx, scheme, rating, open, onToggle, onMove, first, last }: { card: Card; ctx: Context; scheme: Scheme | undefined; rating: Rating | undefined; open: boolean; onToggle: () => void; onMove: (dir: -1 | 1) => void; first: boolean; last: boolean }) {
  const [note, setNote] = useState(rating?.note ?? '')
  useEffect(() => { setNote(rating?.note ?? '') }, [card.id, ctx.id])
  useEffect(() => {
    if (note === (rating?.note ?? '')) return
    const h = setTimeout(() => { void upsertRating(card.set, card.oracleId, ctx.id, { note }) }, 500)
    return () => clearTimeout(h)
  }, [note])
  const tier = scheme?.tiers.find(x => x.name === rating?.tier)
  return (
    <div className="block">
      <div className="block-head" onClick={onToggle}>
        <span className="caret">{open ? '▾' : '▸'}</span>
        <b>{ctx.name}</b>
        {tier && <span className="badge-inline" style={{ background: tier.color }}>{tier.name}</span>}
        {!open && rating?.note && <span className="sub ell">{rating.note}</span>}
        <span className="sec-move" onClick={e => e.stopPropagation()}><button onClick={() => onMove(-1)} disabled={first} title="move up">↑</button><button onClick={() => onMove(1)} disabled={last} title="move down">↓</button></span>
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
          <textarea id={`note-${ctx.id}`} placeholder={`${ctx.name} — ${t('notes')}`} value={note} onChange={e => setNote(e.target.value)} />
        </div>
      )}
    </div>
  )
}

export default function CardPanel(p: Props) {
  const { card, contexts, schemes, ratings, tags, allTags, allCards, edges, cardsByOracle, community, onJump, onClose, image, artPref, artMode, onSetArt, sections, onMoveSection, collapsed, onToggleCollapse, hideImage, communityTags, onRefreshCommunity, pair, display } = p
  const [askPair, setAskPair] = useState(false)
  const [q, setQ] = useState('')
  const [tagQ, setTagQ] = useState('')
  const [edgeNote, setEdgeNote] = useState('')
  const [edgeTagQ, setEdgeTagQ] = useState<Record<number, string>>({})
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

  const moveContext = async (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= contexts.length) return
    const sorted = [...contexts].sort((a, b) => a.order - b.order)
    const a = sorted[i], b = sorted[j]
    await db.transaction('rw', db.contexts, async () => { await db.contexts.update(a.id, { order: b.order }); await db.contexts.update(b.id, { order: a.order }) })
  }

  const head = (id: SectionId, title: string, collapsible = true) => (
    <div className="block-head" onClick={collapsible ? () => onToggleCollapse(id) : undefined}>
      {collapsible && <span className="caret">{collapsed.has(id) ? '▸' : '▾'}</span>}
      <b>{title}</b>
      <span className="sec-move" onClick={e => e.stopPropagation()}><button onClick={() => onMoveSection(id, -1)} title="move up">↑</button><button onClick={() => onMoveSection(id, 1)} title="move down">↓</button></span>
    </div>
  )

  const render = (id: SectionId) => {
    switch (id) {
      case 'image':
        if (hideImage) return null
        return (
          <div className="section" key={id}>
            <ArtPicker card={card} src={image} className="big" artPref={artPref} artMode={artMode} onSetArt={onSetArt} />
          </div>
        )
      case 'contexts':
        return (
          <div className="section" key={id}>
            {head(id, 'Ratings', false)}
            {contexts.map((ctx, i) => (
              <ContextBlock key={ctx.id} card={card} ctx={ctx} scheme={schemes.find(s => s.id === ctx.schemeId)} rating={ratings.find(r => r.context === ctx.id)}
                open={!collapsed.has(ctx.id)} onToggle={() => onToggleCollapse(ctx.id)}
                first={i === 0} last={i === contexts.length - 1} onMove={dir => moveContext(i, dir)} />
            ))}
          </div>
        )
      case 'tags':
        return (
          <div className="section" key={id}>
            {head(id, `${t('tags')} (${tags.length})`)}
            {!collapsed.has(id) && <>
              <div className="chips">
                {tags.map(x => <span className="chip" key={x.key}>#{x.tag}<span className="x" onClick={() => removeTag(card.oracleId, x.tag)}>✕</span></span>)}
                <input placeholder={t('addTag')} value={tagQ} onChange={e => setTagQ(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && tagQ.trim()) { void addTag(card.oracleId, tagQ); setTagQ('') } }} />
              </div>
              {tagQ && tagSuggestions.length > 0 && <div className="search-results">{tagSuggestions.map(s => <div key={s} onClick={() => { void addTag(card.oracleId, s); setTagQ('') }}>#{s}</div>)}</div>}
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
          </div>
        )
      case 'links':
        if (!FEATURES.links) return null
        return (
          <div className="section" key={id}>
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
                      <input placeholder="+ tag" value={tq} list={`edge-tags-${e.id}`} onChange={ev => setEdgeTagQ(m => ({ ...m, [e.id!]: ev.target.value }))}
                        onKeyDown={ev => { if (ev.key === 'Enter' && tq.trim()) { void tagEdge(e.id!, tq); setEdgeTagQ(m => ({ ...m, [e.id!]: '' })) } }} />
                      <datalist id={`edge-tags-${e.id}`}>{allEdgeTags.filter(x => !e.tags.includes(x)).map(x => <option key={x} value={x} />)}</datalist>
                    </div>
                  </div>
                )
              })}
              <div className="row" style={{ marginTop: 6 }}>
                <input placeholder={t('why')} value={edgeNote} onChange={e => setEdgeNote(e.target.value)} style={{ flex: 1 }} />
              </div>
              <input placeholder={t('linkTo')} value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', marginTop: 6 }} />
              {results.length > 0 && <div className="search-results">{results.map(c => <div key={c.id} onClick={() => addEdge(c)}>{c.name} <span className="sub">({c.set.toUpperCase()})</span></div>)}</div>}
            </>}
          </div>
        )
      case 'oracle':
        return (
          <div className="section" key={id}>
            {head(id, t('oracle'))}
            {!collapsed.has(id) && <>
              <div className="oracle">{card.oracleText}</div>
              {card.keywords.length > 0 && <div className="sub" style={{ marginTop: 6 }}>{t('keywords')}: {card.keywords.join(', ')}</div>}
            </>}
          </div>
        )
      case 'community':
        if (!FEATURES.community) return null
        return (
          <div className="section" key={id}>
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
          </div>
        )
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
      {sections.map(render)}
    </div>
  )
}
