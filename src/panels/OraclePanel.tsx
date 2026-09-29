import { t } from '../i18n'
import { useGrader } from '../state'
import type { DockviewApi } from 'dockview-react'
import type { DockParams } from '../docks'
import { useDockCard } from '../hooks/useDockCard'
import { FrozenBar } from './TabPanel'

// The ORACLE dock: rules text of the channel's card (or its frozen card). oracleLang pins its language independently
// of the global card language. It is also a collapsible section inside the comments dock.
export default function OraclePanel({ containerApi, params }: { containerApi: DockviewApi; params: DockParams }) {
  const g = useGrader()
  const c = useDockCard(params)
  if (!c) return <div className="empty">{t('selectCardHint')}</div>
  const lang = g.oracleLang === 'follow' ? g.cardLang : g.oracleLang
  const zh = lang === 'zh' ? g.zhRowOf(c) : undefined
  const name = zh?.name || c.name
  const type = zh?.typeLine || c.typeLine
  const text = zh?.text ? (zh.backText ? `${zh.text}\n//\n${zh.backText}` : zh.text) : c.oracleText
  return (
    <div className="panel">
      {!params.linked && <FrozenBar containerApi={containerApi} card={c} />}
      <h2 style={{ marginBottom: 2 }}>{name}</h2>
      <div className="sub">{c.manaCost} · {type} · {c.rarity} · {c.set.toUpperCase()} #{c.collectorNumber}</div>
      <div className="oracle" style={{ marginTop: 10, fontSize: 14 }}>{text}</div>
      {zh && zh.flavor && <div className="sub" style={{ marginTop: 6, fontStyle: 'italic' }}>{zh.flavor}</div>}
      {zh && <div className="sub" style={{ marginTop: 6 }}>中文资料：<a href={`https://mtgch.com/card/${c.set}/${c.collectorNumber}`} target="_blank" rel="noreferrer">大学院废墟 ↗</a></div>}
      {c.keywords.length > 0 && <div className="sub" style={{ marginTop: 8 }}>{t('keywords')}: {c.keywords.join(', ')}</div>}
      <div className="sub" style={{ marginTop: 8 }}><a href={c.scryfallUri} target="_blank" rel="noreferrer">Scryfall ↗</a></div>
    </div>
  )
}
