'use client'

import { Button } from '@/components/ui/button'
import { UserMinus } from 'lucide-react'
import { useApiAction } from '@/hooks/useApiAction'

interface Props {
  participantId: number
  playerName: string
}

export default function EliminatePlayerButton({ participantId, playerName }: Props) {
  const { run, loading } = useApiAction()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 px-2 text-xs"
      disabled={loading}
      onClick={() => run<{ deletedGames?: number }>(`/api/participants/${participantId}`, {
        method: 'DELETE',
        confirm:
          `Eliminate ${playerName} from the active tournament?\n\n` +
          `This permanently deletes ALL of their games — both upcoming matchdays and ` +
          `results already played. Any points, victories, sets won/lost that other players ` +
          `earned against ${playerName} will be removed and the scoreboard recalculated.\n\n` +
          `This cannot be undone.`,
        success: data =>
          `${playerName} eliminated — ${data.deletedGames ?? 0} game${data.deletedGames === 1 ? '' : 's'} removed`,
      })}
    >
      <UserMinus className="w-3.5 h-3.5 mr-1" />
      {loading ? 'Eliminating…' : 'Eliminate'}
    </Button>
  )
}
