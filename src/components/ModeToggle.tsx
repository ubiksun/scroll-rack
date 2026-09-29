import { t } from '../i18n'
import { useGrader } from '../state'

// Test-build switch between the two workspaces. 'classic' = the v0.10.0 docks published on GitHub (default);
// 'wired' = the panels-follow-a-search model still under test. Each keeps its own saved layout, so flipping back
// and forth loses nothing. Remove this (and src/classic/) once one of them wins.
export default function ModeToggle() {
  const g = useGrader()
  const wired = g.workspaceMode === 'wired'
  return (
    <button className={`mode-toggle${wired ? ' active' : ''}`} onClick={() => g.setWorkspaceMode(wired ? 'classic' : 'wired')}
      title={wired ? t('modeWiredHint') : t('modeClassicHint')}>🧪 {wired ? t('modeWired') : t('modeClassic')}</button>
  )
}
