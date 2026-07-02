'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'

interface EligibleUser {
  id: number
  name: string
  email: string
}

interface Props {
  tournamentId: number
  eligibleUsers: EligibleUser[]
  // 'registration' = tournament not started yet (plain enroll); 'active' = mid-season add
  // that rebuilds the schedule.
  phase?: 'registration' | 'active'
}

export default function AddPlayerForm({ tournamentId, eligibleUsers, phase = 'active' }: Props) {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)

  if (eligibleUsers.length === 0) {
    return <p className="text-sm text-muted-foreground">Everyone with an account is already in this tournament.</p>
  }

  async function handleAdd() {
    if (!userId) { toast.error('Pick a player to add'); return }
    const player = eligibleUsers.find(u => String(u.id) === userId)
    if (phase === 'active' && !confirm(
      `Add ${player?.name} to the tournament mid-season?\n\n` +
      `The schedule is rebuilt as a fresh double round-robin for the new roster — already-played ` +
      `results are kept. ${player?.name} gets games against everyone; those in matchdays that have ` +
      `already started become catch-up games, the rest are upcoming.`
    )) return

    setLoading(true)
    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, userId: Number(userId) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to add player')
      toast.success(
        phase === 'registration'
          ? `${data.name} added to the tournament`
          : `${data.name} added — ${data.totalGames} games created ` +
            `(${data.catchUpGames} catch-up, ${data.upcomingGames} upcoming)`
      )
      setUserId('')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <Select value={userId} onValueChange={v => setUserId(v ?? '')}>
        <SelectTrigger className="sm:w-64">
          <SelectValue placeholder="Select a player to add…">
            {(value: string | null) => eligibleUsers.find(u => String(u.id) === value)?.name ?? value}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {eligibleUsers.map(u => (
            <SelectItem key={u.id} value={String(u.id)}>
              {u.name} <span className="text-muted-foreground">({u.email})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleAdd} disabled={loading || !userId}>
        <UserPlus className="w-4 h-4 mr-1" />
        {loading ? 'Adding…' : 'Add player'}
      </Button>
    </div>
  )
}
