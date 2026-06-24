'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface Props {
  gameId: number
  isPostponed: boolean
}

export default function AdminGameActions({ gameId, isPostponed }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function callAction(action: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success(action === 'forfeit' ? 'Game forfeited' : isPostponed ? 'Game marked as pending' : 'Game postponed')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Admin actions</p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => callAction('postpone')}
          className="flex-1"
        >
          {isPostponed ? 'Mark as pending' : 'Postpone'}
        </Button>
        <Button
          variant="destructive"
          disabled={loading}
          onClick={() => {
            if (confirm('Forfeit this game? Sets will be recorded as 0–0.')) callAction('forfeit')
          }}
          className="flex-1"
        >
          Forfeit
        </Button>
      </div>
    </div>
  )
}
