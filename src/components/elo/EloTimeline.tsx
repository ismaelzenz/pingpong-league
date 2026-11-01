'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import AddPlayerButton from '@/components/player/AddPlayerButton'
import EloChart, { type ChartSeries } from '@/components/elo/EloChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const MAX_SERIES = 6

interface Props {
  series: ChartSeries[]
  /** Pre-selected on load — the viewer themselves, plus the top of the table. */
  initial: number[]
}

/**
 * The rating timeline plus its player picker. The chart comes first so it's on screen straight
 * away; under it, only the players being plotted show — each chip in its line's colour, doubling
 * as the legend — and everyone else sits behind one "Add player" search rather than a wall of 20+
 * chips.
 *
 * Selection order is deliberately preserved: it's what assigns each line its colour slot, so a
 * player keeps the same colour as others are added or removed around them.
 */
export default function EloTimeline({ series, initial }: Props) {
  const [selected, setSelected] = useState<number[]>(initial.slice(0, MAX_SERIES))

  const full = selected.length >= MAX_SERIES
  const plotted = selected
    .map(id => series.find(s => s.userId === id))
    .filter((s): s is ChartSeries => !!s)
  const addable = series
    .filter(s => !selected.includes(s.userId))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    // overflow-visible: the Add player panel opens below the chips and mustn't be clipped.
    <Card className="overflow-visible">
      <CardHeader className="pb-0">
        <CardTitle className="text-base">Rating over time</CardTitle>
      </CardHeader>
      <CardContent className="elo-viz space-y-3">
        <EloChart series={series} selected={selected} legend={false} />

        <div className="relative flex flex-wrap items-center gap-2">
          {plotted.map((s, i) => (
            <button
              key={s.userId}
              type="button"
              onClick={() => setSelected(cur => cur.filter(x => x !== s.userId))}
              aria-label={`Remove ${s.name} from the chart`}
              className="inline-flex items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-2 text-xs font-medium transition-colors hover:bg-accent"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: `var(--series-${i + 1})` }} />
              {s.name}
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          ))}

          {!full && addable.length > 0 && (
            <AddPlayerButton
              options={addable.map(s => ({ id: s.userId, name: s.name }))}
              onPick={id => setSelected(cur => [...cur, id])}
            />
          )}
        </div>
        {full && (
          <p className="text-xs text-muted-foreground">
            That&apos;s {MAX_SERIES} — remove one to add another. Past six, overlapping lines stop being tellable apart.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
