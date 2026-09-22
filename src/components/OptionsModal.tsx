import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting, type Context, type Scheme } from '../db'
import { useGrader } from '../state'
import { t } from '../i18n'
import { currentVersion } from '../update'
import { BLOG_ICON } from './blogIcon'
import TagTable from './TagTable'
import SchemeEditor from './SchemeEditor'
import BadgeDesign from './BadgeDesign'

interface Props { contexts: Context[]; schemes: Scheme[]; onClose: () => void }

// Everything outward-facing in one place, so it can be edited without hunting through JSX.
const LINKS = {
  github: 'https://github.com/ubiksun/scroll-rack',
  privacy: 'https://github.com/ubiksun/scroll-rack/blob/main/PRIVACY.md',
  license: 'https://github.com/ubiksun/scroll-rack/blob/main/LICENSE',
  x: 'https://x.com/Hitorikan1',
  bluesky: 'https://bsky.app/profile/hitorikan1.bsky.social',
  blog: 'https://bluesdrivemonster.com/',
}

type PaneId = 'about' | 'language' | 'comments' | 'tiers' | 'badges' | 'oracle' | 'display' | 'pairs' | 'experimental'
const NAV: { group: string; items: { id: PaneId; label: () => string }[] }[] = [
  { group: 'optAbout', items: [{ id: 'about', label: () => t('optAbout') }] },
  { group: 'optInterface', items: [
    { id: 'language', label: () => t('optLanguage') },
    { id: 'comments', label: () => t('optComments') },
    { id: 'tiers', label: () => t('optTiers') },
    { id: 'badges', label: () => t('optBadges') },
    { id: 'oracle', label: () => t('optOracle') },
    { id: 'display', label: () => t('optDisplay') },
    { id: 'pairs', label: () => t('optPairs') },
  ] },
  { group: 'optExperimental', items: [{ id: 'experimental', label: () => t('optExperimental') }] },
]


// Inline SVG so nothing is fetched from outside the extension. Brand marks are used only to link to those profiles.
const ICON = {
  github: (
    <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  ),
  bluesky: (
    <svg viewBox="0 0 568 501" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.89-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C9.945 203.66 0 75.293 0 57.947 0-28.906 76.135-1.611 123.121 33.664Z"/></svg>
  ),
  blog: <img className="site-icon" src={BLOG_ICON} width="20" height="20" alt="" aria-hidden="true" />,
}
const SOCIALS = [
  { key: 'github', href: LINKS.github, icon: ICON.github, label: () => t('aboutRepo') },
  { key: 'x', href: LINKS.x, icon: ICON.x, label: () => 'X · @Hitorikan1' },
  { key: 'bluesky', href: LINKS.bluesky, icon: ICON.bluesky, label: () => 'Bluesky · @hitorikan1' },
  { key: 'blog', href: LINKS.blog, icon: ICON.blog, label: () => `${t('aboutBlog')} · bluesdrivemonster.com` },
]

