'use client'

import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

interface Props {
  gameId: number
  isPostponed: boolean
}

export default function AdminGameActions({ gameId, isPostponed }: Props) {
  const { run, loading } = useApiAction()

  function callAction(action: string, confirmMsg?: string) {
    return run(`/api/games/${gameId}`, {
      method: 'PATCH',
      body: { action },
      confirm: confirmMsg,
      success: action === 'forfeit' ? 'Game forfeited' : isPostponed ? 'Game marked as pending' : 'Game postponed',
    })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Admin actions</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => callAction('postpone')}
          className="flex-1"
        >
          {isPostponed ? 'Mark as pending' : 'Postpone'}
        </Button>
        <Button
          variant="destructive"
          disabled={loading}
          onClick={() => callAction('forfeit', 'Forfeit this game? Sets will be recorded as 0–0.')}
          className="flex-1"
        >
          Forfeit
        </Button>
      </div>
    </div>
  )
}
