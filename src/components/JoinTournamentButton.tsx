'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function JoinTournamentButton({ tournamentId }: { tournamentId: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleJoin() {
    setLoading(true)
    const res = await fetch('/api/tournaments/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to join')
    } else {
      toast.success('You joined the tournament!')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <Button onClick={handleJoin} disabled={loading} size="lg">
      {loading ? 'Joining…' : 'Join the tournament'}
    </Button>
  )
}
