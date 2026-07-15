'use client'

import { Button } from '@/components/ui/button'
import { useApiAction } from '@/hooks/useApiAction'

// Lets a logged-in player enrol themselves in the tournament while registration is open.
export default function JoinTournamentButton() {
  const { run, loading } = useApiAction()

  return (
    <Button
      onClick={() => run('/api/tournaments/join', { success: "You're in! 🏓" })}
      disabled={loading}
    >
      {loading ? 'Joining…' : 'Join the tournament'}
    </Button>
  )
}
