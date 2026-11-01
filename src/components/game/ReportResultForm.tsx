'use client'

import { useApiAction } from '@/hooks/useApiAction'
import { OUTCOMES } from '@/lib/domain/gameResult'
import OutcomeButton from '@/components/game/OutcomeButton'

interface Props {
  gameId: number
  /** Short names for the outcome buttons ("You", a first name). */
  homeName: string
  awayName: string
  homeSets: number
  awaySets: number
}

/**
 * The replacement for the old confirm/dispute step. Results are auto-approved on entry, so the
 * other player doesn't approve anything — they only step in when the score on the board is wrong,
 * and then they just enter the right one. The page folds it behind a "Wrong score?" toggle so the
 * common case (the score is fine) stays out of the way.
 */
export default function ReportResultForm({ gameId, homeName, awayName, homeSets, awaySets }: Props) {
  const { run, loading } = useApiAction()

  // Every result except the one already recorded.
  const outcomes = OUTCOMES.filter(o => !(o.homeSets === homeSets && o.awaySets === awaySets))

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pick the correct result. It replaces the recorded score straight away — no confirmation needed.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {outcomes.map(o => (
          <OutcomeButton
            key={`${o.homeSets}-${o.awaySets}`}
            label={`${o.winner === 'home' ? homeName : awayName} won`}
            detail={o.detail}
            disabled={loading}
            onClick={() => run(`/api/games/${gameId}`, {
              method: 'PATCH',
              body: { action: 'report', homeSets: o.homeSets, awaySets: o.awaySets },
              confirm: `Change the result to ${o.homeSets}–${o.awaySets}?`,
              success: (d: { eloChanged?: boolean }) =>
                d.eloChanged ? 'Result corrected — ELO recalculated.' : 'Result corrected.',
            })}
          />
        ))}
      </div>
    </div>
  )
}