// ⚙ Options as a proper settings surface: a left nav grouped About / Interface / Experimental, one pane at a time.
export default function OptionsModal({ contexts, schemes, onClose }: Props) {
  const g = useGrader()
  const [pane, setPane] = useState<PaneId>('about')
  const [editScheme, setEditScheme] = useState<Scheme | null>(null)
  const showBasics = useLiveQuery(() => getSetting<boolean>('showBasicLands', false), []) ?? false
  const tagger = useLiveQuery(() => getSetting<boolean>('exp.tagger', false), []) ?? false
  const tabRename = useLiveQuery(() => getSetting<boolean>('tabRenameButton', true), []) ?? true
  const pairs = useLiveQuery(() => getSetting<'auto' | 'off' | undefined>('echoversePairs', undefined), [])

  const seg = <T extends string>(value: T, options: { v: T; l: string }[], onPick: (v: T) => void) => (
    <span className="seg">{options.map(o => <button key={o.v} className={value === o.v ? 'active' : ''} onClick={() => onPick(o.v)}>{o.l}</button>)}</span>
  )

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal options" onClick={e => e.stopPropagation()}>
        <nav className="opt-nav">
          <h2>{t('options')}</h2>
          {NAV.map(sec => (
            <div key={sec.group}>
              <div className="opt-group">{t(sec.group as 'optAbout')}</div>
              {sec.items.map(it => (
                <button key={it.id} className={`opt-link${pane === it.id ? ' active' : ''}`} onClick={() => { setPane(it.id); setEditScheme(null) }}>{it.label()}</button>
              ))}
            </div>
          ))}
          <span className="spacer" />
          <button className="active" onClick={onClose}>{t('close')}</button>
        </nav>

        <div className="opt-body">
          {pane === 'about' && (
            <section className="about">
              <h3>Scroll Rack <span className="sub">v{currentVersion()}</span></h3>
              <p>{t('aboutWhat')}</p>
              <p className="sub">{t('aboutAuthor')} · {t('aboutBuilt')}</p>
              <h3 style={{ marginTop: 18 }}>{t('aboutLinks')}</h3>
              <div className="about-links">
                {SOCIALS.map(s2 => (
                  <a key={s2.key} className="icon-link" href={s2.href} target="_blank" rel="noreferrer"
                    title={s2.label()} aria-label={s2.label()}>{s2.icon}</a>
                ))}
              </div>
              <div className="sub" style={{ marginTop: 14 }}>
                <a href={LINKS.privacy} target="_blank" rel="noreferrer">{t('aboutPrivacy')}</a>
                {' · '}
                <a href={LINKS.license} target="_blank" rel="noreferrer">{t('aboutLicense')}</a>
              </div>
              <p className="sub" style={{ marginTop: 14 }}>{t('aboutDataCredit')}</p>
            </section>
          )}

          {pane === 'language' && (
            <section>
              <div className="opt-row"><span>{t('uiLanguage')}</span>{seg(g.lang, [{ v: 'en' as const, l: 'English' }, { v: 'zh' as const, l: '中文' }], g.setLang)}</div>
              <div className="opt-row"><span>{t('cardLanguage')} <span className="sub">{t('cardLanguageHint')}</span></span>{seg(g.cardLang, [{ v: 'en' as const, l: 'English' }, { v: 'zh' as const, l: '中文' }], g.setCardLang)}</div>
              <div className="opt-row"><span>{t('oracleLangTitle')}</span>{seg(g.oracleLang, [{ v: 'follow' as const, l: t('oracleLangFollow') }, { v: 'en' as const, l: 'English' }, { v: 'zh' as const, l: '中文' }], g.setOracleLang)}</div>
            </section>
          )}

          {pane === 'comments' && <section><TagTable contexts={contexts} schemes={schemes} onEditTiers={s => { setEditScheme(s); setPane('tiers') }} /></section>}

          {pane === 'tiers' && (
            <section>
              <div className="sub" style={{ marginBottom: 8 }}>{t('tiersHint')}</div>
              {editScheme
                ? <SchemeEditor scheme={editScheme} onClose={() => setEditScheme(null)} />
                : schemes.map(s => (
                  <div className="opt-row" key={s.id}>
                    <span><b>{s.name}</b> <span className="sub">{s.tiers.map(x => x.name).join(' / ')}</span></span>
                    <button onClick={() => setEditScheme(s)}>{t('editTiers')}</button>
                  </div>
                ))}
            </section>
          )}

          {pane === 'badges' && <section><BadgeDesign contexts={contexts} /></section>}

          {pane === 'oracle' && (
            <section>
              <label className="row"><input type="radio" name="oraclemode" checked={g.oracleMode === 'shared'} onChange={() => g.setOracleMode('shared')} /> {t('oracleModeShared')}</label>
              <label className="row"><input type="radio" name="oraclemode" checked={g.oracleMode === 'attached'} onChange={() => g.setOracleMode('attached')} /> {t('oracleModeAttached')}</label>
              <label className="row"><input type="radio" name="oraclemode" checked={g.oracleMode === 'section'} onChange={() => g.setOracleMode('section')} /> {t('oracleModeSection')}</label>
              <div className="opt-row" style={{ marginTop: 12 }}><span>{t('oracleLangTitle')}</span>{seg(g.oracleLang, [{ v: 'follow' as const, l: t('oracleLangFollow') }, { v: 'en' as const, l: 'English' }, { v: 'zh' as const, l: '中文' }], g.setOracleLang)}</div>
            </section>
          )}

          {pane === 'display' && (
            <section>
              <label className="row"><input type="checkbox" checked={showBasics} onChange={e => setSetting('showBasicLands', e.target.checked)} /> Show basic lands (Plains / Island / … incl. Snow-Covered)</label>
              <label className="row"><input type="checkbox" checked={tabRename} onChange={e => setSetting('tabRenameButton', e.target.checked)} /> {t('showTabRename')} <span className="sub">{t('showTabRenameHint')}</span></label>
            </section>
          )}

          {pane === 'pairs' && (
            <section>
              <label className="row"><input type="radio" name="pairs" checked={pairs === 'auto'} onChange={() => setSetting('echoversePairs', 'auto')} /> Auto — show both halves side by side, browse pair by pair</label>
              <label className="row"><input type="radio" name="pairs" checked={pairs === 'off'} onChange={() => setSetting('echoversePairs', 'off')} /> Off — the pair button just jumps to the other half</label>
              {pairs === undefined && <div className="sub">Not decided yet — you'll be asked the first time you press the pair button.</div>}
            </section>
          )}

          {pane === 'experimental' && (
            <section>
              <label className="row"><input type="checkbox" checked={tagger} onChange={e => setSetting('exp.tagger', e.target.checked)} /> Scryfall Tagger community tags (◈) in the Tags section — undocumented API, one request per card, cached 7 days</label>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
