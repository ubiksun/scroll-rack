import { useEffect, type MutableRefObject } from 'react'
import type { DockviewApi } from 'dockview-react'
import { upsertRating } from '../db'
import { asCard } from '../docks'
import { useGrader } from '../state'

// Global keyboard: ← → navigate the FOCUSED search dock · 1–9 tier on the focused card · n notes · Esc back to grid.
// Moved out of GraderProvider in v0.10 — with N docks "current" has to be resolved through the dock topology, and the
// note textarea is addressed by `${panelId}-note-${ctxId}` because several CardPanels can be mounted at once.
export function useDockKeyboard(apiRef: MutableRefObject<DockviewApi | null>) {
  const g = useGrader()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const tag = el.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
      const nav = g.navOf(g.activeScopeId)
      if (e.key === 'Escape') { el.blur?.(); if (!typing && nav?.view === 'single') nav.setView('grid'); return }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'ArrowRight') { nav?.goNext(); e.preventDefault(); return }
      if (e.key === 'ArrowLeft') { nav?.goPrev(); e.preventDefault(); return }

      // the card the rating keys act on: the focused card dock, else the focused search dock's selection
      const api = apiRef.current
      const panel = g.activeCardPanelId ? api?.getPanel(g.activeCardPanelId) : undefined
      const bound = panel ? asCard(panel.params) : undefined
      const card = (bound?.set && bound.oracleId ? g.cardByKey.get(`${bound.set}:${bound.oracleId}`) : undefined) ?? nav?.selected ?? null

      if (/^[1-9]$/.test(e.key) && card && g.firstCtx && g.firstScheme) {
        const tier = g.firstScheme.tiers[Number(e.key) - 1]
        if (tier) void upsertRating(card.set, card.oracleId, g.firstCtx.id, { tier: g.ratingOf(card, g.firstCtx.id)?.tier === tier.name ? null : tier.name })
        return
      }
      if (e.key === 'n' && g.firstCtx) {
        e.preventDefault()
        const id = panel ? `${panel.id}-note-${g.firstCtx.id}` : null
        const box = (id && document.getElementById(id)) || document.querySelector(`[id$="-note-${g.firstCtx.id}"]`)
        ;(box as HTMLTextAreaElement | null)?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apiRef, g.activeScopeId, g.activeCardPanelId, g.navOf, g.cardByKey, g.firstCtx, g.firstScheme, g.ratingOf])
}
