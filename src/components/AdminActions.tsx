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

  async function handleRegenerate() {
    if (!confirm(
      'Rebuild the upcoming schedule for the current roster?\n\n' +
      'Matchdays that have already started are left untouched. Unplayed games in future ' +
      'matchdays are reshuffled into a clean round-robin, and anything that no longer fits ' +
      'becomes a catch-up game. Use this to fix the schedule after adding players.'
    )) return
    setLoading(true)
    try {
      const data = await callApi('/api/tournaments/regenerate', { tournamentId })
      toast.success(`Schedule rebuilt — ${data.matchdays} matchdays, ${data.games} games`)
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

  async function handleCancel() {
    if (!confirm('Cancel this tournament? All registrations will be removed and this cannot be undone.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success('Tournament cancelled')
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
