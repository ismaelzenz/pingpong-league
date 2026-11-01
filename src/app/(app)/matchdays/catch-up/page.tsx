import Link from 'next/link'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { games, matchdays, participants, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getLiveTournament } from '@/lib/data/tournaments'
import { overdueLabel, todayISO } from '@/lib/dates'
import { isCatchUpBacklog } from '@/lib/domain/backlog'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import GameCard from '@/components/game/GameCard'
import GameRow from '@/components/game/GameRow'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import EmptyState from '@/components/common/EmptyState'
import BackLink from '@/components/common/BackLink'

export const dynamic = 'force-dynamic'

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'postponed', label: 'Postponed' },
] as const

// Unplayed games that aren't part of this week's fixtures: games left unplayed/postponed in earlier
// matchdays, plus any newcomer's catch-up games. Admins see the whole league's backlog — with who's
// behind and filters to chase them up; everyone else sees only their own. Shares its "what counts as
// backlog" rule with the office display (isCatchUpBacklog), so the two never drift.
export default async function CatchUpPage({ searchParams }: { searchParams: Promise<{ player?: string; status?: string }> }) {
  const session = await requireSession()
  const params = await searchParams

  const live = await getLiveTournament()
  const tournament = live?.status === 'active' ? live : null
  if (!tournament) {
    return <EmptyState emoji="⏳" title="No active tournament" hint="Once a season starts, any games to catch up on will appear here." />
  }

  const [allGames, mds, rosterRaw] = await Promise.all([
    db.select().from(games).where(eq(games.tournamentId, tournament.id)).orderBy(games.id),
    db.select().from(matchdays).where(eq(matchdays.tournamentId, tournament.id)),
    db.select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
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
  const personById = new Map(rosterRaw.filter(p => p.id != null).map(p => [p.id!, { id: p.id!, name: p.name ?? '—', avatarColor: p.avatarColor }]))
  const person = (id: number) => personById.get(id) ?? { id, name: '—', avatarColor: null }
  const involves = (g: { homePlayerId: number; awayPlayerId: number }, id: number) => g.homePlayerId === id || g.awayPlayerId === id

  const backlog = allGames
    .filter(g => isCatchUpBacklog(g, weekStartByMd, currentMd?.id ?? null, today))
    // Non-admins only ever see games they're in.
    .filter(g => session.isAdmin || involves(g, session.userId))
    .map(g => {
      const md = mdById.get(g.matchdayId)
      return {
        ...g,
        homePlayer: person(g.homePlayerId),
        awayPlayer: person(g.awayPlayerId),
        matchday: md ? { number: md.number } : null,
        weekStart: md?.weekStart ?? null,
        weekEnd: md?.weekEnd ?? null,
      }
    })

  if (backlog.length === 0) {
    return (
      <div className="space-y-6">
        <Header isAdmin={session.isAdmin} />
        <EmptyState emoji="✅" title="All caught up" hint={session.isAdmin ? 'No outstanding games from earlier matchdays right now.' : 'You have no games to catch up on right now.'} />
      </div>
    )
  }

  // ── Filters (admin) ── who's behind, and pending vs postponed. Plain links, so they're shareable.
  const playerFilter = session.isAdmin && params.player ? Number(params.player) : null
  const statusFilter = session.isAdmin && (params.status === 'pending' || params.status === 'postponed') ? params.status : 'all'
  const filtering = playerFilter != null || statusFilter !== 'all'
  const hrefWith = (next: { player?: number | null; status?: string }) => {
    const p = new URLSearchParams()
    const player = 'player' in next ? next.player : playerFilter
    const status = next.status ?? statusFilter
    if (player != null) p.set('player', String(player))
    if (status !== 'all') p.set('status', status)
    const qs = p.toString()
    return `/matchdays/catch-up${qs ? `?${qs}` : ''}`
  }

  const owed = new Map<number, number>()
  for (const g of backlog) for (const id of [g.homePlayerId, g.awayPlayerId]) owed.set(id, (owed.get(id) ?? 0) + 1)
  const behind = [...owed.entries()].sort((a, b) => b[1] - a[1] || person(a[0]).name.localeCompare(person(b[0]).name))

  // ── What to list ── your own games are pinned as full cards (they're the ones you can act on);
  // the rest of the league follows as compact rows. While filtering, everything matching is listed.
  const mine = filtering ? [] : backlog.filter(g => involves(g, session.userId))
  const listed = backlog
    .filter(g => filtering || !involves(g, session.userId))
    .filter(g => playerFilter == null || involves(g, playerFilter))
    .filter(g => statusFilter === 'all' || g.status === statusFilter)

  const byMatchday = new Map<number, typeof listed>()
  const outside: typeof listed = []
  for (const g of listed) {
    if (g.isCatchUp || !g.matchday) { outside.push(g); continue }
    if (!byMatchday.has(g.matchday.number)) byMatchday.set(g.matchday.number, [])
    byMatchday.get(g.matchday.number)!.push(g)
  }
  const groups = [...byMatchday.entries()].sort((a, b) => a[0] - b[0]) // oldest first

  const chip = (active: boolean) => cn(
    'shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
    active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
  )

  return (
    <div className="space-y-6">
      <Header isAdmin={session.isAdmin} />

      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-orange-700 dark:text-orange-400">Your games · {mine.length}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mine.map(game => <GameCard key={game.id} game={game} currentUserId={session.userId} />)}
          </div>
        </section>
      )}

      {session.isAdmin && (
        <section className="space-y-3">
          <h2 className="font-semibold">Who&apos;s behind</h2>
          {/* One scrolling row on a phone rather than a tall wrapped block. */}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <Link href={hrefWith({ player: null })} className={chip(playerFilter == null)}>Everyone · {backlog.length}</Link>
            {behind.map(([id, n]) => {
              const p = person(id)
              return (
                <Link key={id} href={hrefWith({ player: id })} className={chip(playerFilter === id)}>
                  <PlayerAvatar name={p.name} avatarColor={p.avatarColor} className="h-5 w-5" fallbackClassName="text-[9px]" />
                  {p.name} · <span className="tabular-nums font-semibold">{n}</span>
                </Link>
              )
            })}
          </div>
          <div className="flex gap-2">
            {STATUS_FILTERS.map(f => (
              <Link key={f.key} href={hrefWith({ status: f.key })} className={chip(statusFilter === f.key)}>{f.label}</Link>
            ))}
          </div>
        </section>
      )}

      {(groups.length > 0 || outside.length > 0) ? (
        <div className="space-y-5">
          {session.isAdmin && !filtering && mine.length > 0 && (
            <h2 className="font-semibold">Rest of the league · {listed.length}</h2>
          )}
          {groups.map(([number, list]) => {
            const age = list[0].weekEnd ? overdueLabel(list[0].weekEnd) : null
            return (
              <section key={number} className="space-y-2">
                <div className="flex items-baseline justify-between gap-2 px-1">
                  <h3 className="text-sm font-semibold">Matchday {number}</h3>
                  {age && (
                    <span className={cn('text-xs', age.weeks >= 4 ? 'font-semibold text-orange-600 dark:text-orange-400' : 'text-muted-foreground')}>
                      {age.text} · {list.length} game{list.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <Card className="py-0 gap-0 divide-y">
                  {list.map(g => <GameRow key={g.id} game={g} />)}
                </Card>
              </section>
            )
          })}
          {outside.length > 0 && (
            <section className="space-y-2">
              <div className="px-1">
                <h3 className="text-sm font-semibold">Outside the matchdays · {outside.length}</h3>
                <p className="text-xs text-muted-foreground">A mid-season joiner&apos;s backlog, or a pairing left over from rebuilding the schedule.</p>
              </div>
              <Card className="py-0 gap-0 divide-y">
                {outside.map(g => <GameRow key={g.id} game={g} />)}
              </Card>
            </section>
          )}
        </div>
      ) : filtering ? (
        <EmptyState emoji="🔍" title="Nothing matches" hint="No outstanding games for this filter." />
      ) : null}
    </div>
  )
}

function Header({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div>
      <BackLink href="/matchdays" className="mb-2">All matchdays</BackLink>
      <h1 className="text-2xl font-bold">Catch-up games</h1>
      <p className="text-muted-foreground text-sm mt-1">
        {isAdmin
          ? 'Every unplayed game from earlier matchdays across the league. Open one to enter a result, postpone or forfeit it.'
          : 'Your unplayed games from earlier matchdays — playable anytime.'}
      </p>
    </div>
  )
}
