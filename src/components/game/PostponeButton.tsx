'use client'

import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

/** Marks a game postponed, or — if it already is — puts it back to be played. */
export default function PostponeButton({ gameId, isPostponed }: { gameId: number; isPostponed: boolean }) {
  const { run, loading } = useApiAction()

  return (
    <Button
      variant={isPostponed ? 'outline' : 'secondary'}
      onClick={() => run(`/api/games/${gameId}`, {
        method: 'PATCH',
        body: { action: 'postpone' },
        success: isPostponed ? 'Game is active again' : 'Game marked as postponed',
      })}
      disabled={loading}
      className="w-full"
    >
      {loading ? 'Updating…' : isPostponed ? 'Unpostpone game' : 'Mark as postponed'}
    </Button>
  )
}
