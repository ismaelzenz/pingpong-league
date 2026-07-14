'use client'

import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

export default function DeleteTournamentButton({ tournamentId, name }: { tournamentId: number; name: string }) {
  const { run, loading } = useApiAction()

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-600 hover:bg-red-50"
      disabled={loading}
      onClick={() => run(`/api/tournaments/${tournamentId}`, {
        method: 'DELETE',
        confirm: `Delete "${name}"? This permanently removes all games, matchdays, and results.`,
        success: 'Tournament deleted',
      })}
    >
      {loading ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
