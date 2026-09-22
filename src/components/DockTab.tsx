import { useEffect, useRef, useState } from 'react'
import type { IDockviewPanelHeaderProps } from 'dockview-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting } from '../db'
import { asCard, isCardPanel } from '../docks'
import { t } from '../i18n'

// Custom tab: the panel's own name is the control surface. Every tab — Search, Card, Oracle alike — gets rename (✎)
// and pin (📌), to the LEFT of the close ✕. Double-clicking the name renames too.
// Pin means "protect this dock": the ✕ is hidden, and a card dock stops being its search dock's preview slot.
export default function DockTab({ api, containerApi }: IDockviewPanelHeaderProps) {
  const [title, setTitle] = useState(api.title ?? '')
  const [editing, setEditing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const [tick, setTick] = useState(0)
  const showRename = useLiveQuery(() => getSetting<boolean>('tabRenameButton', true), []) ?? true

  useEffect(() => {
    const d = api.onDidTitleChange(e => setTitle(e.title ?? ''))
    return () => d.dispose()
  }, [api])
  useEffect(() => {
    const d = api.onDidParametersChange(() => setTick(x => x + 1))
    return () => d.dispose()
  }, [api])
  void tick

  const panel = containerApi.getPanel(api.id)
  const params = (panel?.params ?? {}) as Record<string, unknown>
  const pinned = params.pinned === true
  const cardParams = panel && isCardPanel(panel) ? asCard(panel.params) : null

  const commit = (value: string) => {
    const name = value.trim()
    setEditing(false)
    // dockview persists a panel's title in its own layout JSON, so setTitle is all that is needed — and being the
    // ONLY writer is what makes a rename stick.
    if (!name) return
    api.setTitle(name)
  }
  const togglePin = () => {
    // a pinned card dock also stops being the preview slot its search dock replaces
    const next: Record<string, unknown> = { ...params, pinned: !pinned }
    if (cardParams && !pinned) next.primary = false
    api.updateParameters(next)
  }

  return (
    <div className={`lg-tab${pinned ? ' pinned' : ''}`} onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}>
      {editing ? (
        <input ref={input} className="lg-tab-input" defaultValue={title} autoFocus
          onFocus={e => e.target.select()}
          onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation()
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
            if (e.key === 'Escape') setEditing(false)
          }} />
      ) : (
        <span className="lg-tab-name">{title}</span>
      )}
      <span className="lg-tab-actions" onMouseDown={e => e.stopPropagation()}>
        <button className={pinned ? 'on' : ''} title={pinned ? t('unpinDock') : t('pinDock')}
          onClick={e => { e.stopPropagation(); togglePin() }}>📌</button>
        {showRename && (
          <button title={t('renameDock')} onClick={e => { e.stopPropagation(); setEditing(true) }}>✎</button>
        )}
      </span>
      {!pinned && (
        <span className="lg-tab-close" title={t('close')} onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); api.close() }}>✕</span>
      )}
    </div>
  )
}
