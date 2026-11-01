'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

interface Props {
  gameId: number
  mode: 'enter' | 'postpone'
  isPostponed?: boolean
  /** Player names, used to label the outcome buttons in `enter` mode. */
  homeName?: string
  awayName?: string
}

type Outcome = { winner: string; detail: string; homeSets: number; awaySets: number }

export default function GameResultForm({ gameId, mode, isPostponed, homeName = 'Home', awayName = 'Away' }: Props) {
  const { run, loading } = useApiAction()
  const [pending, setPending] = useState<Outcome | null>(null)

  function act(action: string, extra?: object, success?: string) {
    return run(`/api/games/${gameId}`, { method: 'PATCH', body: { action, ...extra }, success })
  }

  if (mode === 'postpone') {
    return (
      <Button variant={isPostponed ? 'outline' : 'secondary'} onClick={() => act('postpone', undefined, isPostponed ? 'Game is active again' : 'Game marked as postponed')} disabled={loading} className="w-full">
        {loading ? 'Updating…' : isPostponed ? 'Unpostpone game' : 'Mark as postponed'}
      </Button>
    )
  }

  // enter — one tap per valid best-of-3 outcome. Two columns mirror the Home/Away avatar layout:
  // the home player's wins on the left, the away player's on the right.
  const homeOutcomes: Outcome[] = [
    { winner: homeName, detail: '2–0', homeSets: 2, awaySets: 0 },
    { winner: homeName, detail: '2–1', homeSets: 2, awaySets: 1 },
  ]
  const awayOutcomes: Outcome[] = [
    { winner: awayName, detail: '2–0', homeSets: 0, awaySets: 2 },
    { winner: awayName, detail: '2–1', homeSets: 1, awaySets: 2 },
  ]

  // Picking an outcome stages it; a second tap commits. There's no opponent approval any more, so
  // the score goes straight onto the scoreboard and into both ELO ratings — one glance at what
  // you're about to record is worth the extra tap.
  if (pending) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Record this?</p>
          <p className="mt-1 font-semibold">
            {homeName} <span className="font-mono">{pending.homeSets} – {pending.awaySets}</span> {awayName}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Counts immediately — no confirmation needed from your opponent. Either of you can correct it afterwards.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={loading}
            onClick={() => act('enter', { homeSets: pending.homeSets, awaySets: pending.awaySets }, 'Result recorded — scoreboard and ELO updated')}
          >
            {loading ? 'Recording…' : 'Confirm result'}
          </Button>
          <Button variant="outline" onClick={() => setPending(null)} disabled={loading}>Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Who won, and how?</p>
      <div className="grid grid-cols-2 gap-3">
        {[homeOutcomes, awayOutcomes].map((column, c) => (
          <div key={c} className="space-y-2">
            {column.map(o => (
              <Button
                key={`${c}-${o.detail}`}
                variant="outline"
                disabled={loading}
                onClick={() => setPending(o)}
                className="w-full h-auto flex-col items-center gap-0.5 py-2.5"
              >
                <span className="font-semibold truncate max-w-full">{o.winner} won</span>
                <span className="text-xs text-muted-foreground font-mono">{o.detail}</span>
              </Button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
