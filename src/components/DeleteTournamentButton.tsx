'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function DeleteTournamentButton({ tournamentId, name }: { tournamentId: number; name: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This permanently removes all games, matchdays, and results.`)) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error')
      toast.success('Tournament deleted')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  return (
    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" disabled={loading} onClick={handleDelete}>
      {loading ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
