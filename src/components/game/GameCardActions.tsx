'use client'

import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

// Inline confirm/dispute on a game card, so the opponent can act without opening the game.
// Rendered above the card's stretched overlay link (z-10) so taps hit the buttons, not the card.
export default function GameCardActions({ gameId }: { gameId: number }) {
  const { run, loading } = useApiAction()

  return (
    <div className="relative z-10 mt-2 flex gap-2">
      <Button
        size="sm"
        disabled={loading}
        onClick={e => { e.preventDefault(); run(`/api/games/${gameId}`, { method: 'PATCH', body: { action: 'confirm' }, success: 'Result confirmed!' }) }}
      >
        ✓ Confirm
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={e => { e.preventDefault(); run(`/api/games/${gameId}`, { method: 'PATCH', body: { action: 'dispute' }, confirm: 'Reject this result? It will be cleared and your opponent will need to re-enter the score.', success: 'Result rejected — opponent can re-enter it.' }) }}
      >
        Dispute
      </Button>
    </div>
  )
}
