import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, setSetting, DEFAULT_BADGE_STYLE, type BadgeStyle, type Context } from '../db'
import { useGrader } from '../state'
import { t } from '../i18n'
import { BadgeStacks, type BadgeInfo } from './CardGrid'

interface Props { contexts: Context[] }
let styleQueue: Promise<void> = Promise.resolve()

const POS: { v: BadgeStyle['pos']; l: string }[] = [
  { v: 'tl', l: '↖' }, { v: 'tr', l: '↗' }, { v: 'bl', l: '↙' }, { v: 'br', l: '↘' },
]

// How comments render on a card image — with a real card from the user's own library as a live preview, so the
// corner/shape/size choices can be judged where they actually land instead of in the abstract.
export default function BadgeDesign({ contexts }: Props) {
  const g = useGrader()
  const styles = useLiveQuery(() => getSetting<Record<string, Partial<BadgeStyle>>>('badgeStyles', {}), []) ?? {}
  const styleOf = (id: string): BadgeStyle => ({ ...DEFAULT_BADGE_STYLE, ...(styles[id] ?? {}) })
  // serialized read-modify-write so rapid successive edits don't clobber each other
  const setStyle = (id: string, patch: Partial<BadgeStyle>) => {
    styleQueue = styleQueue.then(async () => {
      const cur = await getSetting<Record<string, Partial<BadgeStyle>>>('badgeStyles', {})
      await setSetting('badgeStyles', { ...cur, [id]: { ...(cur[id] ?? {}), ...patch } })
    })
  }

  const demo = g.cards[0] ?? g.allCards[0]
  // every comment gets its middle tier in the preview, so each one is visible whether or not it is rated
  const preview: BadgeInfo[] = contexts.map(c => {
    const tiers = g.schemeOf(c.id)?.tiers ?? []
    const tier = tiers[Math.floor(tiers.length / 2)] ?? { name: '—', color: '#888888' }
    return { ctxId: c.id, ctx: c.name, tier: tier.name, color: tier.color, style: styleOf(c.id) }
  })

  return (
    <>
      <div className="sub" style={{ marginBottom: 8 }}>{t('badgesHint')}</div>
      <div className="badge-design">
        <div className="badge-preview">
          <div className="sub">{t('badgePreview')}</div>
          {demo ? (
            <div className="preview-card">
              <img src={g.imageOf(demo, 'large')} alt={demo.name} />
              <BadgeStacks badges={preview} />
            </div>
          ) : <div className="empty">{t('noPreviewCard')}</div>}
        </div>
        <div className="badge-controls">
          {contexts.map(c => {
            const st = styleOf(c.id)
            return (
              <div className="block" key={c.id}>
                <div className="block-head"><b>{c.name}</b></div>
                <div className="block-body">
                  <label>{t('badgeCorner')}
                    <span className="seg">{POS.map(p => (
                      <button key={p.v} className={st.pos === p.v ? 'active' : ''} onClick={() => setStyle(c.id, { pos: p.v })}>{p.l}</button>
                    ))}</span>
                  </label>
                  <label>{t('badgeShape')}
                    <select value={st.shape} onChange={e => setStyle(c.id, { shape: e.target.value as BadgeStyle['shape'] })}>
                      <option value="pill">pill</option><option value="circle">circle</option><option value="square">square</option>
                    </select>
                  </label>
                  <label>{t('badgeSize')}
                    <span className="seg">{(['s', 'm', 'l'] as const).map(z => (
                      <button key={z} className={st.size === z ? 'active' : ''} onClick={() => setStyle(c.id, { size: z })}>{z.toUpperCase()}</button>
                    ))}</span>
                  </label>
                  <label>{t('badgeLabel')}
                    <select value={st.label} onChange={e => setStyle(c.id, { label: e.target.value as BadgeStyle['label'] })}>
                      <option value="tier">{t('badgeLabelTier')}</option><option value="full">{t('badgeLabelFull')}</option>
                    </select>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
