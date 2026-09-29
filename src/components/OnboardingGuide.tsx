import { useEffect, useState } from 'react'
import { listSets } from '../api/scryfall'
import { setSetting } from '../db'
import { t } from '../i18n'
import { useGrader } from '../state'

// First-run guide: four short steps (load a set · rate · see it on Scryfall · arrange panels), each with the one
// action it needs. Opens on its own until dismissed once; afterwards from ⚙ About → "Show the guide", or from the
// empty Search panel. Step 1's button pulls the newest released expansion so the first thing seen is real cards.
type StepId = 'sets' | 'rate' | 'scryfall' | 'panels'
const STEPS: StepId[] = ['sets', 'rate', 'scryfall', 'panels']

export default function OnboardingGuide({ onClose }: { onClose: () => void }) {
  const g = useGrader()
  const [i, setI] = useState(0)
  const [pulling, setPulling] = useState(false)
  const step = STEPS[i]
  const classic = g.workspaceMode === 'classic'
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key)
  }, [onClose])
  const pullNewest = async () => {
    setPulling(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const sets = (await listSets()).filter(s => (s.set_type === 'expansion' || s.set_type === 'core') && s.released_at <= today && !s.digital)
      sets.sort((a, b) => b.released_at.localeCompare(a.released_at))
      const pick = sets[0]
      if (pick) { await g.pullSet(pick.code); setI(1) }
    } catch (e) { g.setStatus(String(e)) } finally { setPulling(false) }
  }
  const finish = () => { void setSetting('onboarded', true); onClose() }
  const body: Record<StepId, { title: string; text: string; action?: React.ReactNode }> = {
    sets: { title: t('guideSetsTitle'), text: t('guideSetsText'), action: <button className="active" disabled={pulling || !!g.busySet} onClick={() => void pullNewest()}>{pulling || g.busySet ? t('guidePulling') : t('guidePullNewest')}</button> },
    rate: { title: t('guideRateTitle'), text: classic ? t('guideRateTextClassic') : t('guideRateTextWired') },
    scryfall: { title: t('guideScryfallTitle'), text: t('guideScryfallText') },
    panels: { title: t('guidePanelsTitle'), text: classic ? t('guidePanelsTextClassic') : t('guidePanelsTextWired') },
  }
  const b = body[step]
  return (
    <div className="modal-bg" onClick={finish}>
      <div className="modal guide" onClick={e => e.stopPropagation()} role="dialog" aria-label={t('guideTitle')}>
        <div className="guide-side">
          <h2>{t('guideTitle')}</h2>
          <p className="sub">{t('guideIntro')}</p>
          <ol className="guide-steps">
            {STEPS.map((s, k) => <li key={s} className={k === i ? 'on' : k < i ? 'done' : ''} onClick={() => setI(k)}><span className="n">{k + 1}</span>{body[s].title}</li>)}
          </ol>
        </div>
        <div className="guide-body">
          <div className="guide-step">{t('guideStep')} {i + 1} / {STEPS.length}</div>
          <h3>{b.title}</h3>
          <p>{b.text}</p>
          {b.action && <div className="guide-action">{b.action}{g.status && <span className="sub"> {g.status}</span>}</div>}
          <div className="guide-nav">
            <button onClick={finish}>{t('guideSkip')}</button>
            <span className="spacer" />
            <button disabled={i === 0} onClick={() => setI(i - 1)}>{t('guidePrev')}</button>
            {i < STEPS.length - 1
              ? <button className="active" onClick={() => setI(i + 1)}>{t('guideNext')}</button>
              : <button className="active" onClick={finish}>{t('guideDone')}</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
