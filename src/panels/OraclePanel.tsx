import { useEffect, useState } from 'react'
import type { DockviewApi, DockviewPanelApi } from 'dockview-react'
import { t } from '../i18n'
import { useGrader } from '../state'
import { asCard, type OracleParams } from '../docks'

interface Props { api: DockviewPanelApi; containerApi: DockviewApi; params: OracleParams }

// Rules text as its own dock. v0.10: it belongs to ONE card dock (params.ownerId) and lives directly beneath it —
// owner changes card, this follows; owner closes, this closes. With ownerId null (the default "shared" mode) it
// instead follows whichever card dock has focus, which is what v0.9.7 did.
export default function OraclePanel({ api, containerApi, params }: Props) {
  const g = useGrader()
  // No owner = the shared panel: it follows whichever card dock has focus, in EVERY mode. oracleMode only decides
  // whether newly opened card docks get a companion of their own — it must not strand this one.
  const ownerId = params.ownerId ?? g.activeCardPanelId
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!ownerId) return
    const owner = containerApi.getPanel(ownerId)
    if (!owner) { if (params.ownerId) api.close(); return }
    const onParams = owner.api.onDidParametersChange(() => setTick(x => x + 1))
    const onRemove = containerApi.onDidRemovePanel(p => { if (p.id === ownerId) api.close() })
    return () => { onParams.dispose(); onRemove.dispose() }
  }, [ownerId, containerApi, api, params.ownerId])

  const owner = ownerId ? containerApi.getPanel(ownerId) : undefined
  void tick
  const bound = owner ? asCard(owner.params) : undefined
  const c = bound?.set && bound.oracleId ? g.cardByKey.get(`${bound.set}:${bound.oracleId}`) ?? null : null
  if (!c) return <div className="empty">Select a card.</div>

  // oracleLang pins this panel's language independently of the global card language
  const lang = g.oracleLang === 'follow' ? g.cardLang : g.oracleLang
  const zh = lang === 'zh' ? g.zhRowOf(c) : undefined
  const name = zh?.name || c.name
  const type = zh?.typeLine || c.typeLine
  const text = zh?.text ? (zh.backText ? `${zh.text}\n//\n${zh.backText}` : zh.text) : c.oracleText
  return (
    <div className="panel">
      <h2 style={{ marginBottom: 2 }}>{name}</h2>
      <div className="sub">{c.manaCost} · {type} · {c.rarity} · {c.set.toUpperCase()} #{c.collectorNumber}</div>
      <div className="oracle" style={{ marginTop: 10, fontSize: 14 }}>{text}</div>
      {zh && zh.flavor && <div className="sub" style={{ marginTop: 6, fontStyle: 'italic' }}>{zh.flavor}</div>}
      {zh && <div className="sub" style={{ marginTop: 6 }}>中文資料：<a href={`https://mtgch.com/card/${c.set}/${c.collectorNumber}`} target="_blank" rel="noreferrer">大學院廢墟 ↗</a></div>}
      {c.keywords.length > 0 && <div className="sub" style={{ marginTop: 8 }}>{t('keywords')}: {c.keywords.join(', ')}</div>}
      <div className="sub" style={{ marginTop: 8 }}><a href={c.scryfallUri} target="_blank" rel="noreferrer">Scryfall ↗</a></div>
    </div>
  )
}
