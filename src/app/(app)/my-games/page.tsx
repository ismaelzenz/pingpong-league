import Link from 'next/link'
import { requireSession, getCurrentUser } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, users, matchdays, eloHistory } from '@/lib/db/schema'
import { eq, or, and } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { format } from 'date-fns'
import { getDisplayTournament } from '@/lib/data/tournaments'
import { buttonVariants } from '@/components/ui/button'
import EmptyState from '@/components/common/EmptyState'
import MyGamesView, { type MyGameItem } from '@/components/game/MyGamesView'
import { isFinished } from '@/lib/domain/gameStatus'
import { isCatchUpBacklog } from '@/lib/domain/backlog'
import { perspective } from '@/lib/domain/gameResult'
import { overdueLabel, shortRange, todayISO } from '@/lib/dates'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function MyGamesPage() {
  const session = await requireSession()

  const tournament = await getDisplayTournament()
  if (!tournament) {
    return <EmptyState emoji="🏓" title="No tournament yet" hint="Your games will show up here once one starts." />
  }

  // Three parallel reads: my games (both players joined in), the season's matchdays (to tell
  // what's due, this week's, or still to come), and what each of my games did to my rating.
  const homeUser = alias(users, 'home_user')
  const awayUser = alias(users, 'away_user')
  const [rows, mds, eloRows, me] = await Promise.all([
    db.select({
      game: games,
      homeName: homeUser.name, homeColor: homeUser.avatarColor, awayName: awayUser.name, awayColor: awayUser.avatarColor,
    })
      .from(games)
      .leftJoin(homeUser, eq(homeUser.id, games.homePlayerId))
      .leftJoin(awayUser, eq(awayUser.id, games.awayPlayerId))
      .where(and(
        eq(games.tournamentId, tournament.id),
        or(eq(games.homePlayerId, session.userId), eq(games.awayPlayerId, session.userId)),
      )),
    db.select().from(matchdays).where(eq(matchdays.tournamentId, tournament.id)),
    db.select({ refId: eloHistory.refId, delta: eloHistory.delta })
      .from(eloHistory)
      .where(and(eq(eloHistory.userId, session.userId), eq(eloHistory.source, 'league'))),
    getCurrentUser(session.userId),
  ])

  const today = todayISO()
  const mdById = new Map(mds.map(m => [m.id, m]))
  const weekStartByMd = new Map(mds.map(m => [m.id, m.weekStart]))
  const eloByGame = new Map(eloRows.map(r => [r.refId, r.delta]))
  // The featured matchday, as on the Matchdays page: the one in progress ("This week") or, between
  // matchdays, the next to start ("Next up"). `latestStarted` is the catch-up page's reference.
  const byNumber = [...mds].sort((a, b) => a.number - b.number)
  const inProgress = mds.find(m => m.weekStart && m.weekEnd && m.weekStart <= today && today <= m.weekEnd) ?? null
  const featured = inProgress ?? byNumber.find(m => m.weekStart != null && m.weekStart > today) ?? null
  const latestStarted = inProgress ?? [...byNumber].reverse().find(m => m.weekStart != null && m.weekStart <= today) ?? null

  const items: (MyGameItem & { order: string })[] = rows.map(({ game: g, homeName, homeColor, awayName, awayColor }) => {
    const isHome = g.homePlayerId === session.userId
    const opponent = isHome
      ? { id: g.awayPlayerId, name: awayName ?? '—', avatarColor: awayColor }
      : { id: g.homePlayerId, name: homeName ?? '—', avatarColor: homeColor }
    const md = mdById.get(g.matchdayId)
    const label = g.isCatchUp ? 'Catch-up game'
      : md ? `Matchday ${md.number}${md.weekStart && md.weekEnd ? ` · ${shortRange(md.weekStart, md.weekEnd)}` : ''}` : 'Game'
    const base = { id: g.id, opponent, label, postponed: g.status === 'postponed' }

    if (isFinished(g.status)) {
      const p = perspective(g, session.userId)
      return {
        ...base, bucket: 'played' as const,
        result: { won: p.won, mySets: p.mySets, oppSets: p.oppSets, forfeited: p.forfeited },
        eloDelta: eloByGame.get(g.id) ?? null,
        order: g.submittedAt ?? g.updatedAt,
      }
    }
    // Rows with an "Enter result" button have room for one short line on a phone: the matchday and
    // how late it is (catch-up), or just the matchday (this week — the heading says when).
    // Owed: the catch-up backlog, plus a game whose week has simply ended (between matchdays the
    // backlog rule still counts last week as current).
    const weekOver = !!md?.weekEnd && md.weekEnd < today
    if (weekOver || isCatchUpBacklog(g, weekStartByMd, latestStarted?.id ?? null, today)) {
      return {
        ...base, bucket: 'catchUp' as const,
        label: g.isCatchUp ? 'Catch-up game' : `Matchday ${md?.number ?? '?'}`,
        overdue: weekOver && !g.isCatchUp ? overdueLabel(md!.weekEnd!).text : undefined,
        order: String(md?.number ?? 0).padStart(4, '0'),
      }
    }
    if (featured && g.matchdayId === featured.id) {
      return { ...base, bucket: 'thisWeek' as const, label: `Matchday ${featured.number}`, order: '' }
    }
    return {
      ...base, bucket: 'upcoming' as const,
      month: md?.weekStart ? format(new Date(md.weekStart), 'MMMM yyyy') : undefined,
      order: String(md?.number ?? 9999).padStart(4, '0'),
    }
  })
  // Played newest first; everything still to play soonest first.
  items.sort((a, b) => a.bucket === 'played' && b.bucket === 'played' ? b.order.localeCompare(a.order) : a.order.localeCompare(b.order))

  const played = items.filter(i => i.result)
  const wins = played.filter(i => i.result!.won).length
  const owed = items.filter(i => i.bucket === 'catchUp').length
  const left = items.length - played.length

  const tile = (value: React.ReactNode, label: string, tone?: string) => (
    <div className="rounded-xl bg-card px-3 py-2.5 text-center ring-1 ring-foreground/10">
      <p className={cn('text-2xl font-black leading-tight tabular-nums', tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">My games</h1>
          <p className="truncate text-muted-foreground">{tournament.name}</p>
        </div>
        <Link href="/matchdays" className={buttonVariants({ variant: 'outline', size: 'sm' })}>All matchdays</Link>
      </div>

      {items.length === 0 ? (
        <EmptyState emoji="🏓" title="No games yet" hint="You don't have any games in this tournament." />
      ) : (
        <>
          {/* How you're doing at a glance; "to catch up" goes orange when you owe games. */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tile(<><span className="text-green-600 dark:text-green-500">{wins}</span><span className="text-muted-foreground">–</span><span className="text-red-500">{played.length - wins}</span></>, 'Won–lost')}
            {tile(played.length, 'Played')}
            {tile(left, 'Left to play')}
            {tile(owed, 'To catch up', owed > 0 ? 'text-orange-600 dark:text-orange-400' : undefined)}
          </div>

          <MyGamesView
            me={{ id: session.userId, name: session.name, avatarColor: me?.avatarColor ?? null }}
            games={items}
            featuredTitle={inProgress ? 'This week' : 'Next up'}
          />
        </>
      )}
    </div>
  )
}
