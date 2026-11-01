import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { eloGames, users } from '@/lib/db/schema'
import { asc, desc } from 'drizzle-orm'
import { computeEloStandings, computeEloTimelines, listEloGames, loadSides } from '@/lib/data/elo'
import { START_ELO } from '@/lib/domain/elo'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import EmptyState from '@/components/common/EmptyState'
import { joinNames, showElo } from '@/lib/utils'
import EloTimeline from '@/components/elo/EloTimeline'
import RecordEloGameForm from '@/components/elo/RecordEloGameForm'
import EloGameActions from '@/components/elo/EloGameActions'
import EloLedgerTable from '@/components/elo/EloLedgerTable'
import EloStandingsTable from '@/components/elo/EloStandingsTable'
import { TrendingUp } from 'lucide-react'
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
            <Card className="me-card">
              <CardContent className="py-4 flex items-center gap-4">
                <PlayerAvatar name={me.name} avatarColor={me.avatarColor} className="h-12 w-12" fallbackClassName="text-sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide me-text">Your rating</p>
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

          {/* overflow-visible: a clipping card would stop the table's heading from sticking. */}
          <SectionCard title="ELO scoreboard" compact className="overflow-visible" contentClassName="p-0">
            <EloStandingsTable standings={standings} currentUserId={session.userId} />
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
