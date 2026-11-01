import { requireSession } from '@/lib/session'
import { db } from '@/lib/db'
import { eloGames, users } from '@/lib/db/schema'
import { asc, desc } from 'drizzle-orm'
import { computeEloStandings, computeEloTimelines, listEloGames, loadSides } from '@/lib/eloLedger'
import { START_ELO } from '@/lib/elo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PlayerLink from '@/components/player/PlayerLink'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import EmptyState from '@/components/common/EmptyState'
import { joinNames, showElo } from '@/lib/utils'
import EloTimeline from '@/components/elo/EloTimeline'
import RecordEloGameForm from '@/components/elo/RecordEloGameForm'
import EloGameActions from '@/components/elo/EloGameActions'
import EloLedgerTable from '@/components/elo/EloLedgerTable'
import { TrendingUp } from 'lucide-react'
import { medal } from '@/lib/utils'
import DeltaText from '@/components/common/DeltaText'
import { shortDate } from '@/lib/dates'
import SectionCard from '@/components/common/SectionCard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'ELO ratings' }

/** "3 Jun" for this year, "3 Jun 2024" for anything older. */
export default async function EloPage() {
  const session = await requireSession()

  const LEDGER_LIMIT = 400
  const [standings, timelines, ledgerGames, everyone, casual, sides] = await Promise.all([
    computeEloStandings(),
    computeEloTimelines(),
    listEloGames({ limit: LEDGER_LIMIT }),
    // Every member, archived included: the active ones feed the player picker, and all of them
    // name the casual games below (an archived player can still appear in an old game).
    db.select({ id: users.id, name: users.name, email: users.email, archivedAt: users.archivedAt })
      .from(users).orderBy(asc(users.name)),
    db.select().from(eloGames).orderBy(desc(eloGames.playedAt)).limit(15),
    loadSides(),
  ])
  const roster = everyone.filter(u => !u.archivedAt).map(({ id, name, email }) => ({ id, name, email }))
  const nameOf = new Map(everyone.map(p => [p.id, p.name]))
  const namesFor = (ids: number[] | undefined) => joinNames((ids ?? []).map(id => nameOf.get(id) ?? '—'))
  const myRank = standings.findIndex(s => s.userId === session.userId)
  const me = myRank >= 0 ? standings[myRank] : null

  // Open the chart on the reader plus the top of the table — a comparison that's worth
  // something before they've touched anything.
  const initialSelection = [
    ...(me ? [me.userId] : []),
    ...standings.filter(s => s.userId !== session.userId).slice(0, 3).map(s => s.userId),
  ]

  const chartSeries = timelines.map(t => ({ userId: t.userId, name: t.name, points: t.points }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6" /> ELO ratings
        </h1>
        <p className="text-muted-foreground">
          One lifetime rating per player, across every season and every casual game. Everyone starts at {START_ELO}.
        </p>
      </div>

      {standings.length === 0 ? (
        <EmptyState
          emoji="📈"
          title="No rated games yet"
          hint={`Ratings appear as soon as the first result is in. Everyone starts at ${START_ELO}.`}
        />
      ) : (
        <>
          {me && (
            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="py-4 flex items-center gap-4">
                <PlayerAvatar name={me.name} avatarColor={me.avatarColor} className="h-12 w-12" fallbackClassName="text-sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Your rating</p>
                  <p className="text-3xl font-black leading-tight tabular-nums">{showElo(me.rating)}</p>
                </div>
                <div className="text-right text-sm space-y-0.5 shrink-0">
                  <p className="text-muted-foreground">Rank <span className="font-semibold text-foreground">#{myRank + 1}</span> of {standings.length}</p>
                  <p className="text-muted-foreground">{me.wins}W – {me.losses}L</p>
                  {me.lastDelta != null && <p className="text-muted-foreground">Last game <DeltaText value={me.lastDelta} /></p>}
                </div>
              </CardContent>
            </Card>
          )}

          <EloTimeline series={chartSeries} initial={initialSelection} />

          <SectionCard title="ELO scoreboard" compact contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left pl-4 pr-2 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-left px-2 py-3 font-medium text-muted-foreground w-full">Player</th>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">GP</th>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">W</th>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">L</th>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">Peak</th>
                    <th className="text-right px-3 py-3 font-medium text-muted-foreground">Last</th>
                    <th className="text-right px-4 py-3 font-bold text-muted-foreground">ELO</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((e, i) => {
                    const isMe = e.userId === session.userId
                    return (
                      <tr key={e.userId} className={`border-b last:border-0 ${isMe ? 'bg-primary/5' : ''}`}>
                        <td className="pl-4 pr-2 py-3 text-muted-foreground">{medal(i + 1) ?? i + 1}</td>
                        <td className="px-2 py-3">
                          <PlayerLink userId={e.userId} currentUserId={session.userId} className="flex items-center gap-2 w-fit">
                            <PlayerAvatar name={e.name} avatarColor={e.avatarColor} className="h-7 w-7" fallbackClassName="text-xs" />
                            <span className={`font-medium ${isMe ? 'text-primary' : 'hover:underline'}`}>
                              {e.name}{isMe && ' (you)'}
                            </span>
                          </PlayerLink>
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{e.gamesPlayed}</td>
                        <td className="px-3 py-3 text-right text-green-600 tabular-nums">{e.wins}</td>
                        <td className="px-3 py-3 text-right text-red-500 tabular-nums">{e.losses}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">{showElo(e.peak)}</td>
                        <td className="px-3 py-3 text-right">{e.lastDelta != null ? <DeltaText value={e.lastDelta} /> : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-lg tabular-nums">{showElo(e.rating)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Record an ELO game</CardTitle>
            <p className="text-sm text-muted-foreground">
              Played someone outside the league? Log it here and it counts toward both your ratings.
            </p>
          </CardHeader>
          <CardContent>
            <RecordEloGameForm members={roster} me={{ id: session.userId, name: session.name }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent ELO games</CardTitle>
            <p className="text-sm text-muted-foreground">Casual games only — league fixtures live on their own pages.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {casual.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">None logged yet.</p>
            ) : casual.map(g => {
              const side = sides.get(g.id)
              const everyone = [...(side?.home ?? []), ...(side?.away ?? [])]
              const mine = everyone.includes(session.userId)
              const homeWon = g.homeSets > g.awaySets
              return (
                <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm border-b last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate">
                      <span className={homeWon ? 'font-semibold' : ''}>{namesFor(side?.home)}</span>
                      <span className="text-muted-foreground font-mono"> {g.homeSets}–{g.awaySets} </span>
                      <span className={!homeWon ? 'font-semibold' : ''}>{namesFor(side?.away)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {shortDate(g.playedAt)}{g.correctedAt ? ' · corrected' : ''}
                    </p>
                  </div>
                  {(mine || session.isAdmin) && (
                    <EloGameActions
                      gameId={g.id}
                      homeName={namesFor(side?.home)}
                      awayName={namesFor(side?.away)}
                      homeSets={g.homeSets}
                      awaySets={g.awaySets}
                    />
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {ledgerGames.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Points won &amp; lost</CardTitle>
            <p className="text-sm text-muted-foreground">
              Every rated game and what it did to each player&apos;s rating. Newest first.
            </p>
          </CardHeader>
          <CardContent>
            <EloLedgerTable
              games={ledgerGames}
              currentUserId={session.userId}
              truncated={ledgerGames.length >= LEDGER_LIMIT}
            />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground text-center">
        GP = rated games · Peak = highest rating reached · Last = points from the most recent game
        <br />
        Only who won moves a rating — 2–0 and 2–1 are worth the same. Forfeits aren&apos;t rated.
      </p>
    </div>
  )
}
