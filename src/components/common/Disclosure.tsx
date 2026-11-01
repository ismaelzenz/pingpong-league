'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Content folded away behind a "Show …" button. The content is rendered on the server and passed in
 * as children — only the toggle runs in the browser.
 *
 * By default it's a "show more" list tail: content first, a centred toggle under it. `opensBelow`
 * flips that for a fold-out section — a left-aligned toggle that opens its content beneath it.
 */
export default function Disclosure({ label, closeLabel = 'Show fewer', opensBelow = false, children }: {
  label: string
  closeLabel?: string
  opensBelow?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const toggle = (
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      aria-expanded={open}
      className={cn(
        'flex items-center gap-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground',
        opensBelow ? '' : 'mx-auto',
      )}
    >
      {open ? closeLabel : label}
      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
    </button>
  )
  // Slides open and shut: a grid row animating between 0fr and 1fr eases to the content's real
  // height without measuring it. Always mounted so it can animate closed too — `inert` keeps the
  // folded content out of tab order and away from screen readers.
  const panel = (
    <div
      inert={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        {/* The gap to the toggle lives in here, so it folds away with the content. */}
        <div className={opensBelow ? 'pt-3' : 'pb-3'}>{children}</div>
      </div>
    </div>
  )
  // One wrapper, so a parent's `space-y` spaces it as a single block, open or shut.
  return <div>{opensBelow ? <>{toggle}{panel}</> : <>{panel}{toggle}</>}</div>
}
