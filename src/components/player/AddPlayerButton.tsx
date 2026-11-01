'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import PlayerSearchList, { type PlayerOption } from '@/components/player/PlayerSearchList'
import { cn } from '@/lib/utils'

/**
 * A dashed "+ Add player" chip that opens the app's player search (`PlayerSearchList`) in a small
 * panel below it. Picking a name closes it; so do Escape and a tap anywhere outside.
 *
 * On a phone the panel spans its nearest positioned ancestor (give the chip row `relative`) so it
 * can't run off the screen's edge; from `sm` up it's a fixed-width panel under the chip. The
 * container must not clip overflow, or the panel gets cut off.
 */
export default function AddPlayerButton({ options, onPick, currentUserId, label = 'Add player' }: {
  options: PlayerOption[]
  onPick: (id: number) => void
  currentUserId?: number
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={rootRef} className="sm:relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground',
          open ? 'bg-accent text-foreground' : 'text-muted-foreground',
        )}
      >
        <Plus className="h-3.5 w-3.5" /> {label}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-lg sm:inset-x-auto sm:left-0 sm:w-64 bg-popover p-2 text-popover-foreground shadow-lg ring-1 ring-foreground/10">
          <PlayerSearchList
            options={options}
            currentUserId={currentUserId}
            autoFocus
            listClassName="max-h-56"
            onPick={id => { onPick(id); setOpen(false) }}
          />
        </div>
      )}
    </div>
  )
}
