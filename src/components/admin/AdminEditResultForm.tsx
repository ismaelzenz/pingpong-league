'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { isValidResult } from '@/lib/domain/gameResult'
import { useApiAction } from '@/hooks/useApiAction'

interface Props {
  gameId: number
  homeSets: number | null
  awaySets: number | null
}

export default function AdminEditResultForm({ gameId, homeSets, awaySets }: Props) {
  const { run, loading } = useApiAction()
  const [home, setHome] = useState(homeSets != null ? String(homeSets) : '')
  const [away, setAway] = useState(awaySets != null ? String(awaySets) : '')

  async function save() {
    const h = parseInt(home), a = parseInt(away)
    if (isNaN(h) || isNaN(a)) { toast.error('Pick both scores'); return }
    if (!isValidResult(h, a)) {
      toast.error('A valid result is 2–0, 2–1, 0–2 or 1–2'); return
    }
    await run(`/api/games/${gameId}`, {
      method: 'PATCH',
      body: { action: 'admin-set-result', homeSets: h, awaySets: a },
      success: 'Result updated',
    })
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
