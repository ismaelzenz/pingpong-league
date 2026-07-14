'use client'

import { Button } from '@/components/ui/button'
import { Radio } from 'lucide-react'
import { useApiAction } from '@/hooks/useApiAction'

export default function SetLiveButton({ tournamentId }: { tournamentId: number }) {
  const { run, loading } = useApiAction()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={() => run('/api/tournaments/live', {
        body: { tournamentId },
        confirm: 'Make this the live tournament? Players will see this one instead of the current live tournament.',
        success: 'This tournament is now live for players',
      })}
    >
      <Radio className="w-4 h-4 mr-1" />
      {loading ? 'Setting…' : 'Set as live'}
    </Button>
  )
}
