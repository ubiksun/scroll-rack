import { useEffect, useMemo, useRef, useState } from 'react'
import type { SetMeta } from '../db'
import { listSets, type ScryfallSetListItem } from '../api/scryfall'
import { standardSets, tierOf, TIER_LABEL, TIER_ORDER, type Tier } from '../api/formats'

interface Props {
  local: SetMeta[]
  active: string[]
  onToggle: (code: string) => void
  onPull: (code: string) => void
  onPullMany: (codes: string[]) => void
  busy: string | null
}

// One menu for everything set-related: which sets are active (checkbox, multi), which are cached (✓), pull/refresh.
// Rows are newest-first with format dividers (Standard / Pioneer / Modern / Other); unreleased sets are faded.
export default function SetPicker({ local, active, onToggle, onPull, onPullMany, busy }: Props) {
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState<ScryfallSetListItem[]>([])
  const [standard, setStandard] = useState<Set<string> | null>(null)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const wrap = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  useEffect(() => {
    if (!open || remote.length) return
    listSets().then(setRemote, e => setErr(String(e)))
    void standardSets().then(setStandard)
  }, [open])

  const today = new Date().toISOString().slice(0, 10)
  const localBy = useMemo(() => new Map(local.map(s => [s.code, s])), [local])
  const rows = useMemo(() => {
    const seen = new Set<string>()
    const all: (ScryfallSetListItem & { tier: Tier })[] = []
    for (const s of remote) { seen.add(s.code); all.push({ ...s, tier: tierOf(s, standard) }) }
    for (const s of local) if (!seen.has(s.code)) all.push({ code: s.code, name: s.name, released_at: s.releasedAt, set_type: 'expansion', card_count: s.cardCount, icon_svg_uri: s.iconSvg, digital: false, tier: tierOf({ code: s.code, released_at: s.releasedAt, set_type: 'expansion', name: s.name }, standard) })
    all.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || b.released_at.localeCompare(a.released_at))
    const f = q.trim().toLowerCase()
    return f ? all.filter(r => r.code.includes(f) || r.name.toLowerCase().includes(f)) : all
  }, [remote, local, q, standard])

  const label = active.length ? active.map(c => c.toUpperCase()).join(' + ') : 'Sets'
  let lastTier: Tier | null = null
  return (
    <span className="menu-wrap" ref={wrap}>
      <button onClick={() => setOpen(v => !v)}>{label} ▾</button>
      {open && (
        <div className="menu setmenu">
          <input autoFocus placeholder="filter sets…" value={q} onChange={e => setQ(e.target.value)} />
          {err && <div className="sub">{err}</div>}
          {!remote.length && !err && <div className="sub">loading set list…</div>}
          <div className="setlist">
            {rows.map(r => {
              const cached = localBy.get(r.code)
              const on = active.includes(r.code)
              const unreleased = r.released_at > today
              const tierRows = rows.filter(x => x.tier === r.tier && x.released_at <= today)
              const divider = r.tier !== lastTier ? (
                <div className="setdivider" key={`d-${r.tier}`}>
                  <span>{TIER_LABEL[r.tier]}</span>
                  {r.tier !== 'other' && <button onClick={() => onPullMany(tierRows.map(x => x.code))} title={`Load & activate all ${tierRows.length} released sets in this group (${tierRows.filter(x => !localBy.has(x.code)).length} still to download)`}>load all {tierRows.length}</button>}
                </div>
              ) : null
              lastTier = r.tier
              return (
                <div key={r.code} style={{ display: 'contents' }}>
                  {divider}
                  <div className={`setrow${on ? ' on' : ''}${unreleased ? ' unreleased' : ''}`} title={unreleased ? `releases ${r.released_at} — preview cards only` : (cached ? 'click: show / hide' : 'click: download & show')}
                    onClick={e => { if ((e.target as HTMLElement).closest('button')) return; onToggle(r.code) }}>
                    <input type="checkbox" checked={on} readOnly />
                    <span className="code">{r.code.toUpperCase()}</span>
                    <span className="name">{r.name}</span>
                    <span className="sub">{r.released_at}</span>
                    {busy === r.code ? <span className="sub">…</span>
                      : cached ? <button title={`cached ${cached.cardCount} cards · click to re-fetch`} onClick={e => { e.stopPropagation(); onPull(r.code) }}>✓ {cached.cardCount} ↻</button>
                      : <button title="download from Scryfall" onClick={e => { e.stopPropagation(); onPull(r.code) }}>↓</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
