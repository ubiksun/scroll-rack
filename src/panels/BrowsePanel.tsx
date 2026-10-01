import { Fragment, useEffect, useRef } from 'react'
import { FEATURES } from '../features'
import { t } from '../i18n'
import { useGrader } from '../state'
import { useScope } from '../scope'
import type { Card } from '../db'
import CardGrid from '../components/CardGrid'
import BoardView from '../components/BoardView'
import SortMenu from '../components/SortMenu'
import ArtPicker from '../components/ArtPicker'
import NavBar from './NavBar'

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
const RARITIES = ['common', 'uncommon', 'rare', 'mythic']

// The SEARCH dock: its own query (search box, filters, sort, columns) and the results as Grid · Card · Comments.
// Clicks are standardised across every view: single = highlight, double = load into the channel, right = peek at
// the oracle text. Arrow keys move the highlight, Enter loads it. The search box only fires on Enter / 🔍.
export default function SearchPanel() {
  const g = useGrader()
  const s = useScope()
  const flip = (set: Set<string>, v: string) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n }
  const hasSets = g.activeSets.length > 0 || (s.q.searchScope === 'all' && !!s.q.textF.trim())
  const view = s.q.view === 'single' ? 'single' : s.q.view === 'board' ? 'board' : 'grid'
  const onSelect = (c: Card) => s.select(c)
  const onOpen = (c: Card, _e: React.MouseEvent) => s.load(c)
  const onPeek = (c: Card, e: React.MouseEvent) => { e.preventDefault(); g.showPeek(c, e.clientX, e.clientY) }
  // the card view always shows something from the current list
  useEffect(() => { if (view === 'single' && s.navList.length && s.selIndex < 0) s.select(s.navList[0]) }, [view, s.navList, s.selIndex])
  const cols = s.q.cols ?? 6
  const gridRef = useRef<HTMLDivElement>(null)
  return (
    <div className="pane">
      <div className="topbar sub-bar">
        <div className="group search-group" data-tour="search">
          <input placeholder={s.q.searchScope === 'all' ? 'Search all of Scryfall (Scryfall syntax) …' : t('search')} value={s.draft} onChange={e => s.setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); s.submit() } }} className={`search${s.searchState === 'error' ? ' err' : ''}${s.draft !== s.q.textF ? ' dirty' : ''}`} />
          <button className={s.draft !== s.q.textF ? 'active' : ''} onClick={s.submit} title={t('searchGo')}>🔍</button>
          <button data-tour="scope" className={s.q.searchScope === 'all' ? 'active' : ''} onClick={() => s.patch({ searchScope: s.q.searchScope === 'all' ? 'active' : 'all' })} title={s.q.searchScope === 'all' ? 'Searching every set on Scryfall (results are cached as you open them). Click to search only the active sets.' : 'Searching the active sets only. Click to search all of Scryfall.'}>{s.q.searchScope === 'all' ? '🌐 all sets' : '▣ active sets'}</button>
          <span className="status">{s.searchState === 'busy' ? t('searching') : s.searchState === 'error' ? t('syntaxError') : s.searchState === 'local' ? t('localSearch') : ''}</span>
        </div>
        <div className="group">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => s.patch({ view: 'grid' })}>{t('grid')}</button>
          <button className={view === 'single' ? 'active' : ''} onClick={() => s.patch({ view: 'single' })}>{t('single')}</button>
          <button className={view === 'board' ? 'active' : ''} onClick={() => s.patch({ view: 'board' })}>{t('commentView')}</button>
        </div>
        <div className="group">{COLORS.map(c => <button key={c} className={s.q.colorF.has(c) ? 'active' : ''} style={{ borderColor: `var(--${c})` }} onClick={() => s.patch({ colorF: flip(s.q.colorF, c) })}>{c}</button>)}</div>
        <div className="group">{RARITIES.map(r => <button key={r} className={s.q.rarityF.has(r) ? 'active' : ''} onClick={() => s.patch({ rarityF: flip(s.q.rarityF, r) })}>{r[0].toUpperCase()}</button>)}</div>
        <div className="group">
          <select value={s.q.ratedF} onChange={e => s.patch({ ratedF: e.target.value as typeof s.q.ratedF })}><option value="all">{t('all')}</option><option value="rated">{t('rated')}</option><option value="unrated">{t('unrated')}</option></select>
          <select value={s.q.tierF} onChange={e => s.patch({ tierF: e.target.value })}><option value="">{t('anyTier')}</option>{g.tierOptions.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select>
          <select value={s.q.tagF} onChange={e => s.patch({ tagF: e.target.value })}><option value="">{t('anyTag')}</option>{g.allTags.map(x => <option key={x} value={x}>#{x}</option>)}</select>
        </div>
        <SortMenu />
        {view === 'grid' && (
          // zoom = how many cards per row. Each step is one whole column, so the grid never re-flows under the pointer.
          <span className="group zoom" title={t('gridCols')}>
            <button onClick={() => s.patch({ cols: Math.min(12, cols + 1) })} disabled={cols >= 12} title={t('zoomOut')}>−</button>
            <span className="status cols">{cols}</span>
            <button onClick={() => s.patch({ cols: Math.max(2, cols - 1) })} disabled={cols <= 2} title={t('zoomIn')}>+</button>
          </span>
        )}
        <span className="spacer" />
        <span className="status">{s.filtered.length} {t('shown')}</span>
      </div>
      <div className="content" ref={gridRef}>
        {!hasSets && <div className="empty empty-cta"><div>{t('pickSet')}</div><button onClick={() => window.dispatchEvent(new Event('sr:guide'))}>{t('guideOpen')}</button></div>}
        {hasSets && view === 'grid' && (
          <CardGrid cols={cols} cards={s.filtered} badgesFor={g.badgesFor} selectedId={s.selected?.id ?? null}
            onSelect={onSelect} onOpen={onOpen} onPeek={onPeek}
            community={FEATURES.community && g.showCommunity ? g.percentiles : undefined} linkedIds={g.linkedIds} imageOf={g.imageOf} nameOf={g.nameOf} />
        )}
        {hasSets && view === 'single' && (
          <div className="single">
            <NavBar />
            {s.selected ? (() => {
              const sel = s.selected
              const pid = s.showPair ? g.partnerOf.get(sel.oracleId) : undefined
              const partner = pid ? g.cardsByOracle.get(pid) : undefined
              const pic = (c: typeof sel) => (
                <div key={c.id} className="single-pic" onDoubleClick={e => onOpen(c, e)} onContextMenu={e => onPeek(c, e)}>
                  <ArtPicker card={c} src={g.imageOf(c, 'large')} className={partner ? 'single-img pair-img' : 'single-img'} artPref={g.artPrefs.get(`${c.set}:${c.oracleId}`)} artMode={g.artMode} onSetArt={id => g.setArtPref(c, id)} />
                </div>
              )
              if (!partner) return pic(sel)
              const num = (c: typeof sel) => parseInt(c.collectorNumber.replace(/\D/g, ''), 10) || 0
              const [left, right] = num(sel) <= num(partner) ? [sel, partner] : [partner, sel]
              return (
                <div className="pair-view">
                  {[left, right].map((c, i) => (
                    <Fragment key={c.id}>
                      {i === 1 && <div className="pair-glyph">⇆</div>}
                      <div className={`pair-side${c.id === sel.id ? ' focus' : ''}`} onClick={() => onSelect(c)}>{pic(c)}<div className="sub">#{c.collectorNumber} · {g.nameOf(c)} {c.watermark === 'echoverse' && <span className="badge-inline echo">echoverse</span>}</div></div>
                    </Fragment>
                  ))}
                </div>
              )
            })() : <div className="empty">{t('noCards')}</div>}
          </div>
        )}
        {hasSets && view === 'board' && (
          <BoardView cards={s.filtered} contexts={g.contexts} schemes={g.schemes} ratingOf={g.ratingOf} imageOf={g.imageOf} selectedId={s.selected?.id ?? null}
            onSelect={onSelect} onOpen={onOpen} onPeek={onPeek} />
        )}
      </div>
    </div>
  )
}
