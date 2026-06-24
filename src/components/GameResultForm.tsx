'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Props {
  gameId: number
  mode: 'enter' | 'confirm' | 'postpone'
  isPostponed?: boolean
}

export default function GameResultForm({ gameId, mode, isPostponed }: Props) {
  const router = useRouter()
  const [homeSets, setHomeSets] = useState('')
  const [awaySets, setAwaySets] = useState('')
  const [loading, setLoading] = useState(false)

  async function callApi(action: string, extra?: object) {
    const res = await fetch(`/api/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Request failed')
  }

  async function handleEnter() {
    const h = parseInt(homeSets)
    const a = parseInt(awaySets)
    if (isNaN(h) || isNaN(a)) { toast.error('Please select both scores'); return }
    setLoading(true)
    try {
      await callApi('enter', { homeSets: h, awaySets: a })
      toast.success('Result submitted — waiting for opponent to confirm')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      await callApi('confirm')
      toast.success('Result confirmed! Scoreboard updated.')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  async function handleDispute() {
    setLoading(true)
    try {
      await callApi('dispute')
      toast.warning('Result rejected. Opponent can re-enter the correct score.')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  async function handlePostpone() {
    setLoading(true)
    try {
      await callApi('postpone')
      toast.info(isPostponed ? 'Game is active again' : 'Game marked as postponed')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  if (mode === 'postpone') {
    return (
      <Button variant={isPostponed ? 'outline' : 'secondary'} onClick={handlePostpone} disabled={loading} className="w-full">
        {loading ? 'Updating…' : isPostponed ? 'Unpostpone game' : 'Mark as postponed'}
      </Button>
    )
  }

  if (mode === 'confirm') {
    return (
      <div className="flex gap-3">
        <Button onClick={handleConfirm} disabled={loading} className="flex-1">
          {loading ? 'Confirming…' : '✓ Confirm result'}
        </Button>
        <Button variant="outline" onClick={handleDispute} disabled={loading}>
          Dispute
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Home sets won</Label>
          <Select value={homeSets} onValueChange={v => setHomeSets(v ?? '')}>
            <SelectTrigger><SelectValue placeholder="Sets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Away sets won</Label>
          <Select value={awaySets} onValueChange={v => setAwaySets(v ?? '')}>
            <SelectTrigger><SelectValue placeholder="Sets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Best of 3. Valid: 2–0 or 2–1 only.
      </p>
      <Button onClick={handleEnter} disabled={loading} className="w-full">
        {loading ? 'Submitting…' : 'Submit result'}
      </Button>
    </div>
  )
}
