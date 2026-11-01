import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, matchdays, participants, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getLiveTournament } from '@/lib/data/tournaments'
import { todayISO } from '@/lib/dates'
import { isCatchUpBacklog } from '@/lib/domain/backlog'
import GameCard from '@/components/game/GameCard'
import EmptyState from '@/components/common/EmptyState'
import BackLink from '@/components/common/BackLink'

export const dynamic = 'force-dynamic'

// Unplayed games that aren't part of this week's fixtures: games left unplayed/postponed in earlier
// matchdays, plus any newcomer's catch-up games. Admins see the whole league's backlog; everyone
// else sees only their own. Shares its "what counts as backlog" rule with the office display
// (isCatchUpBacklog), so the two never drift.
export default async function CatchUpPage() {
  const session = await requireSession()

  const live = await getLiveTournament()
  const tournament = live?.status === 'active' ? live : null
  if (!tournament) {
    return <EmptyState emoji="⏳" title="No active tournament" hint="Once a season starts, any games to catch up on will appear here." />
  }

  const [allGames, mds, rosterRaw] = await Promise.all([
    db.select().from(games).where(eq(games.tournamentId, tournament.id)).orderBy(games.id),
    db.select().from(matchdays).where(eq(matchdays.tournamentId, tournament.id)),
    db.select({ id: users.id, name: users.name })
      .from(participants)
      .leftJoin(users, eq(users.id, participants.userId))
      .where(eq(participants.tournamentId, tournament.id)),
  ])

  const today = todayISO()
  const weekStartByMd = new Map(mds.map(m => [m.id, m.weekStart]))
  const mdById = new Map(mds.map(m => [m.id, m]))
  const currentMd = mds.find(m => m.weekStart && m.weekEnd && m.weekStart <= today && today <= m.weekEnd)
    ?? [...mds].reverse().find(m => m.weekStart != null && m.weekStart <= today)
    ?? null
  const nameById = new Map(rosterRaw.filter(p => p.id != null).map(p => [p.id!, p.name ?? '—']))

  const backlog = allGames
    .filter(g => isCatchUpBacklog(g, weekStartByMd, currentMd?.id ?? null, today))
    // Non-admins only ever see games they're in.
    .filter(g => session.isAdmin || g.homePlayerId === session.userId || g.awayPlayerId === session.userId)
    .map(g => {
      const md = mdById.get(g.matchdayId)
      return {
        ...g,
        homePlayer: { id: g.homePlayerId, name: nameById.get(g.homePlayerId) ?? '—' },
        awayPlayer: { id: g.awayPlayerId, name: nameById.get(g.awayPlayerId) ?? '—' },
        matchday: md ? { number: md.number } : null,
        weekStart: md?.weekStart ?? null,
        weekEnd: md?.weekEnd ?? null,
      }
    })

  // Split into newcomer catch-up games and overdue matchday games (grouped by matchday). Each game
  // lands in exactly one group, so nothing is shown twice.
  const noMatchdayGames = backlog.filter(g => g.isCatchUp)
  const overdueByMatchday = new Map<number, typeof backlog>()
  for (const g of backlog) {
    if (g.isCatchUp) continue
    const n = g.matchday?.number ?? 0
    if (!overdueByMatchday.has(n)) overdueByMatchday.set(n, [])
    overdueByMatchday.get(n)!.push(g)
  }
  const matchdayGroups = [...overdueByMatchday.entries()].sort((a, b) => a[0] - b[0])

  const enterHint = session.isAdmin ? ' — open one to enter a result, postpone, or forfeit it' : ''

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/matchdays" className="mb-2">All matchdays</BackLink>
        <h1 className="text-2xl font-bold">Catch-up games</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {session.isAdmin
            ? 'Every unplayed game across the league that isn’t part of this week’s fixtures — overdue games from earlier matchdays, plus catch-up games that sit outside the matchday grid.'
            : 'Your unplayed games from earlier matchdays and any catch-up games you owe.'}
          {' '}They&apos;re playable anytime{enterHint}.
        </p>
      </div>

      {backlog.length === 0 ? (
        <EmptyState emoji="✅" title="All caught up" hint={session.isAdmin ? 'No outstanding games from earlier matchdays right now.' : 'You have no games to catch up on right now.'} />
      ) : (
        <div className="space-y-6">
          {matchdayGroups.map(([number, list]) => (
            <section key={number} className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Matchday {number} · {list.length} unplayed
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map(game => <GameCard key={game.id} game={game} currentUserId={session.userId} />)}
              </div>
            </section>
          ))}

          {noMatchdayGames.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Outside the matchdays · {noMatchdayGames.length}
              </h2>
              <p className="text-sm text-muted-foreground -mt-1">
                Owed games that don&apos;t belong to any matchday — a mid-season joiner&apos;s backlog, or a
                leftover pairing from rebuilding the schedule. Playable anytime.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {noMatchdayGames.map(game => <GameCard key={game.id} game={game} currentUserId={session.userId} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
