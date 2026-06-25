'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Props {
  gameId: number
  homeSets: number | null
  awaySets: number | null
}

export default function AdminEditResultForm({ gameId, homeSets, awaySets }: Props) {
  const router = useRouter()
  const [home, setHome] = useState(homeSets != null ? String(homeSets) : '')
  const [away, setAway] = useState(awaySets != null ? String(awaySets) : '')
  const [loading, setLoading] = useState(false)

  async function save() {
    const h = parseInt(home), a = parseInt(away)
    if (isNaN(h) || isNaN(a)) { toast.error('Pick both scores'); return }
    if (!((h === 2 && (a === 0 || a === 1)) || (a === 2 && (h === 0 || h === 1)))) {
      toast.error('A valid result is 2–0, 2–1, 0–2 or 1–2'); return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/games/${gameId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'admin-set-result', homeSets: h, awaySets: a }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      toast.success('Result updated')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex items-center gap-2">
        <Select value={home} onValueChange={v => setHome(v ?? '')}>
          <SelectTrigger className="w-16"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0</SelectItem>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">–</span>
        <Select value={away} onValueChange={v => setAway(v ?? '')}>
          <SelectTrigger className="w-16"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">0</SelectItem>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save result'}</Button>
    </div>
  )
}
