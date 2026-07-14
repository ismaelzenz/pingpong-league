'use client'

import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

interface Props {
  participantId: number
  playerName: string
}

export default function UnenrollButton({ participantId, playerName }: Props) {
  const { run, loading } = useApiAction()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 px-2 text-xs"
      disabled={loading}
      onClick={() => run(`/api/participants/${participantId}`, {
        method: 'DELETE',
        confirm: `Remove ${playerName} from the tournament?`,
      })}
    >
      Remove
    </Button>
  )
}
