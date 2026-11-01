'use client'

import { useState } from 'react'
import EloChart, { type ChartSeries } from '@/components/elo/EloChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const MAX_SERIES = 6

interface Props {
  series: ChartSeries[]
  /** Pre-selected on load — the viewer themselves, plus the top of the table. */
  initial: number[]
}

/**
 * The rating timeline plus its player picker. Selection order is deliberately preserved: it's
 * what assigns each line its colour slot, so a player keeps the same colour as others are added
 * or removed around them.
 */
export default function EloTimeline({ series, initial }: Props) {
  const [selected, setSelected] = useState<number[]>(initial.slice(0, MAX_SERIES))

  function toggle(id: number) {
    setSelected(cur => {
      if (cur.includes(id)) return cur.filter(x => x !== id)
      if (cur.length >= MAX_SERIES) return cur
      return [...cur, id]
    })
  }

  const full = selected.length >= MAX_SERIES

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rating over time</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add players to compare their curves — up to {MAX_SERIES} at once.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {series.map(s => {
            const on = selected.includes(s.userId)
            const disabled = !on && full
            return (
              <button
                key={s.userId}
                type="button"
                onClick={() => toggle(s.userId)}
                disabled={disabled}
                aria-pressed={on}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                  disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground',
                )}
              >
                {s.name}
              </button>
            )
          })}
        </div>
        {full && (
          <p className="text-xs text-muted-foreground">
            That&apos;s {MAX_SERIES} — remove one to add another. Past six, overlapping lines stop being
            tellable apart.
          </p>
        )}
        <EloChart series={series} selected={selected} />
      </CardContent>
    </Card>
  )
}
