import { useGrader } from '../state'
import { t } from '../i18n'

// Shared prev/next strip (Browse card view + Graph). Position is within the current filter.
export default function NavBar() {
  const g = useGrader()
  return (
    <div className="single-nav">
      <button onClick={g.goPrev} disabled={g.selIndex <= 0}>{t('prev')}</button>
      <span className="status">{g.selected ? `${g.selIndex + 1} / ${g.navList.length}` : `— / ${g.navList.length}`}</span>
      <button onClick={g.goNext} disabled={g.selIndex >= g.navList.length - 1}>{t('next')}</button>
      {g.selected && <span className="status ell" style={{ maxWidth: 260 }}>{g.nameOf(g.selected)}</span>}
    </div>
  )
}
