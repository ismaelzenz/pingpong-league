'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { WHATS_NEW } from '@/lib/domain/whatsNew'
import { Sparkles, X } from 'lucide-react'

/**
 * The once-per-member release note.
 *
 * Styled loud on purpose. This appears exactly once per person per release, so the usual reasons to
 * keep an in-app banner quiet — it'll be seen every day, it competes with the real content — don't
 * apply. A note nobody reads is worse than no note: people then discover that results stopped
 * needing confirmation by being confused in the middle of a game.
 *
 * The colour is carried by low-opacity tints over the card surface, and all text stays on the
 * regular foreground tokens, so it reads the same in light and dark rather than being a light-mode
 * design that goes muddy at night.
 *
 * Dismissal is optimistic: it hides the instant it's tapped and tells the server afterwards. If
 * that request fails the worst case is seeing the note again next visit, which is a far better
 * failure than a banner that won't go away while someone is trying to use the app.
 */

/** One accent per item, in a fixed order so the list reads as a set rather than a rainbow. */
const TINTS = [
  'bg-emerald-500/15 ring-emerald-500/30',
  'bg-sky-500/15 ring-sky-500/30',
  'bg-fuchsia-500/15 ring-fuchsia-500/30',
  'bg-amber-500/15 ring-amber-500/30',
]

export default function WhatsNewBanner() {
  const [dismissed, setDismissed] = useState(false)

  function dismiss() {
    setDismissed(true)
    // Deliberately not awaited, and errors are swallowed — see above.
    fetch('/api/whats-new/seen', { method: 'POST' }).catch(() => {})
  }

  if (dismissed) return null

  return (
    <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
      {/* The travelling light lives on the frame (see globals.css); everything below sits on an
          opaque surface inside it, so only the 2px rim shows the moving gradient. */}
      <div className="whats-new-frame rounded-xl shadow-lg">
        <div className="relative overflow-hidden rounded-[calc(0.75rem-2px)] bg-card">
          {/* A full-bleed gradient wash, kept faint so every word on top stays on a normal text
              colour instead of fighting the background. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-500/10 via-fuchsia-500/10 to-amber-400/10"
          />

          <div className="relative p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-fuchsia-500 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-fuchsia-600 dark:text-fuchsia-400">
                    What&apos;s new
                  </p>
                  <h2 className="text-xl font-black leading-tight">{WHATS_NEW.title}</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {WHATS_NEW.items.map((item, i) => (
                <li
                  key={item.title}
                  className="flex gap-3 rounded-lg bg-background/60 p-3 ring-1 ring-border/60"
                >
                  <span
                    aria-hidden
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base ring-1 ${TINTS[i % TINTS.length]}`}
                  >
                    {item.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex items-center gap-3">
              <Button size="sm" onClick={dismiss} className="font-semibold">Got it</Button>
              <span className="text-xs text-muted-foreground">You&apos;ll only see this once.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
