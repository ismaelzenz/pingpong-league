'use client'

import { Children, useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Shows the first `initial` children and a "Show all N" toggle for the rest. The items are rendered
 * on the server and passed in as children — only the toggle runs in the browser.
 */
export default function ShowMoreList({ initial, label, className, children }: {
  initial: number
  /** What the list holds, for the toggle: "Show all 5 {label}". */
  label: string
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const items = Children.toArray(children)
  const hidden = items.length - initial

  return (
    <>
      <div className={className}>{open || hidden <= 0 ? items : items.slice(0, initial)}</div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="mx-auto flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {open ? 'Show fewer' : `Show all ${items.length} ${label}`}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    </>
  )
}
