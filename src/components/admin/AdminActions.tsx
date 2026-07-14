'use client'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useApiAction } from '@/hooks/useApiAction'

interface Props {
  tournamentId: number
  status: string
  participantCount: number
}

export default function AdminActions({ tournamentId, status, participantCount }: Props) {
  const { run, loading } = useApiAction()

  async function handleStart() {
    if (participantCount < 2) { toast.error('Need at least 2 participants'); return }
    await run<{ matchdays: number }>('/api/tournaments/start', {
      body: { tournamentId },
      confirm: `Start the tournament with ${participantCount} participants? This generates the full schedule and cannot be undone.`,
      success: d => `Tournament started! ${d.matchdays} matchdays generated.`,
    })
  }

  function handleForfeit() {
    return run<{ forfeited: number }>('/api/games/forfeit', {
      body: { tournamentId },
      confirm: 'Mark all unplayed games from past matchdays as forfeited (0–0)?',
      success: d => (d.forfeited > 0 ? `${d.forfeited} games forfeited` : 'No unplayed past games found'),
    })
  }

  function handleRegenerate() {
    return run<{ matchdays: number; games: number }>('/api/tournaments/regenerate', {
      body: { tournamentId },
      confirm:
        'Rebuild the upcoming schedule for the current roster?\n\n' +
        'Matchdays that have already started are left untouched. Unplayed games in future ' +
        'matchdays are reshuffled into a clean round-robin, and anything that no longer fits ' +
        'becomes a catch-up game. Use this to fix the schedule after adding players.',
      success: d => `Schedule rebuilt — ${d.matchdays} matchdays, ${d.games} games`,
    })
  }

  function handleFinish() {
    return run('/api/tournaments/finish', {
      body: { tournamentId },
      confirm: 'Mark this tournament as finished?',
      success: 'Tournament finished!',
    })
  }

  function handleCancel() {
    return run(`/api/tournaments/${tournamentId}`, {
      method: 'DELETE',
      confirm: 'Cancel this tournament? All registrations will be removed and this cannot be undone.',
      success: 'Tournament cancelled',
    })
  }

  if (status === 'registration') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {participantCount} participant{participantCount !== 1 ? 's' : ''} registered.
          Once everyone is in, close registration and generate the schedule.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleStart} disabled={loading || participantCount < 2}>
            {loading ? 'Generating schedule…' : 'Close registration & start tournament'}
          </Button>
          <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleCancel} disabled={loading}>
            Cancel tournament
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Tournament is active.</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={handleForfeit} disabled={loading}>
          Forfeit unplayed games
        </Button>
        <Button variant="outline" onClick={handleRegenerate} disabled={loading}>
          Regenerate schedule
        </Button>
        <Button variant="destructive" onClick={handleFinish} disabled={loading}>
          End tournament
        </Button>
      </div>
    </div>
  )
}
