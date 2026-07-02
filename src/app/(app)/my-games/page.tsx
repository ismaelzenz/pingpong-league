import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { games, users, matchdays } from '@/lib/db/schema'
import { eq, or, and, inArray } from 'drizzle-orm'
import { getDisplayTournament } from '@/lib/tournament'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import GameCard from '@/components/GameCard'

export const dynamic = 'force-dynamic'

const FINISHED = ['confirmed', 'forfeited'] as const

interface EnrichedGame {
  id: number
  status: 'pending' | 'result_entered' | 'confirmed' | 'postponed' | 'forfeited'
  homePlayerId: number
  awayPlayerId: number
  homeSets: number | null
  awaySets: number | null
  submittedBy: number | null
  isCatchUp: boolean
  homePlayer: { id: number; name: string }
  awayPlayer: { id: number; name: string }
  matchday: { number: number } | null
}

function GamesSection({ title, tint, games, currentUserId }: {
  title: string; tint?: string; games: EnrichedGame[]; currentUserId: number
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className={`font-semibold ${tint ?? ''}`}>{title}</h2>
        <Badge variant="outline" className="text-xs">{games.length}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {games.map(game => <GameCard key={game.id} game={game} currentUserId={currentUserId} />)}
      </div>
    </div>
  )
}

export default async function MyGamesPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const tournament = await getDisplayTournament()
  if (!tournament) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <div className="text-5xl">🏓</div>
        <p className="text-muted-foreground">No tournament yet — your games will show up here once one starts.</p>
      </div>
    )
  }

  const rows = await db
    .select({ game: games, mdNumber: matchdays.number })
    .from(games)
    .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
    .where(and(
      eq(games.tournamentId, tournament.id),
      or(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, session.userId)),
    ))

  const playerIds = [...new Set(rows.flatMap(r => [r.game.homePlayerId, r.game.awayPlayerId]))]
  const players = playerIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, playerIds))
    : []
  const nameOf = new Map(players.map(p => [p.id, p.name]))

  const enriched = rows.map(r => ({
    ...r.game,
    homePlayer: { id: r.game.homePlayerId, name: nameOf.get(r.game.homePlayerId) ?? '—' },
    awayPlayer: { id: r.game.awayPlayerId, name: nameOf.get(r.game.awayPlayerId) ?? '—' },
    matchday: r.mdNumber != null ? { number: r.mdNumber } : null,
  }))

  const isFinished = (s: string) => (FINISHED as readonly string[]).includes(s)
  const byMatchday = (a: typeof enriched[number], b: typeof enriched[number]) =>
    (a.matchday?.number ?? 0) - (b.matchday?.number ?? 0)

  const catchUp = enriched.filter(g => g.isCatchUp && !isFinished(g.status)).sort(byMatchday)
  const scheduled = enriched.filter(g => !g.isCatchUp && !isFinished(g.status)).sort(byMatchday)
  const completed = enriched.filter(g => isFinished(g.status)).sort((a, b) => byMatchday(b, a))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My games</h1>
          <p className="text-muted-foreground">{tournament.name} · {enriched.length} game{enriched.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link href="/matchdays" className={buttonVariants({ variant: 'outline', size: 'sm' })}>All matchdays</Link>
      </div>

      {enriched.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground text-sm py-10">
            You don&apos;t have any games in this tournament yet.
          </CardContent>
        </Card>
      ) : (
        <>
          {catchUp.length > 0 && (
            <GamesSection title="⏳ Catch-up games" tint="text-yellow-700 dark:text-yellow-400" games={catchUp} currentUserId={session.userId} />
          )}
          {scheduled.length > 0 && <GamesSection title="Scheduled" games={scheduled} currentUserId={session.userId} />}
          {completed.length > 0 && <GamesSection title="Completed" games={completed} currentUserId={session.userId} />}
        </>
      )}
    </div>
  )
}
