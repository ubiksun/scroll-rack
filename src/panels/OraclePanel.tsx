import { t } from '../i18n'
import { useGrader } from '../state'

// Oracle text as its own dockable module (round-2 item 2).
export default function OraclePanel() {
  const g = useGrader()
  const c = g.selected
  if (!c) return <div className="empty">Select a card.</div>
  const zh = g.zhOf(c)
  return (
    <div className="panel">
      <h2 style={{ marginBottom: 2 }}>{g.nameOf(c)}</h2>
      <div className="sub">{c.manaCost} · {g.typeOf(c)} · {c.rarity} · {c.set.toUpperCase()} #{c.collectorNumber}</div>
      <div className="oracle" style={{ marginTop: 10, fontSize: 14 }}>{g.oracleOf(c)}</div>
      {zh && zh.flavor && <div className="sub" style={{ marginTop: 6, fontStyle: 'italic' }}>{zh.flavor}</div>}
      {zh && <div className="sub" style={{ marginTop: 6 }}>中文資料：<a href={`https://mtgch.com/card/${c.set}/${c.collectorNumber}`} target="_blank" rel="noreferrer">大學院廢墟 ↗</a></div>}
      {c.keywords.length > 0 && <div className="sub" style={{ marginTop: 8 }}>{t('keywords')}: {c.keywords.join(', ')}</div>}
      <div className="sub" style={{ marginTop: 8 }}><a href={c.scryfallUri} target="_blank" rel="noreferrer">Scryfall ↗</a></div>
    </div>
  )
}
