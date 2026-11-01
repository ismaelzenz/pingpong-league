'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn, showElo } from '@/lib/utils'
import type { EloGameRow, EloGameSidePlayer } from '@/lib/data/elo'
import DeltaText from '@/components/common/DeltaText'
import { shortDate } from '@/lib/dates'

interface Props {
  games: EloGameRow[]
  currentUserId: number
  /** True when the server trimmed the list — worth saying so rather than implying it's everything. */
  truncated: boolean
}

type TypeFilter = 'all' | 'league' | 'elo'

/** A player and what the game did to them: "Bruno +12". */
function PlayerDelta({ p, currentUserId }: { p: EloGameSidePlayer; currentUserId: number }) {
  const me = p.userId === currentUserId
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
      <span className={cn('text-sm', me && 'font-semibold text-primary')}>{p.name}</span>
      <DeltaText value={p.delta} className="text-xs" title={`Rating after: ${showElo(p.ratingAfter)}`} />
    </span>
  )
}

/**
 * Every rated game and what it cost or earned each player.
 *
 * One row per **game**, not per player: the ledger is stored per player (that's what a rating chain
 * is), but rendering it that way showed each match twice — the same event from both sides — which
 * is pure noise. Grouping also makes a team game representable at all, since "the opponent" can be
 * three people.
 *
 * It's also the one table here with no natural ceiling: a season adds hundreds of rows. So it gets
 * its own scroll area with a sticky header, and filters — by player and by type — to cut the list
 * down rather than making the page endless.
 */
export default function EloLedgerTable({ games, currentUserId, truncated }: Props) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [mineOnly, setMineOnly] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return games.filter(g => {
      if (type !== 'all' && g.source !== type) return false
      const everyone = [...g.winners, ...g.losers]
      if (mineOnly && !everyone.some(p => p.userId === currentUserId)) return false
      if (q && !everyone.some(p => p.name.toLowerCase().includes(q))) return false
      return true
    })
  }, [games, query, type, mineOnly, currentUserId])

  const TYPES: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'league', label: 'League' },
    { key: 'elo', label: 'ELO games' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by player…"
          className="h-8 w-full sm:w-56"
        />
        <div className="flex gap-1">
          {TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              aria-pressed={type === t.key}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                type === t.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMineOnly(v => !v)}
          aria-pressed={mineOnly}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
            mineOnly
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          Only my games
        </button>
        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
          {filtered.length} game{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Its own scroll box: this is the one table with no natural ceiling, so it stays a fixed
          height instead of running the page on forever. Horizontal scroll too — a 4v4 row is wide. */}
      <div className="max-h-[26rem] overflow-y-auto overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Won</th>
              <th className="text-center px-2 py-2 font-medium text-muted-foreground">Score</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Lost</th>
              <th className="text-center px-2 py-2 font-medium text-muted-foreground">Type</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  No games match those filters.
                </td>
              </tr>
            ) : filtered.map(g => {
              const mine = [...g.winners, ...g.losers].some(p => p.userId === currentUserId)
              return (
                <tr key={g.key} className={cn('border-b last:border-0', mine && 'bg-primary/5')}>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {g.winners.map(p => <PlayerDelta key={p.userId} p={p} currentUserId={currentUserId} />)}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center font-mono font-semibold whitespace-nowrap">
                    {g.winnerSets}–{g.loserSets}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {g.losers.map(p => <PlayerDelta key={p.userId} p={p} currentUserId={currentUserId} />)}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Badge variant="outline" className="text-xs font-normal whitespace-nowrap">
                      {g.source === 'elo' ? 'ELO game' : 'League'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                    {shortDate(g.playedAt)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Each name shows what the game did to that player&apos;s rating; hover a number for their rating
        afterwards.{truncated && ' Showing the most recent games only.'}
      </p>
    </div>
  )
}
