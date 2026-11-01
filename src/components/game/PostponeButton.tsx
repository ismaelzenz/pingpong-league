'use client'

import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

/**
 * Marks a game postponed, or — if it already is — puts it back to be played. `inline` renders it
 * as a quiet text link with a prompt, for under a result form where a full button would compete
 * with entering the score.
 */
export default function PostponeButton({ gameId, isPostponed, inline = false }: { gameId: number; isPostponed: boolean; inline?: boolean }) {
  const { run, loading } = useApiAction()
  const act = () => run(`/api/games/${gameId}`, {
    method: 'PATCH',
    body: { action: 'postpone' },
    success: isPostponed ? 'Game is active again' : 'Game marked as postponed',
  })

  if (inline) {
    return (
      <p className="text-sm text-muted-foreground">
        {isPostponed ? 'Ready to play it after all? ' : 'Can’t play it this week? '}
        <button type="button" onClick={act} disabled={loading} className="font-medium text-foreground underline underline-offset-4 hover:text-primary disabled:opacity-50">
          {loading ? 'Updating…' : isPostponed ? 'Unpostpone' : 'Postpone'}
        </button>
      </p>
    )
  }

  return (
    <Button
      variant={isPostponed ? 'outline' : 'secondary'}
      onClick={act}
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Updating…' : isPostponed ? 'Unpostpone game' : 'Mark as postponed'}
    </Button>
  )
}
