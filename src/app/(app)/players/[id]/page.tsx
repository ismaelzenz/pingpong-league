import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { requireSession } from '@/lib/session'
import { db } from '@/lib/db'
import { games, users, matchdays } from '@/lib/db/schema'
import { eq, inArray, or, and, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { computeScoreboard } from '@/lib/scoreboard'
import { getDisplayTournament } from '@/lib/tournament'
import { computePlayerForm } from '@/lib/playerStats'
import { perspective } from '@/lib/gameResult'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import GameCard from '@/components/game/GameCard'
import EloSummary, { loadEloSummary } from '@/components/elo/EloSummary'
import { FINISHED_STATUSES, UNPLAYED_STATUSES } from '@/lib/gameStatus'
import BackLink from '@/components/common/BackLink'
import { medal } from '@/lib/utils'
import ResultChip from '@/components/common/ResultChip'
import PlayerStatsCard from '@/components/player/PlayerStatsCard'

export const dynamic = 'force-dynamic'

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()

  const playerId = parseInt(id)
  if (Number.isNaN(playerId)) notFound()
  // Your own avatar links to your editable profile instead.
  if (playerId === session.userId) redirect('/profile')

  // One parallel batch: the player, everything about the season on show (which waits only on
  // picking the tournament), and their ELO card.
  const opponent = alias(users, 'opponent')
  const mine = or(eq(games.homePlayerId, playerId), eq(games.awayPlayerId, playerId))
  const opponentOn = sql`${opponent.id} = CASE WHEN ${games.homePlayerId} = ${playerId} THEN ${games.awayPlayerId} ELSE ${games.homePlayerId} END`
  const [player, season, eloData] = await Promise.all([
    db.select({ id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor })
      .from(users).where(eq(users.id, playerId)).then(r => r[0] ?? null),
    getDisplayTournament().then(async tournament => {
      if (!tournament) return null
      return Promise.all([
        computeScoreboard(tournament.id),
        // All of this player's finished games, with the opponent's name and matchday number.
        db.select({ game: games, opponentName: opponent.name, matchdayNumber: matchdays.number })
          .from(games)
          .leftJoin(opponent, opponentOn)
          .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
          .where(and(eq(games.tournamentId, tournament.id), mine, inArray(games.status, [...FINISHED_STATUSES])))
          .orderBy(games.confirmedAt),
        // Scheduled games between the two of you that haven't been played yet.
        db.select({ id: games.id, status: games.status, matchdayNumber: matchdays.number })
          .from(games)
          .leftJoin(matchdays, eq(matchdays.id, games.matchdayId))
          .where(and(
            eq(games.tournamentId, tournament.id),
            inArray(games.status, [...UNPLAYED_STATUSES]),
            or(
              and(eq(games.homePlayerId, playerId), eq(games.awayPlayerId, session.userId)),
              and(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, playerId)),
            ),
          ))
          .orderBy(games.matchdayId),
        // This player's catch-up games (owed games that live outside the regular matchday grid,
        // so they never appear in any matchday). Surfacing them here lets an admin open one and
        // forfeit/postpone it — otherwise there's no way to reach a catch-up game.
        db.select({ game: games, opponentName: opponent.name })
          .from(games)
          .leftJoin(opponent, opponentOn)
          .where(and(eq(games.tournamentId, tournament.id), eq(games.isCatchUp, true), mine))
          .orderBy(games.id),
      ])
    }),
    loadEloSummary(playerId),
  ])
  if (!player) notFound()

  const tournament = await getDisplayTournament() // request-cached: already resolved above
  const [scores, playerRows, upcomingH2H, catchUpRows] = season ?? [[], [], [], []]
  const stats = scores.find(s => s.userId === playerId)
  const rank = scores.findIndex(s => s.userId === playerId)
  const playerGames = playerRows.map(r => r.game)

  // Build a per-game view from this player's perspective.
  const results = playerRows.map(({ game: g, opponentName, matchdayNumber }) => {
    const { isHome, mySets, oppSets, won, forfeited } = perspective(g, playerId)
    const opponentId = isHome ? g.awayPlayerId : g.homePlayerId
    return {
      gameId: g.id,
      opponentId,
      opponentName: opponentName ?? '—',
      matchdayNumber: matchdayNumber ?? '?',
      theirSets: mySets,
      oppSets,
      won,
      forfeited,
    }
  }).reverse() // most recent first (confirmedAt asc → reverse)

  // Head-to-head = the subset of finished games against the current user.
  const h2h = results.filter(r => r.opponentId === session.userId)
  const playerWins = h2h.filter(r => r.won).length
  const myWins = h2h.length - playerWins

  const catchUpGames = catchUpRows.map(({ game: g, opponentName }) => ({
    ...g,
    homePlayer: { id: g.homePlayerId, name: g.homePlayerId === playerId ? player.name : (opponentName ?? '—') },
    awayPlayer: { id: g.awayPlayerId, name: g.awayPlayerId === playerId ? player.name : (opponentName ?? '—') },
  }))

  const playerForm = computePlayerForm(playerGames, playerId)

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <BackLink href="/scoreboard">Scoreboard</BackLink>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <PlayerAvatar name={player.name} avatarColor={player.avatarColor} className="h-16 w-16" fallbackClassName="text-xl" />
            <div>
              <p className="text-xl font-bold">{player.name}</p>
              <p className="text-muted-foreground text-sm">{player.email}</p>
              {rank >= 0 && (
                <p className="text-sm mt-1">
                  <span className="text-muted-foreground">Rank </span>
                  <span className="font-semibold">{medal(rank + 1) ?? `#${rank + 1}`}</span>
                  {tournament && <span className="text-muted-foreground"> · {tournament.name}</span>}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {stats ? (
        <PlayerStatsCard stats={stats} form={playerForm} showGamesPlayed />
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground py-6">
            No stats yet — this player isn&apos;t in the current tournament.
          </CardContent>
        </Card>
      )}

      <EloSummary userId={playerId} possessive="their" data={eloData} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Head-to-head vs you</CardTitle>
        </CardHeader>
        <CardContent>
          {h2h.length === 0 && upcomingH2H.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              You haven&apos;t played each other yet, and no games are scheduled.
            </p>
          ) : (
            <>
              {h2h.length > 0 && (
                <>
                  <div className="flex items-center justify-center gap-6 mb-4">
                    <div className="text-center">
                      <p className="text-3xl font-black text-green-600">{myWins}</p>
                      <p className="text-xs text-muted-foreground">You</p>
                    </div>
                    <span className="text-muted-foreground text-lg">–</span>
                    <div className="text-center">
                      <p className="text-3xl font-black text-red-500">{playerWins}</p>
                      <p className="text-xs text-muted-foreground">{player.name.split(' ')[0]}</p>
                    </div>
                  </div>
                  {h2h.length > 1 && (
                    <div className="flex items-center justify-center gap-1 mb-4" title="Your results in this rivalry, oldest to newest">
                      {[...h2h].reverse().map(r => {
                        const youWon = !r.forfeited && r.oppSets > r.theirSets
                        return <span key={r.gameId} className={`w-4 h-4 rounded-full ${youWon ? 'bg-green-500' : 'bg-red-500'}`} title={`${r.oppSets}–${r.theirSets}`} />
                      })}
                    </div>
                  )}
                  <Separator className="mb-3" />
                  <div className="space-y-2">
                    {h2h.map(r => {
                      // `won` is from the viewed player's perspective; flip it for you.
                      const youWon = !r.forfeited && r.oppSets > r.theirSets
                      return (
                        <Link key={r.gameId} href={`/games/${r.gameId}`} className="flex items-center justify-between text-sm hover:bg-muted/40 -mx-2 px-2 py-1 rounded-md transition-colors">
                          <div className="flex items-center gap-2">
                            <ResultChip won={youWon} className="text-xs" />
                            <span className="text-muted-foreground">{r.forfeited ? 'Forfeit' : 'Result'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="font-mono font-bold text-foreground">{r.oppSets} – {r.theirSets}</span>
                            <span className="text-xs w-12 text-right shrink-0">MD {r.matchdayNumber}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </>
              )}

              {upcomingH2H.length > 0 && (
                <>
                  {h2h.length > 0 && <Separator className="my-3" />}
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {upcomingH2H.map(g => (
                      <Link key={g.id} href={`/games/${g.id}`} className="flex items-center justify-between text-sm hover:bg-muted/40 -mx-2 px-2 py-1 rounded-md transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-muted text-muted-foreground">📅</span>
                          <span className="text-muted-foreground">
                            {g.status === 'postponed' ? 'Postponed' : 'Scheduled'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">MD {g.matchdayNumber ?? '?'}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {catchUpGames.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Catch-up games</CardTitle>
            <p className="text-sm text-muted-foreground">
              Owed games outside the regular matchdays. Open one to see or change its result.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {catchUpGames.map(g => (
              <GameCard key={g.id} game={g} currentUserId={session.userId} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Past results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">No games played yet.</p>
          ) : (
            results.map(r => (
              <Link key={r.gameId} href={`/games/${r.gameId}`} className="flex items-center justify-between text-sm hover:bg-muted/40 -mx-2 px-2 py-1 rounded-md transition-colors">
                <div className="flex items-center gap-2">
                  <ResultChip won={r.won} className="text-xs" />
                  <span>
                    vs {r.opponentName}
                    {r.opponentId === session.userId && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="font-mono font-bold text-foreground">{r.theirSets} – {r.oppSets}</span>
                  <span className="text-xs w-12 text-right shrink-0">MD {r.matchdayNumber}</span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
