'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { UserMinus } from 'lucide-react'

interface Props {
  participantId: number
  playerName: string
}

export default function EliminatePlayerButton({ participantId, playerName }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleEliminate() {
    if (!confirm(
      `Eliminate ${playerName} from the active tournament?\n\n` +
      `This permanently deletes ALL of their games — both upcoming matchdays and ` +
      `results already played. Any points, victories, sets won/lost that other players ` +
      `earned against ${playerName} will be removed and the scoreboard recalculated.\n\n` +
      `This cannot be undone.`
    )) return

    setLoading(true)
    try {
      const res = await fetch(`/api/participants/${participantId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to eliminate player')
      toast.success(
        `${playerName} eliminated — ${data.deletedGames ?? 0} game${data.deletedGames === 1 ? '' : 's'} removed`
      )
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 px-2 text-xs"
      onClick={handleEliminate}
      disabled={loading}
    >
      <UserMinus className="w-3.5 h-3.5 mr-1" />
      {loading ? 'Eliminating…' : 'Eliminate'}
    </Button>
  )
}
