'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'
import { AlertTriangle } from 'lucide-react'

interface Props {
  gameId: number
  homeName: string
  awayName: string
  homeSets: number
  awaySets: number
}

/**
 * The replacement for the old confirm/dispute step. Results are auto-approved on entry, so the
 * other player doesn't approve anything — they only step in when the score on the board is wrong,
 * and then they just enter the right one. Collapsed behind a link so the common case (the score is
 * fine) stays out of the way.
 */
export default function ReportResultForm({ gameId, homeName, awayName, homeSets, awaySets }: Props) {
  const { run, loading } = useApiAction()
  const [open, setOpen] = useState(false)

  const outcomes = [
    { label: `${homeName} won`, detail: '2–0', homeSets: 2, awaySets: 0 },
    { label: `${homeName} won`, detail: '2–1', homeSets: 2, awaySets: 1 },
    { label: `${awayName} won`, detail: '2–0', homeSets: 0, awaySets: 2 },
    { label: `${awayName} won`, detail: '2–1', homeSets: 1, awaySets: 2 },
  ].filter(o => !(o.homeSets === homeSets && o.awaySets === awaySets))

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Report a wrong result
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pick the correct result. It replaces the recorded score straight away — no confirmation needed.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {outcomes.map(o => (
          <Button
            key={`${o.homeSets}-${o.awaySets}`}
            variant="outline"
            disabled={loading}
            onClick={() => run(`/api/games/${gameId}`, {
              method: 'PATCH',
              body: { action: 'report', homeSets: o.homeSets, awaySets: o.awaySets },
              confirm: `Change the result to ${o.homeSets}–${o.awaySets}?`,
              success: (d: { eloChanged?: boolean }) =>
                d.eloChanged ? 'Result corrected — ELO recalculated.' : 'Result corrected.',
            })}
            className="w-full h-auto flex-col items-center gap-0.5 py-2.5"
          >
            <span className="font-semibold truncate max-w-full">{o.label}</span>
            <span className="text-xs text-muted-foreground font-mono">{o.detail}</span>
          </Button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
      >
        Never mind — the result is right
      </button>
    </div>
  )
}
