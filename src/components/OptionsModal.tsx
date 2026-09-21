import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting } from '../db'
import type { Context, Scheme } from '../db'
import { useGrader } from '../state'
import { t } from '../i18n'
import TagTable from './TagTable'

interface Props { contexts: Context[]; schemes: Scheme[]; onClose: () => void }

// ⚙ Options: rating contexts + their tier schemes live here (not in the toolbar). Hidden features listed for the record.
export default function OptionsModal({ contexts, schemes, onClose }: Props) {
  const g = useGrader()
  const showBasics = useLiveQuery(() => getSetting<boolean>('showBasicLands', false), []) ?? false
  const tagger = useLiveQuery(() => getSetting<boolean>('exp.tagger', false), []) ?? false
  const pairs = useLiveQuery(() => getSetting<'auto' | 'off' | undefined>('echoversePairs', undefined), [])
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal wide" onClick={e => e.stopPropagation()}>
        <h2>{t('options')}</h2>
        <div className="section" style={{ borderTop: 0, paddingTop: 0 }}>
          <h3>{t('language')}</h3>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>{t('uiLanguage')}</span>
            <span className="seg"><button className={g.lang === 'en' ? 'active' : ''} onClick={() => g.setLang('en')}>English</button><button className={g.lang === 'zh' ? 'active' : ''} onClick={() => g.setLang('zh')}>中文</button></span></div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}><span>{t('cardLanguage')} <span className="sub">{t('cardLanguageHint')}</span></span>
            <span className="seg"><button className={g.cardLang === 'en' ? 'active' : ''} onClick={() => g.setCardLang('en')}>English</button><button className={g.cardLang === 'zh' ? 'active' : ''} onClick={() => g.setCardLang('zh')}>中文</button></span></div>
        </div>
        <div className="section">
          <h3>{t('tagsSection')} <span className="sub" style={{ textTransform: 'none', letterSpacing: 0 }}>{t('tagsSectionHint')}</span></h3>
          <TagTable contexts={contexts} schemes={schemes} />
        </div>
        <div className="section">
          <h3>{t('display')}</h3>
          <label className="row"><input type="checkbox" checked={showBasics} onChange={e => setSetting('showBasicLands', e.target.checked)} /> Show basic lands (Plains / Island / … incl. Snow-Covered)</label>
        </div>
        <div className="section">
          <h3>{t('echoPairs')}</h3>
          <label className="row"><input type="radio" name="pairs" checked={pairs === 'auto'} onChange={() => setSetting('echoversePairs', 'auto')} /> Auto — show both halves side by side, browse pair by pair</label>
          <label className="row"><input type="radio" name="pairs" checked={pairs === 'off'} onChange={() => setSetting('echoversePairs', 'off')} /> Off — the pair button just jumps to the other half</label>
          {pairs === undefined && <div className="sub">Not decided yet — you'll be asked the first time you press the pair button.</div>}
        </div>
        <div className="section">
          <h3>{t('experimental')}</h3>
          <label className="row"><input type="checkbox" checked={tagger} onChange={e => setSetting('exp.tagger', e.target.checked)} /> Scryfall Tagger community tags (◈) in the Tags section — undocumented API, one request per card, cached 7 days</label>
        </div>
        <div className="row" style={{ marginTop: 10, justifyContent: 'flex-end' }}><button className="active" onClick={onClose}>{t('close')}</button></div>
      </div>
    </div>
  )
}
