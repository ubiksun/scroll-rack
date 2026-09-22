import { Fragment } from 'react'
import { FEATURES } from '../features'
import { t } from '../i18n'
import { useGrader } from '../state'
import { useScope } from '../scope'
import type { OpenMode } from '../docks'
import CardGrid from '../components/CardGrid'
import BoardView from '../components/BoardView'
import NavBar from './NavBar'
import SortMenu from '../components/SortMenu'
import ArtPicker from '../components/ArtPicker'

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
const RARITIES = ['common', 'uncommon', 'rare', 'mythic']

// The main working surface: Grid (overview) · Card (big image, flip through) · Board (drag onto tier rows).
// v0.10: one of N. The search box lives HERE, not in the toolbar — this dock's query is its own.
export default function BrowsePanel() {
  const g = useGrader()
  const s = useScope()
  const flip = (set: Set<string>, v: string) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n }
  const hasSets = g.activeSets.length > 0 || (s.q.searchScope === 'all' && !!s.q.textF.trim())
  const open = (e: React.MouseEvent): OpenMode => (e.metaKey || e.ctrlKey ? 'new' : 'primary')
  return (
    <div className="pane">
      <div className="topbar sub-bar">
        <div className="group search-group">
          <input placeholder={s.q.searchScope === 'all' ? 'Search all of Scryfall (Scryfall syntax) …' : t('search')} value={s.q.textF} onChange={e => s.patch({ textF: e.target.value })} className={`search${s.searchState === 'error' ? ' err' : ''}`} />
          <button className={s.q.searchScope === 'all' ? 'active' : ''} onClick={() => s.patch({ searchScope: s.q.searchScope === 'all' ? 'active' : 'all' })} title={s.q.searchScope === 'all' ? 'Searching every set on Scryfall (results are cached as you open them). Click to search only the active sets.' : 'Searching the active sets only. Click to search all of Scryfall.'}>{s.q.searchScope === 'all' ? '🌐 all sets' : '▣ active sets'}</button>
          <span className="status">{s.searchState === 'busy' ? t('searching') : s.searchState === 'error' ? t('syntaxError') : s.searchState === 'local' ? t('localSearch') : ''}</span>
        </div>
        <div className="group">
          <button className={s.q.view === 'grid' ? 'active' : ''} onClick={() => s.patch({ view: 'grid' })}>{t('grid')}</button>
          <button className={s.q.view === 'single' ? 'active' : ''} onClick={() => s.patch({ view: 'single' })}>{t('single')}</button>
          <button className={s.q.view === 'board' ? 'active' : ''} onClick={() => s.patch({ view: 'board' })}>{t('commentView')}</button>
        </div>
        <div className="group">{COLORS.map(c => <button key={c} className={s.q.colorF.has(c) ? 'active' : ''} style={{ borderColor: `var(--${c})` }} onClick={() => s.patch({ colorF: flip(s.q.colorF, c) })}>{c}</button>)}</div>
        <div className="group">{RARITIES.map(r => <button key={r} className={s.q.rarityF.has(r) ? 'active' : ''} onClick={() => s.patch({ rarityF: flip(s.q.rarityF, r) })}>{r[0].toUpperCase()}</button>)}</div>
        <div className="group">
          <select value={s.q.ratedF} onChange={e => s.patch({ ratedF: e.target.value as typeof s.q.ratedF })}><option value="all">{t('all')}</option><option value="rated">{t('rated')}</option><option value="unrated">{t('unrated')}</option></select>
          <select value={s.q.tierF} onChange={e => s.patch({ tierF: e.target.value })}><option value="">{t('anyTier')}</option>{g.tierOptions.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select>
          <select value={s.q.tagF} onChange={e => s.patch({ tagF: e.target.value })}><option value="">{t('anyTag')}</option>{g.allTags.map(x => <option key={x} value={x}>#{x}</option>)}</select>
        </div>
        <SortMenu />
        <span className="group zoom" title={t('zoomLabel')}>
          <button onClick={() => s.patch({ zoom: Math.max(90, s.q.zoom - 30) })} disabled={s.q.zoom <= 90} title={t('zoomOut')}>−</button>
          <input type="range" min={90} max={330} step={10} value={s.q.zoom} aria-label={t('zoomLabel')}
            onChange={e => s.patch({ zoom: Number(e.target.value) })} />
          <button onClick={() => s.patch({ zoom: Math.min(330, s.q.zoom + 30) })} disabled={s.q.zoom >= 330} title={t('zoomIn')}>+</button>
        </span>
        <span className="spacer" />
        <span className="status">{s.filtered.length} {t('shown')}</span>
      </div>
      <div className="content">
        {!hasSets && <div className="empty">{t('pickSet')}</div>}
        {hasSets && s.q.view === 'grid' && (
          <CardGrid zoom={s.q.zoom} cards={s.filtered} badgesFor={g.badgesFor} selectedId={s.selected?.id ?? null} onSelect={(c, e) => s.setSelected(c, { open: open(e) })}
            community={FEATURES.community && g.showCommunity ? g.percentiles : undefined} linkedIds={g.linkedIds} imageOf={g.imageOf} nameOf={g.nameOf} />
        )}
        {hasSets && s.q.view === 'single' && (
          <div className="single">
            <NavBar />
            {s.selected ? (() => {
              const sel = s.selected
              const pid = s.showPair ? g.partnerOf.get(sel.oracleId) : undefined
              const partner = pid ? g.cardsByOracle.get(pid) : undefined
              const pic = (c: typeof sel) => <ArtPicker key={c.id} card={c} src={g.imageOf(c, 'large')} className={partner ? 'single-img pair-img' : 'single-img'} artPref={g.artPrefs.get(`${c.set}:${c.oracleId}`)} artMode={g.artMode} onSetArt={id => g.setArtPref(c, id)} />
              if (!partner) return pic(sel)
              const num = (c: typeof sel) => parseInt(c.collectorNumber.replace(/\D/g, ''), 10) || 0
              const [left, right] = num(sel) <= num(partner) ? [sel, partner] : [partner, sel]   // lower collector number on the left
              return (
                <div className="pair-view">
                  {[left, right].map((c, i) => (
                    <Fragment key={c.id}>
                      {i === 1 && <div className="pair-glyph">⇆</div>}
                      <div className={`pair-side${c.id === sel.id ? ' focus' : ''}`} onClick={e => s.setSelected(c, { open: open(e) })}>{pic(c)}<div className="sub">#{c.collectorNumber} · {g.nameOf(c)} {c.watermark === 'echoverse' && <span className="badge-inline echo">echoverse</span>}</div></div>
                    </Fragment>
                  ))}
                </div>
              )
            })() : <div className="empty">{t('noCards')}</div>}
            <div className="status">{t('keysHint')}</div>
          </div>
        )}
        {hasSets && s.q.view === 'board' && (
          <BoardView cards={s.filtered} contexts={g.contexts} schemes={g.schemes} ratingOf={g.ratingOf} imageOf={g.imageOf} selectedId={s.selected?.id ?? null} onSelect={(c, e) => s.setSelected(c, { open: open(e) })} />
        )}
      </div>
    </div>
  )
}
