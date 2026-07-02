'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Radio } from 'lucide-react'

export default function SetLiveButton({ tournamentId }: { tournamentId: number }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!confirm('Make this the live tournament? Players will see this one instead of the current live tournament.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/tournaments/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to set live')
      toast.success('This tournament is now live for players')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      <Radio className="w-4 h-4 mr-1" />
      {loading ? 'Setting…' : 'Set as live'}
    </Button>
  )
}
