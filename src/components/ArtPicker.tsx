import { useEffect, useRef, useState } from 'react'
import { pickPrinting, type ArtMode, type ArtPref, type Card } from '../db'

interface Props {
  card: Card
  src: string
  className?: string
  artPref: ArtPref | undefined
  artMode: ArtMode
  onSetArt: (printingId: string | null) => void
}

// Big card image with a hover-only "art" button; click → popover of every printing in the set, click one to pin it.
export default function ArtPicker({ card, src, className, artPref, artMode, onSetArt }: Props) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', down); return () => document.removeEventListener('mousedown', down)
  }, [open])
  const many = (card.printings?.length ?? 0) > 1
  const shownId = pickPrinting(card, artMode, artPref).id
  return (
    <div className="artwrap" ref={wrap}>
      <img className={className} src={src} alt={card.name} />
      {many && <button className="art-btn" onClick={() => setOpen(v => !v)} title="choose card art">🖼 {card.printings.length}</button>}
      {open && (
        <div className="art-pop">
          {card.printings.map(p => (
            <div key={p.id} className={`art-opt${shownId === p.id ? ' on' : ''}`} onClick={() => { onSetArt(artPref?.printingId === p.id ? null : p.id); setOpen(false) }}>
              <img src={p.imageSmall} alt={`#${p.collectorNumber}`} />
              <span>#{p.collectorNumber}{artPref?.printingId === p.id ? ' · pinned' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
