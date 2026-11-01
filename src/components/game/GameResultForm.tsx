'use client'

import { useState } from 'react'
import { useApiAction } from '@/hooks/useApiAction'
import { OUTCOMES, type Outcome } from '@/lib/domain/gameResult'
import OutcomeButton from '@/components/game/OutcomeButton'
import ConfirmResultPanel from '@/components/game/ConfirmResultPanel'

interface Props {
  gameId: number
  /** Player names, for the confirm step's score line. */
  homeName?: string
  awayName?: string
  /** Short names for the outcome buttons ("You", a first name) — full names truncate on a phone. */
  homeLabel?: string
  awayLabel?: string
}

/** Entering a league game's result: one tap per valid best-of-3 outcome, then a confirm step. */
export default function GameResultForm({ gameId, homeName = 'Home', awayName = 'Away', homeLabel = homeName, awayLabel = awayName }: Props) {
  const { run, loading } = useApiAction()
  const [pending, setPending] = useState<Outcome | null>(null)

  // Picking an outcome stages it; a second tap commits. There's no opponent approval any more, so
  // the score goes straight onto the scoreboard and into both ELO ratings — one glance at what
  // you're about to record is worth the extra tap.
  if (pending) {
    return (
      <ConfirmResultPanel
        score={<>{homeName} <span className="font-mono">{pending.homeSets} – {pending.awaySets}</span> {awayName}</>}
        note="Counts immediately — no confirmation needed from your opponent. Either of you can correct it afterwards."
        confirmLabel="Confirm result"
        loading={loading}
        onConfirm={() => run(`/api/games/${gameId}`, {
          method: 'PATCH',
          body: { action: 'enter', homeSets: pending.homeSets, awaySets: pending.awaySets },
          success: 'Result recorded — scoreboard and ELO updated',
        })}
        onBack={() => setPending(null)}
      />
    )
  }

  // Two columns mirror the Home/Away avatar layout: the home player's wins on the left, the away
  // player's on the right.
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Who won, and how?</p>
      <div className="grid grid-cols-2 gap-3">
        {(['home', 'away'] as const).map(side => (
          <div key={side} className="space-y-2">
            {OUTCOMES.filter(o => o.winner === side).map(o => (
              <OutcomeButton
                key={o.detail}
                label={`${side === 'home' ? homeLabel : awayLabel} won`}
                detail={o.detail}
                disabled={loading}
                onClick={() => setPending(o)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
