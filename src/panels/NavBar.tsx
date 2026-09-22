import { useGrader } from '../state'
import { useScope } from '../scope'
import { t } from '../i18n'

// Shared prev/next strip (Browse card view + Graph). Position is within THIS dock's filter.
export default function NavBar() {
  const g = useGrader()
  const s = useScope()
  return (
    <div className="single-nav">
      <button onClick={s.goPrev} disabled={s.selIndex <= 0}>{t('prev')}</button>
      <span className="status">{s.selected ? `${s.selIndex + 1} / ${s.navList.length}` : `— / ${s.navList.length}`}</span>
      <button onClick={s.goNext} disabled={s.selIndex >= s.navList.length - 1}>{t('next')}</button>
      {s.selected && <span className="status ell" style={{ maxWidth: 260 }}>{g.nameOf(s.selected)}</span>}
    </div>
  )
}
