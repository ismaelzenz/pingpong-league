'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Content folded away behind a "Show …" button. The content is rendered on the server and passed in
 * as children — only the toggle runs in the browser.
 */
export default function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {open && children}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="mx-auto flex items-center gap-1 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        {open ? 'Show fewer' : label}
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </>
  )
}
