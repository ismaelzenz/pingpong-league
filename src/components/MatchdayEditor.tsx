'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react'

interface Player { id: number; name: string }
interface GameRow { id: number; homePlayerId: number; awayPlayerId: number }

interface Props {
  matchdayId: number
  games: GameRow[]
  roster: Player[]
}

export default function MatchdayEditor({ matchdayId, games, roster }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [addHome, setAddHome] = useState('')
  const [addAway, setAddAway] = useState('')

  const nameOf = (id: number) => roster.find(p => p.id === id)?.name ?? '—'

  // Highlight players scheduled more than once this matchday — usually a mistake to fix.
  const counts = new Map<number, number>()
  for (const g of games) {
    counts.set(g.homePlayerId, (counts.get(g.homePlayerId) ?? 0) + 1)
    counts.set(g.awayPlayerId, (counts.get(g.awayPlayerId) ?? 0) + 1)
  }
  const doubled = roster.filter(p => (counts.get(p.id) ?? 0) > 1)

  async function call(url: string, method: string, body?: object) {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      router.refresh()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
      return false
    } finally {
      setBusy(false)
    }
  }

  function setPlayer(game: GameRow, side: 'home' | 'away', value: string) {
    const next = Number(value)
    const homePlayerId = side === 'home' ? next : game.homePlayerId
    const awayPlayerId = side === 'away' ? next : game.awayPlayerId
    if (homePlayerId === awayPlayerId) { toast.error('A player can’t play themselves'); return }
    call(`/api/games/${game.id}`, 'PATCH', { action: 'edit-players', homePlayerId, awayPlayerId })
  }

  function removeGame(id: number) {
    call(`/api/games/${id}`, 'DELETE')
  }

  function addGame() {
    if (!addHome || !addAway) { toast.error('Pick both players'); return }
    if (addHome === addAway) { toast.error('Pick two different players'); return }
    call(`/api/matchdays/${matchdayId}/games`, 'POST', {
      homePlayerId: Number(addHome),
      awayPlayerId: Number(addAway),
    }).then(ok => { if (ok) { setAddHome(''); setAddAway('') } })
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= games.length) return
    const order = games.map(g => g.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    call(`/api/matchdays/${matchdayId}/reorder`, 'POST', { order })
  }

  function PlayerSelect({ value, onChange }: { value: number; onChange: (v: string) => void }) {
    return (
      <Select value={String(value)} onValueChange={v => v && onChange(v)} disabled={busy}>
        <SelectTrigger className="w-full">
          <SelectValue>{(v: string | null) => (v ? nameOf(Number(v)) : 'Select')}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {roster.map(p => (
            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="space-y-3">
      {doubled.length > 0 && (
        <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
          ⚠️ Playing more than once this matchday: {doubled.map(p => p.name).join(', ')}
        </p>
      )}

      {games.map((game, i) => (
        <div key={game.id} className="flex items-center gap-2">
          <div className="flex flex-col">
            <button type="button" onClick={() => move(i, -1)} disabled={busy || i === 0}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronUp className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={busy || i === games.length - 1}
              className="text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 flex-1">
            <PlayerSelect value={game.homePlayerId} onChange={v => setPlayer(game, 'home', v)} />
            <span className="text-xs text-muted-foreground">vs</span>
            <PlayerSelect value={game.awayPlayerId} onChange={v => setPlayer(game, 'away', v)} />
          </div>
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2"
            onClick={() => removeGame(game.id)} disabled={busy}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1 border-t">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 flex-1">
          <Select value={addHome} onValueChange={v => setAddHome(v ?? '')} disabled={busy}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Home">{(v: string | null) => (v ? nameOf(Number(v)) : 'Home')}</SelectValue></SelectTrigger>
            <SelectContent>{roster.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">vs</span>
          <Select value={addAway} onValueChange={v => setAddAway(v ?? '')} disabled={busy}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Away">{(v: string | null) => (v ? nameOf(Number(v)) : 'Away')}</SelectValue></SelectTrigger>
            <SelectContent>{roster.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={addGame} disabled={busy}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>
    </div>
  )
}
