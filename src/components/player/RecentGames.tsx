import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import ResultChip from '@/components/common/ResultChip'
import DeltaText from '@/components/common/DeltaText'
import SectionCard from '@/components/common/SectionCard'
import type { EloGameRow } from '@/lib/data/elo'
import { PLAYER_RECENT_GAMES } from '@/lib/data/elo'
import { shortDate } from '@/lib/dates'
import { cn, joinNames } from '@/lib/utils'

/** A season game of this player's, as the profile pages load it. */
interface LeagueRow {
  game: { id: number; status: string; submittedAt: string | null; updatedAt: string }
  matchdayNumber: number | null
  opponentName: string | null
}

interface RecentGame {
  key: string
  /** League games open their game page; casual ELO games have none. */
  href: string | null
  won: boolean
  forfeit: boolean
  opponents: string
  mySets: number
  oppSets: number
  /** Rating change; null for a forfeit (unrated). */
  delta: number | null
  matchdayNumber: number | null
  casual: boolean
  at: string
}

// Timestamps come as "2026-10-29 14:02:11" or ISO; make them sort together.
const iso = (ts: string) => ts.includes('T') ? ts : ts.replace(' ', 'T')

/**
 * Merge a player's latest games into one list: every rated game (league and casual) with what it did
 * to their rating, plus league forfeits, which ELO skips. One row per game — the profile used to list
 * the same games twice, once as results and once as rating swings.
 */
function buildRecent(playerId: number, viewerId: number, elo: EloGameRow[], league: LeagueRow[]): RecentGame[] {
  const mdByGame = new Map(league.map(r => [r.game.id, r.matchdayNumber]))
  const named = (p: { userId: number; name: string }) => p.userId === viewerId && viewerId !== playerId ? `${p.name} (you)` : p.name

  const rated: RecentGame[] = elo.map(g => {
    const won = g.winners.some(p => p.userId === playerId)
    const me = (won ? g.winners : g.losers).find(p => p.userId === playerId)
    const league = g.source === 'league'
    return {
      key: g.key,
      href: league ? `/games/${g.refId}` : null,
      won,
      forfeit: false,
      opponents: joinNames((won ? g.losers : g.winners).map(named)),
      mySets: won ? g.winnerSets : g.loserSets,
      oppSets: won ? g.loserSets : g.winnerSets,
      delta: me?.delta ?? null,
      matchdayNumber: league ? (mdByGame.get(g.refId) ?? null) : null,
      casual: !league,
      at: iso(g.playedAt),
    }
  })

  const forfeits: RecentGame[] = league.filter(r => r.game.status === 'forfeited').map(r => ({
    key: `forfeit-${r.game.id}`,
    href: `/games/${r.game.id}`,
    won: false,
    forfeit: true,
    opponents: r.opponentName ?? '—',
    mySets: 0,
    oppSets: 2,
    delta: null,
    matchdayNumber: r.matchdayNumber,
    casual: false,
    at: iso(r.game.submittedAt ?? r.game.updatedAt),
  }))

  return [...rated, ...forfeits].sort((a, b) => b.at.localeCompare(a.at)).slice(0, PLAYER_RECENT_GAMES)
}

export default function RecentGames({ playerId, viewerId, elo, league }: {
  playerId: number
  viewerId: number
  elo: EloGameRow[]
  league: LeagueRow[]
}) {
  const games = buildRecent(playerId, viewerId, elo, league)

  return (
    <SectionCard title="Recent games" compact contentClassName="px-0">
      {games.length === 0 ? (
        <p className="px-4 py-2 text-center text-sm text-muted-foreground">No games played yet.</p>
      ) : (
        <div className="divide-y">
          {games.map(g => {
            const row = (
              <>
                <ResultChip won={g.won} className="shrink-0 text-[10px]" />
                <span className="min-w-0 flex-1 truncate">
                  vs {g.opponents}
                  {g.casual && <span className="text-xs text-muted-foreground"> · ELO game</span>}
                  {g.forfeit && <span className="text-xs text-muted-foreground"> · forfeit</span>}
                </span>
                <span className="shrink-0 font-mono font-semibold tabular-nums">{g.mySets}–{g.oppSets}</span>
                <span className="w-9 shrink-0 text-right text-xs">
                  {g.delta != null ? <DeltaText value={g.delta} /> : <span className="text-muted-foreground">—</span>}
                </span>
                <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
                  {g.matchdayNumber != null ? `MD ${g.matchdayNumber}` : shortDate(g.at)}
                </span>
                <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground', !g.href && 'invisible')} />
              </>
            )
            const cls = 'flex items-center gap-2.5 px-4 py-2 text-sm'
            return g.href
              ? <Link key={g.key} href={g.href} className={cn(cls, 'transition-colors hover:bg-muted/40')}>{row}</Link>
              : <div key={g.key} className={cls}>{row}</div>
          })}
        </div>
      )}
    </SectionCard>
  )
}
