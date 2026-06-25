import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, games, users, matchdays } from '@/lib/db/schema'
import { eq, inArray, or, and } from 'drizzle-orm'
import { computeScoreboard } from '@/lib/scoreboard'
import { computePlayerForm } from '@/lib/playerStats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlayerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const playerId = parseInt(id)
  if (Number.isNaN(playerId)) notFound()
  // Your own avatar links to your editable profile instead.
  if (playerId === session.userId) redirect('/profile')

  const player = await db.select({ id: users.id, name: users.name, email: users.email, avatarColor: users.avatarColor })
    .from(users).where(eq(users.id, playerId)).then(r => r[0] ?? null)
  if (!player) notFound()

  const tournament = await db.select().from(tournaments)
    .where(inArray(tournaments.status, ['active', 'finished']))
    .orderBy(tournaments.createdAt)
    .limit(1)
    .then(r => r[0] ?? null)

  const scores = tournament ? await computeScoreboard(tournament.id) : []
  const stats = scores.find(s => s.userId === playerId)
  const rank = scores.findIndex(s => s.userId === playerId)

  // All of this player's finished games in the current tournament.
  const playerGames = tournament
    ? await db.select().from(games)
        .where(and(
          eq(games.tournamentId, tournament.id),
          or(eq(games.homePlayerId, playerId), eq(games.awayPlayerId, playerId)),
          inArray(games.status, ['confirmed', 'forfeited'])
        ))
        .orderBy(games.confirmedAt)
    : []

  // Resolve opponent names + matchday numbers in one pass.
  const opponentIds = [...new Set(playerGames.map(g =>
    g.homePlayerId === playerId ? g.awayPlayerId : g.homePlayerId
  ))]
  const opponents = opponentIds.length
    ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, opponentIds))
    : []
  const opponentMap = Object.fromEntries(opponents.map(o => [o.id, o.name]))

  const matchdayIds = [...new Set(playerGames.map(g => g.matchdayId))]
  const mds = matchdayIds.length
    ? await db.select({ id: matchdays.id, number: matchdays.number }).from(matchdays).where(inArray(matchdays.id, matchdayIds))
    : []
  const matchdayMap = Object.fromEntries(mds.map(m => [m.id, m.number]))

  // Build a per-game view from this player's perspective.
  const results = playerGames.map(g => {
    const isHome = g.homePlayerId === playerId
    const opponentId = isHome ? g.awayPlayerId : g.homePlayerId
    const theirSets = isHome ? (g.homeSets ?? 0) : (g.awaySets ?? 0)
    const oppSets = isHome ? (g.awaySets ?? 0) : (g.homeSets ?? 0)
    return {
      gameId: g.id,
      opponentId,
      opponentName: opponentMap[opponentId] ?? '—',
      matchdayNumber: matchdayMap[g.matchdayId] ?? '?',
      theirSets,
      oppSets,
      won: g.status === 'forfeited' ? false : theirSets > oppSets,
      forfeited: g.status === 'forfeited',
    }
  }).reverse() // most recent first (confirmedAt asc → reverse)

  // Head-to-head = the subset of finished games against the current user.
  const h2h = results.filter(r => r.opponentId === session.userId)
  const playerWins = h2h.filter(r => r.won).length
  const myWins = h2h.length - playerWins

  // Scheduled games between the two of you that haven't been played yet.
  const upcomingH2H = tournament
    ? await db.select({ id: games.id, matchdayId: games.matchdayId, status: games.status })
        .from(games)
        .where(and(
          eq(games.tournamentId, tournament.id),
          inArray(games.status, ['pending', 'result_entered', 'postponed']),
          or(
            and(eq(games.homePlayerId, playerId), eq(games.awayPlayerId, session.userId)),
            and(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, playerId)),
          ),
        ))
        .orderBy(games.matchdayId)
    : []

  // Resolve matchday numbers for any upcoming games not already in the map.
  const missingMdIds = [...new Set(upcomingH2H.map(g => g.matchdayId))].filter(mid => !(mid in matchdayMap))
  if (missingMdIds.length) {
    const extra = await db.select({ id: matchdays.id, number: matchdays.number }).from(matchdays).where(inArray(matchdays.id, missingMdIds))
    for (const m of extra) matchdayMap[m.id] = m.number
  }

  const playerForm = computePlayerForm(playerGames, playerId)
  const initials = player.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <Link
        href="/scoreboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground -ml-2 px-2 py-1 rounded-md hover:bg-accent transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Scoreboard
      </Link>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-xl text-white" style={{ backgroundColor: player.avatarColor ?? undefined }}>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xl font-bold">{player.name}</p>
              <p className="text-muted-foreground text-sm">{player.email}</p>
              {rank >= 0 && (
                <p className="text-sm mt-1">
                  <span className="text-muted-foreground">Rank </span>
                  <span className="font-semibold">{rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `#${rank + 1}`}</span>
                  {tournament && <span className="text-muted-foreground"> · {tournament.name}</span>}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {stats ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tournament stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-black text-primary">{stats.points}</p>
                <p className="text-xs text-muted-foreground">Points</p>
              </div>
              <div>
                <p className="text-3xl font-black text-green-600">{stats.victories}</p>
                <p className="text-xs text-muted-foreground">Victories</p>
              </div>
              <div>
                <p className="text-3xl font-black text-red-500">{stats.losses}</p>
                <p className="text-xs text-muted-foreground">Losses</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{stats.gamesPlayed}</p>
                <p className="text-xs text-muted-foreground">Games</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.setsWon}</p>
                <p className="text-xs text-muted-foreground">Sets Won</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.setsLost}</p>
                <p className="text-xs text-muted-foreground">Sets Lost</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <p className="text-xl font-bold">{Math.round(playerForm.winPct * 100)}%</p>
                <p className="text-xs text-muted-foreground">Win rate</p>
              </div>
              <div>
                <p className="text-xl font-bold">{Math.round(playerForm.setWinPct * 100)}%</p>
                <p className="text-xs text-muted-foreground">Set rate</p>
              </div>
              <div>
                <p className="text-xl font-bold">{stats.gamesPlayed ? (stats.points / stats.gamesPlayed).toFixed(1) : '0'}</p>
                <p className="text-xs text-muted-foreground">Pts/game</p>
              </div>
              <div>
                <p className="text-xl font-bold">{playerForm.longestWinStreak}</p>
                <p className="text-xs text-muted-foreground">Best streak</p>
              </div>
            </div>
            {playerForm.form.length > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">Recent form</span>
                <div className="flex gap-1">
                  {playerForm.form.map((r, i) => (
                    <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${r === 'W' ? 'bg-green-500' : 'bg-red-500'}`}>{r}</span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground py-6">
            No stats yet — this player isn&apos;t in the current tournament.
          </CardContent>
        </Card>
      )}

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
                  <Separator className="mb-3" />
                  <div className="space-y-2">
                    {h2h.map(r => {
                      // `won` is from the viewed player's perspective; flip it for you.
                      const youWon = !r.forfeited && r.oppSets > r.theirSets
                      return (
                        <Link key={r.gameId} href={`/games/${r.gameId}`} className="flex items-center justify-between text-sm hover:bg-muted/40 -mx-2 px-2 py-1 rounded-md transition-colors">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${youWon ? 'bg-green-500' : 'bg-red-500'}`}>
                              {youWon ? 'W' : 'L'}
                            </span>
                            <span className="text-muted-foreground">{r.forfeited ? 'Forfeit' : 'Result'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground">
                            <span className="font-mono font-bold text-foreground">{r.oppSets} – {r.theirSets}</span>
                            <span className="text-xs">MD {r.matchdayNumber}</span>
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
                            {g.status === 'result_entered' ? 'Awaiting confirmation' : g.status === 'postponed' ? 'Postponed' : 'Scheduled'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">MD {matchdayMap[g.matchdayId] ?? '?'}</span>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${r.won ? 'bg-green-500' : 'bg-red-500'}`}>
                    {r.won ? 'W' : 'L'}
                  </span>
                  <span>
                    vs {r.opponentName}
                    {r.opponentId === session.userId && <span className="text-muted-foreground"> (you)</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span className="font-mono font-bold text-foreground">{r.theirSets} – {r.oppSets}</span>
                  <span className="text-xs">MD {r.matchdayNumber}</span>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
