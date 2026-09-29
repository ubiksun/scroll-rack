import { useEffect, type MutableRefObject } from 'react'
import type { DockviewApi } from 'dockview-react'
import { upsertRating } from '../db'
import { asDock } from '../docks'
import { useGrader } from '../state'

// Global keyboard, resolved through the dock last touched:
//   in a search dock:   ← → move the highlight · Enter loads it · 1–9 rate the channel's card (or the highlight)
//   in a follower dock: ← → step the channel's list and load · 1–9 rate its card
//   n = the note box of a comments dock in the same channel · Esc = close the peek / leave the input
export function useDockKeyboard(apiRef: MutableRefObject<DockviewApi | null>) {
  const g = useGrader()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const tag = el.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
      if (e.key === 'Escape') { g.closePeek(); g.setPicking(null); el.blur?.(); return }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      const api = apiRef.current
      const active = (g.activeDockId ? api?.getPanel(g.activeDockId) : undefined) ?? api?.activePanel
      if (!active) return
      const p = asDock(active.params)
      const isSearch = p.kind === 'search'
      const nav = isSearch ? g.navOf(p.scopeId ?? 'main') : g.navOfChannel(p.channel)

      if (e.key === 'ArrowRight') { if (isSearch) nav?.goNext(); else nav?.loadStep?.(1); e.preventDefault(); return }
      if (e.key === 'ArrowLeft') { if (isSearch) nav?.goPrev(); else nav?.loadStep?.(-1); e.preventDefault(); return }
      if (e.key === 'Enter' && isSearch) { nav?.loadSelected?.(); return }

      const channel = isSearch ? active.id : p.channel
      const ref = isSearch ? g.channelCards[active.id] : (p.linked ? g.channelCards[p.channel] : p.own)
      const card = (ref ? g.cardByKey.get(`${ref.set}:${ref.oracleId}`) : undefined) ?? (isSearch ? nav?.selected : null) ?? null

      if (/^[1-9]$/.test(e.key) && card && g.firstCtx && g.firstScheme) {
        const tier = g.firstScheme.tiers[Number(e.key) - 1]
        if (tier) void upsertRating(card.set, card.oracleId, g.firstCtx.id, { tier: g.ratingOf(card, g.firstCtx.id)?.tier === tier.name ? null : tier.name })
        return
      }
      if (e.key === 'n' && g.firstCtx) {
        e.preventDefault()
        const comment = api?.panels.find(x => { const d = asDock(x.params); return d.kind === 'comment' && d.linked && d.channel === channel }) ?? api?.panels.find(x => asDock(x.params).kind === 'comment')
        const box = comment ? document.getElementById(`${comment.id}-note-${g.firstCtx.id}`) : null
        ;(box as HTMLTextAreaElement | null)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apiRef, g.activeDockId, g.navOf, g.navOfChannel, g.channelCards, g.cardByKey, g.firstCtx, g.firstScheme, g.ratingOf, g.closePeek, g.setPicking])
}
