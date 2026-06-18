'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  tournamentId: number
  status: string
  participantCount: number
}

export default function AdminActions({ tournamentId, status, participantCount }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function callApi(url: string, body: object) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Request failed')
    return data
  }

  async function handleStart() {
    if (participantCount < 2) { toast.error('Need at least 2 participants'); return }
    if (!confirm(`Start the tournament with ${participantCount} participants? This generates the full schedule and cannot be undone.`)) return
    setLoading(true)
    try {
      const data = await callApi('/api/tournaments/start', { tournamentId })
      toast.success(`Tournament started! ${data.matchdays} matchdays generated.`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  async function handleForfeit() {
    if (!confirm('Mark all unplayed games from past matchdays as forfeited (0–0)?')) return
    setLoading(true)
    try {
      const data = await callApi('/api/games/forfeit', { tournamentId })
      toast.success(data.forfeited > 0 ? `${data.forfeited} games forfeited` : 'No unplayed past games found')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  async function handleFinish() {
    if (!confirm('Mark this tournament as finished?')) return
    setLoading(true)
    try {
      await callApi('/api/tournaments/finish', { tournamentId })
      toast.success('Tournament finished!')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  if (status === 'registration') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {participantCount} participant{participantCount !== 1 ? 's' : ''} registered.
          Once everyone is in, close registration and generate the schedule.
        </p>
        <Button onClick={handleStart} disabled={loading || participantCount < 2}>
          {loading ? 'Generating schedule…' : 'Close registration & start tournament'}
        </Button>
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
        <Button variant="destructive" onClick={handleFinish} disabled={loading}>
          End tournament
        </Button>
      </div>
    </div>
  )
}
