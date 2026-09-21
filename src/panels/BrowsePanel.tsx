import { FEATURES } from '../features'
import { t } from '../i18n'
import { useGrader } from '../state'
import CardGrid from '../components/CardGrid'
import BoardView from '../components/BoardView'
import NavBar from './NavBar'
import SortMenu from '../components/SortMenu'
import ArtPicker from '../components/ArtPicker'

const COLORS = ['W', 'U', 'B', 'R', 'G', 'C'] as const
const RARITIES = ['common', 'uncommon', 'rare', 'mythic']

// The main working surface: Grid (overview) · Card (big image, flip through) · Board (drag onto tier rows).
export default function BrowsePanel() {
  const g = useGrader()
  const toggle = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); setter(n) }
  const hasSets = g.activeSets.length > 0 || (g.searchScope === 'all' && !!g.textF.trim())
  return (
    <div className="pane">
      <div className="topbar sub-bar">
        <div className="group">
          <button className={g.view === 'grid' ? 'active' : ''} onClick={() => g.setView('grid')}>{t('grid')}</button>
          <button className={g.view === 'single' ? 'active' : ''} onClick={() => g.setView('single')}>{t('single')}</button>
          <button className={g.view === 'board' ? 'active' : ''} onClick={() => g.setView('board')}>Board</button>
        </div>
        <div className="group">{COLORS.map(c => <button key={c} className={g.colorF.has(c) ? 'active' : ''} style={{ borderColor: `var(--${c})` }} onClick={() => toggle(g.colorF, c, g.setColorF)}>{c}</button>)}</div>
        <div className="group">{RARITIES.map(r => <button key={r} className={g.rarityF.has(r) ? 'active' : ''} onClick={() => toggle(g.rarityF, r, g.setRarityF)}>{r[0].toUpperCase()}</button>)}</div>
        <div className="group">
          <select value={g.ratedF} onChange={e => g.setRatedF(e.target.value as typeof g.ratedF)}><option value="all">{t('all')}</option><option value="rated">{t('rated')}</option><option value="unrated">{t('unrated')}</option></select>
          <select value={g.tierF} onChange={e => g.setTierF(e.target.value)}><option value="">{t('anyTier')}</option>{g.tierOptions.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select>
          <select value={g.tagF} onChange={e => g.setTagF(e.target.value)}><option value="">{t('anyTag')}</option>{g.allTags.map(x => <option key={x} value={x}>#{x}</option>)}</select>
        </div>
        <SortMenu />
        <span className="spacer" />
        <span className="status">{g.filtered.length} {t('shown')}</span>
      </div>
      <div className="content">
        {!hasSets && <div className="empty">{t('pickSet')}</div>}
        {hasSets && g.view === 'grid' && (
          <CardGrid cards={g.filtered} badgesFor={g.badgesFor} selectedId={g.selected?.id ?? null} onSelect={g.setSelected}
            community={FEATURES.community && g.showCommunity ? g.percentiles : undefined} linkedIds={g.linkedIds} imageOf={g.imageOf} nameOf={g.nameOf} />
        )}
        {hasSets && g.view === 'single' && (
          <div className="single">
            <NavBar />
            {g.selected ? (() => {
              const sel = g.selected
              const pid = g.showPair ? g.partnerOf.get(sel.oracleId) : undefined
              const partner = pid ? g.cardsByOracle.get(pid) : undefined
              const pic = (c: typeof sel) => <ArtPicker key={c.id} card={c} src={g.imageOf(c, 'normal')} className={partner ? 'single-img pair-img' : 'single-img'} artPref={g.artPrefs.get(`${c.set}:${c.oracleId}`)} artMode={g.artMode} onSetArt={id => g.setArtPref(c, id)} />
              if (!partner) return pic(sel)
              const num = (c: typeof sel) => parseInt(c.collectorNumber.replace(/\D/g, ''), 10) || 0
              const [left, right] = num(sel) <= num(partner) ? [sel, partner] : [partner, sel]   // lower collector number on the left
              return (
                <div className="pair-view">
                  {[left, right].map((c, i) => (
                    <>
                      {i === 1 && <div className="pair-glyph" key="g">⇆</div>}
                      <div key={c.id} className={`pair-side${c.id === sel.id ? ' focus' : ''}`} onClick={() => g.setSelected(c)}>{pic(c)}<div className="sub">#{c.collectorNumber} · {g.nameOf(c)} {c.watermark === 'echoverse' && <span className="badge-inline echo">echoverse</span>}</div></div>
                    </>
                  ))}
                </div>
              )
            })() : <div className="empty">{t('noCards')}</div>}
            <div className="status">{t('keysHint')}</div>
          </div>
        )}
        {hasSets && g.view === 'board' && (
          <BoardView cards={g.filtered} contexts={g.contexts} schemes={g.schemes} ratingOf={g.ratingOf} imageOf={g.imageOf} selectedId={g.selected?.id ?? null} onSelect={g.setSelected} />
        )}
      </div>
    </div>
  )
}
