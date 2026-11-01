'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useApiAction } from '@/hooks/useApiAction'
import { TrendingUp } from 'lucide-react'

interface Props {
  tournamentId: number
  countsForElo: boolean
  /** Timestamp results started counting from, or null when the whole season counts. */
  eloCountsFrom: string | null
  /** Games already recorded in this season — what's at stake when switching ELO on. */
  playedGames: number
}

/**
 * Whether a season feeds players' lifetime ELO, changeable at any point in its life.
 *
 * Switching it **on midway** is the case that needs a question rather than a toggle: the season
 * already has results, and rating them retroactively moves everyone's standing for games played
 * under different assumptions. That's a real decision with no safe default, so it's asked outright
 * instead of guessed — and the answer is stored as a cutoff, not applied once, because ratings are
 * rebuilt by replaying the games and "we chose to skip those" has to survive every future replay.
 */
export default function EloTournamentToggle({ tournamentId, countsForElo, eloCountsFrom, playedGames }: Props) {
  const { run, loading } = useApiAction()
  const [asking, setAsking] = useState(false)

  function save(next: boolean, includePlayed?: 'all' | 'future') {
    setAsking(false)
    run<{ ratedGames?: number }>(`/api/tournaments/${tournamentId}`, {
      method: 'PATCH',
      body: { countsForElo: next, includePlayed },
      success: d => next
        ? `Counting for ELO — ${d.ratedGames ?? 0} game${d.ratedGames === 1 ? '' : 's'} now rated`
        : 'No longer counting for ELO — ratings rebuilt without this season',
    })
  }

  function onToggle(next: boolean) {
    // Turning it on with results already in the books is the only branch that needs a choice.
    if (next && !countsForElo && playedGames > 0) { setAsking(true); return }
    save(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> Count for ELO
          </p>
          <p className="text-xs text-muted-foreground">
            {countsForElo
              ? eloCountsFrom
                ? `Results count toward lifetime ELO ratings, from ${new Date(eloCountsFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} onward.`
                : 'Results count toward players’ lifetime ELO ratings.'
              : 'Results are ignored by ELO — use this for a test or bug-repro season.'}
          </p>
        </div>
        <Switch
          checked={countsForElo}
          onCheckedChange={onToggle}
          disabled={loading || asking}
          aria-label="Count for ELO"
          className="mt-0.5"
        />
      </div>

      {asking && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-3">
          <div>
            <p className="text-sm font-medium">
              This season already has {playedGames} recorded result{playedGames === 1 ? '' : 's'}.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Should those count toward ELO too, or should rating start from now?
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save(true, 'all')} disabled={loading}>
              Count all {playedGames}
            </Button>
            <Button size="sm" variant="outline" onClick={() => save(true, 'future')} disabled={loading}>
              Only from now on
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Either way everyone&apos;s ratings are recalculated from scratch, so nothing is double-counted.
          </p>
        </div>
      )}
    </div>
  )
}
