'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  participantId: number
  playerName: string
}

export default function UnenrollButton({ participantId, playerName }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleUnenroll() {
    if (!confirm(`Remove ${playerName} from the tournament?`)) return
    setLoading(true)
    const res = await fetch(`/api/participants/${participantId}`, { method: 'DELETE' })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? 'Failed to unenroll player')
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 px-2 text-xs"
      onClick={handleUnenroll}
      disabled={loading}
    >
      Remove
    </Button>
  )
}
