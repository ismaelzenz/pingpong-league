'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'
import { Trash2 } from 'lucide-react'

interface Props {
  gameId: number
  homeName: string
  awayName: string
  homeSets: number
  awaySets: number
}

/** Correct or remove a casual game — the ELO-side equivalent of "report a wrong result". */
export default function EloGameActions({ gameId, homeName, awayName, homeSets, awaySets }: Props) {
  const { run, loading } = useApiAction()
  const [open, setOpen] = useState(false)

  const outcomes = [
    { label: `${homeName} won`, detail: '2–0', homeSets: 2, awaySets: 0 },
    { label: `${homeName} won`, detail: '2–1', homeSets: 2, awaySets: 1 },
    { label: `${awayName} won`, detail: '2–1', homeSets: 1, awaySets: 2 },
    { label: `${awayName} won`, detail: '2–0', homeSets: 0, awaySets: 2 },
  ].filter(o => !(o.homeSets === homeSets && o.awaySets === awaySets))

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 shrink-0"
      >
        Wrong?
      </button>
    )
  }

  return (
    <div className="w-full space-y-2 border-t pt-2 mt-2">
      <p className="text-xs text-muted-foreground">Pick the correct result, or remove the game.</p>
      <div className="flex flex-wrap gap-2">
        {outcomes.map(o => (
          <Button
            key={`${o.homeSets}-${o.awaySets}`}
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => run(`/api/elo/games/${gameId}`, {
              method: 'PATCH',
              body: { homeSets: o.homeSets, awaySets: o.awaySets },
              success: (d: { eloChanged?: boolean }) =>
                d.eloChanged ? 'Corrected — ratings recalculated.' : 'Corrected.',
            })}
          >
            {o.label} {o.detail}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => run(`/api/elo/games/${gameId}`, {
            method: 'DELETE',
            confirm: 'Remove this game? Everyone’s ratings will be recalculated without it.',
            success: 'Game removed',
          })}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}
