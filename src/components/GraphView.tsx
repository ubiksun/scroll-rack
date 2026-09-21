import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import type { Card, CardTag, Edge } from '../db'
import { t } from '../i18n'

interface Props {
  cards: Map<string, Card>            // oracleId → card (all loaded sets)
  edges: Edge[]
  tierColorOf: (oracleId: string) => string | undefined   // colour of the card's first rated context
  tags: CardTag[]
  focus: string | null                // oracleId; null = global graph
  hops: number
  onSelect: (oracleId: string) => void
  imageOf: (c: Card) => string
}

// Obsidian-style graph: global = every card with ≥1 edge; local = N-hop neighbourhood of the focused card.
// Layers (item 7.4): each edge tag is a layer you can switch off; untagged edges are their own layer. Plus min degree + node tag.
export default function GraphView({ cards, edges, tierColorOf, tags, focus, hops, onSelect, imageOf }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const allLayers = useMemo(() => [...new Set(edges.flatMap(e => e.tags.length ? e.tags : ['(untagged)']))].sort(), [edges])
  const allTags = useMemo(() => [...new Set(tags.map(x => x.tag))].sort(), [tags])
  const [offLayers, setOffLayers] = useState<Set<string>>(new Set())
  const [minDeg, setMinDeg] = useState(1)
  const [tagF, setTagF] = useState('')

  const visible = useMemo(() => {
    // an edge shows if at least one of its layers is on
    let es = edges.filter(e => (e.tags.length ? e.tags : ['(untagged)']).some(l => !offLayers.has(l)))
    if (tagF) {
      const tagged = new Set(tags.filter(x => x.tag === tagF).map(x => x.oracleId))
      es = es.filter(e => tagged.has(e.a) || tagged.has(e.b))
    }
    let keep: Set<string> | null = null
    if (focus) {
      keep = new Set([focus]); let frontier = new Set([focus])
      for (let i = 0; i < hops; i++) {
        const next = new Set<string>()
        for (const e of es) { if (frontier.has(e.a) && !keep.has(e.b)) next.add(e.b); if (frontier.has(e.b) && !keep.has(e.a)) next.add(e.a) }
        next.forEach(n => keep!.add(n)); frontier = next
      }
      es = es.filter(e => keep!.has(e.a) && keep!.has(e.b))
    }
    if (minDeg > 1) {
      const deg = new Map<string, number>()
      es.forEach(e => { deg.set(e.a, (deg.get(e.a) ?? 0) + 1); deg.set(e.b, (deg.get(e.b) ?? 0) + 1) })
      es = es.filter(e => (deg.get(e.a) ?? 0) >= minDeg && (deg.get(e.b) ?? 0) >= minDeg)
    }
    return { es, keep }
  }, [edges, offLayers, tagF, focus, hops, minDeg, tags])

  const [tick, setTick] = useState(0)   // bumped when a hidden (0×0) container becomes visible
  useEffect(() => {
    if (!ref.current) return
    // Docked panels stay mounted while hidden; cytoscape can't lay out in a 0×0 box. Wait for size.
    if (ref.current.clientWidth === 0 || ref.current.clientHeight === 0) {
      const ro = new ResizeObserver(() => { if (ref.current && ref.current.clientWidth > 0) { ro.disconnect(); setTick(x => x + 1) } })
      ro.observe(ref.current)
      return () => ro.disconnect()
    }
    const tierColor = (oid: string) => tierColorOf(oid) ?? '#3a3d48'
    const nodeIds = new Set<string>(visible.keep && hops === 0 ? [] : (visible.keep ?? []))
    visible.es.forEach(e => { nodeIds.add(e.a); nodeIds.add(e.b) })
    const elements: cytoscape.ElementDefinition[] = []
    nodeIds.forEach(oid => {
      const c = cards.get(oid)
      elements.push({ data: { id: oid, label: c?.name ?? oid.slice(0, 8), color: tierColor(oid), img: c ? imageOf(c) : '', focus: oid === focus ? 1 : 0 } })
    })
    visible.es.forEach(e => elements.push({ data: { id: `e${e.id}`, source: e.a, target: e.b, label: e.tags.join(' · '), source_kind: e.source } }))

    cyRef.current?.destroy()
    let cy: cytoscape.Core
    try { cy = cytoscape({
      container: ref.current,
      elements,
      style: [
        { selector: 'node', style: { 'background-color': 'data(color)', 'background-image': 'data(img)', 'background-fit': 'cover', 'border-width': 3, 'border-color': 'data(color)', width: 44, height: 62, shape: 'round-rectangle', label: 'data(label)', color: '#e6e6ea', 'font-size': 9, 'text-valign': 'bottom', 'text-margin-y': 4, 'text-wrap': 'ellipsis', 'text-max-width': '80px' } },
        { selector: 'node[focus = 1]', style: { 'border-color': '#6e9bff', 'border-width': 5 } },
        { selector: 'edge', style: { width: 2, 'line-color': '#4a4e5c', 'curve-style': 'bezier', label: 'data(label)', 'font-size': 8, color: '#8b8d98', 'text-rotation': 'autorotate', 'text-background-color': '#0d0e12', 'text-background-opacity': 1, 'text-background-padding': '2px' } },
        { selector: 'edge[source_kind = "deck"]', style: { 'line-style': 'dashed' } },
        { selector: 'edge[source_kind = "set"]', style: { 'line-color': '#6e9bff', width: 3 } },
        { selector: 'edge[source_kind = "suggested"]', style: { 'line-style': 'dotted', 'line-color': '#7a6a2a' } },
      ],
      layout: { name: 'cose', animate: false, nodeRepulsion: () => 12000, idealEdgeLength: () => 110 } as cytoscape.LayoutOptions,
      minZoom: 0.2, maxZoom: 1.6,
    }) } catch (e) { console.warn('graph layout failed', e); return }
    cy.on('tap', 'node', evt => onSelect(evt.target.id()))
    cy.fit(undefined, 60)
    cyRef.current = cy
    // docked panel resizes → canvas must follow
    const ro = new ResizeObserver(() => { cy.resize(); cy.fit(undefined, 60) })
    ro.observe(ref.current)
    return () => { ro.disconnect(); cy.destroy(); cyRef.current = null }
  }, [cards, visible, tierColorOf, focus, hops, imageOf, onSelect, tick])

  if (!edges.length && !focus) return <div className="empty">{t('noLinks')}</div>
  return (
    <div className="graph-wrap">
      <div className="graph-tools">
        <span className="status">layers:</span>
        {allLayers.map(l => <button key={l} className={offLayers.has(l) ? '' : 'active'} onClick={() => setOffLayers(s => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n })}>{l === '(untagged)' ? l : `#${l}`}</button>)}
        <span className="status" style={{ marginLeft: 10 }}>{t('minDegree')}:</span>
        <input type="range" min={1} max={6} value={minDeg} onChange={e => setMinDeg(Number(e.target.value))} style={{ width: 90 }} /><span className="status">{minDeg}</span>
        <select value={tagF} onChange={e => setTagF(e.target.value)} style={{ marginLeft: 10 }}><option value="">{t('nodeTag')}</option>{allTags.map(x => <option key={x} value={x}>#{x}</option>)}</select>
        <span className="status" style={{ marginLeft: 'auto' }}>{visible.es.length} edges</span>
      </div>
      <div className="graph" ref={ref} />
    </div>
  )
}
