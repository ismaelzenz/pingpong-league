'use client'

import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

interface Props {
  gameId: number
  mode: 'enter' | 'confirm' | 'postpone'
  isPostponed?: boolean
  /** Player names, used to label the outcome buttons in `enter` mode. */
  homeName?: string
  awayName?: string
}

export default function GameResultForm({ gameId, mode, isPostponed, homeName = 'Home', awayName = 'Away' }: Props) {
  const { run, loading } = useApiAction()

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

  if (mode === 'confirm') {
    return (
      <div className="flex gap-3">
        <Button onClick={() => act('confirm', undefined, 'Result confirmed! Scoreboard updated.')} disabled={loading} className="flex-1">
          {loading ? 'Confirming…' : '✓ Confirm result'}
        </Button>
        <Button
          variant="outline"
          onClick={() => run(`/api/games/${gameId}`, { method: 'PATCH', body: { action: 'dispute' }, confirm: 'Reject this result? It will be cleared and your opponent will need to re-enter the score.', success: 'Result rejected — opponent can re-enter it.' })}
          disabled={loading}
        >
          Dispute
        </Button>
      </div>
    )
  }

  // enter — one tap per valid best-of-3 outcome. Two columns mirror the Home/Away avatar layout:
  // the home player's wins on the left, the away player's on the right.
  const homeOutcomes = [
    { detail: '2–0', homeSets: 2, awaySets: 0 },
    { detail: '2–1', homeSets: 2, awaySets: 1 },
  ]
  const awayOutcomes = [
    { detail: '2–0', homeSets: 0, awaySets: 2 },
    { detail: '2–1', homeSets: 1, awaySets: 2 },
  ]

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Who won, and how?</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {homeOutcomes.map(o => (
            <Button
              key={`h-${o.detail}`}
              variant="outline"
              disabled={loading}
              onClick={() => act('enter', { homeSets: o.homeSets, awaySets: o.awaySets }, 'Result submitted — waiting for opponent to confirm')}
              className="w-full h-auto flex-col items-center gap-0.5 py-2.5"
            >
              <span className="font-semibold truncate max-w-full">{homeName} won</span>
              <span className="text-xs text-muted-foreground font-mono">{o.detail}</span>
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          {awayOutcomes.map(o => (
            <Button
              key={`a-${o.detail}`}
              variant="outline"
              disabled={loading}
              onClick={() => act('enter', { homeSets: o.homeSets, awaySets: o.awaySets }, 'Result submitted — waiting for opponent to confirm')}
              className="w-full h-auto flex-col items-center gap-0.5 py-2.5"
            >
              <span className="font-semibold truncate max-w-full">{awayName} won</span>
              <span className="text-xs text-muted-foreground font-mono">{o.detail}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
