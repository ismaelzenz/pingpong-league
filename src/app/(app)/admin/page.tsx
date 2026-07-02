import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, participants, users, matchdays, games } from '@/lib/db/schema'
import { eq, and, lt, inArray } from 'drizzle-orm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import AdminActions from '@/components/AdminActions'
import CreateTournamentForm from '@/components/CreateTournamentForm'
import DeleteTournamentButton from '@/components/DeleteTournamentButton'
import AdminResetPasswordButton from '@/components/AdminResetPasswordButton'
import UnenrollButton from '@/components/UnenrollButton'
import EliminatePlayerButton from '@/components/EliminatePlayerButton'
import AddPlayerForm from '@/components/AddPlayerForm'
import BreakWeeksForm from '@/components/BreakWeeksForm'
import StartDateForm from '@/components/StartDateForm'
import SetLiveButton from '@/components/SetLiveButton'
import InviteLink from '@/components/InviteLink'

export const dynamic = 'force-dynamic'

function parseBreakWeeks(raw: string | null): string[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) redirect('/dashboard')

  const { t } = await searchParams

  const allTournaments = await db.select().from(tournaments).orderBy(tournaments.createdAt)
  const manageable = allTournaments.filter(x => x.status !== 'finished')
  const finished = allTournaments.filter(x => x.status === 'finished')

  // Which tournament is being managed: the one named in ?t= (if still manageable),
  // otherwise the live one, otherwise the first non-finished.
  const requestedId = t ? parseInt(t) : NaN
  const selected =
    manageable.find(x => x.id === requestedId) ??
    manageable.find(x => x.isLive) ??
    manageable[0] ??
    null

  // Check for matchdays that have ended but still have unplayed games (selected tournament).
  const today = new Date().toISOString().split('T')[0]
  const overdueMatchdays: { id: number; number: number; count: number }[] = []
  if (selected?.status === 'active') {
    const pastMatchdays = await db.select({ id: matchdays.id, number: matchdays.number })
      .from(matchdays)
      .where(and(eq(matchdays.tournamentId, selected.id), lt(matchdays.weekEnd, today)))
    for (const md of pastMatchdays) {
      const unplayed = await db.select().from(games)
        .where(and(eq(games.matchdayId, md.id), inArray(games.status, ['pending', 'postponed'])))
      if (unplayed.length > 0) overdueMatchdays.push({ id: md.id, number: md.number, count: unplayed.length })
    }
  }

  const participantsWithProfiles = selected
    ? await db.select({ participant: participants, user: users })
        .from(participants)
        .leftJoin(users, eq(users.id, participants.userId))
        .where(eq(participants.tournamentId, selected.id))
        .orderBy(participants.joinedAt)
    : []

  // Users with an account who aren't yet in the selected tournament — eligible to be added
  // by an admin (during registration, since self-join is disabled, or mid-season).
  let eligibleUsers: { id: number; name: string; email: string }[] = []
  if (selected && selected.status !== 'finished') {
    const enrolledIds = new Set(participantsWithProfiles.map(p => p.participant.userId))
    const allUsers = await db.select({ id: users.id, name: users.name, email: users.email }).from(users)
    eligibleUsers = allUsers.filter(u => !enrolledIds.has(u.id)).sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage tournaments and participants</p>
      </div>

      {/* Tournament switcher — swap between concurrent tournaments (e.g. the live one and a
          test copy). Only the tournament marked "Live" is visible to players. */}
      {manageable.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tournaments</CardTitle>
            <CardDescription>
              Only the <strong>Live</strong> tournament is visible to players. Create extra ones to test or
              fix bugs without touching the live season.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {manageable.map(tour => (
                <Link
                  key={tour.id}
                  href={`/admin?t=${tour.id}`}
                  className={cn(
                    buttonVariants({ variant: selected?.id === tour.id ? 'default' : 'outline', size: 'sm' }),
                    'gap-2',
                  )}
                >
                  {tour.name}
                  {tour.isLive && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">LIVE</Badge>
                  )}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {overdueMatchdays.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40">
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">⚠️ Unplayed games from past matchdays</p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400">The following matchdays have ended with games still pending. Go to each matchday to forfeit or reschedule individual games.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {overdueMatchdays.map(md => (
                <Link key={md.id} href={`/matchdays/${md.id}`}>
                  <Badge variant="outline" className="border-yellow-400 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 cursor-pointer">
                    Matchday {md.number} — {md.count} unplayed
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selected && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selected.name}
                    {selected.isLive && <Badge variant="secondary">Live</Badge>}
                  </CardTitle>
                  <CardDescription>{selected.isLive ? 'Visible to players' : 'Hidden from players (test/standby)'}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {!selected.isLive && <SetLiveButton tournamentId={selected.id} />}
                  <Badge variant={selected.status === 'active' ? 'default' : 'outline'}>
                    {selected.status === 'registration' ? 'Registration open' : 'Active'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <AdminActions
                tournamentId={selected.id}
                status={selected.status}
                participantCount={participantsWithProfiles.length}
              />
            </CardContent>
          </Card>

          {selected.status === 'registration' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Start date</CardTitle>
                <CardDescription>
                  When play begins. Matchday 1 lands on the week of this date; leave it blank to start
                  the week after you generate the schedule.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StartDateForm tournamentId={selected.id} initialDate={selected.startDate} />
              </CardContent>
            </Card>
          )}

          {selected.status === 'registration' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schedule breaks</CardTitle>
                <CardDescription>
                  Weeks to leave matchday-free (holidays, summer break…). Set these before starting —
                  the generated schedule skips them.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BreakWeeksForm tournamentId={selected.id} initialWeeks={parseBreakWeeks(selected.breakWeeks)} />
              </CardContent>
            </Card>
          )}

          {selected.status !== 'finished' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selected.status === 'registration' ? 'Add a player' : 'Add a player mid-season'}
                </CardTitle>
                <CardDescription>
                  {selected.status === 'registration'
                    ? 'Players don’t self-join — add each one here from their account.'
                    : 'Adds the player against everyone (home & away). Past matchdays become catch-up games; the rest are slotted into upcoming matchdays.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AddPlayerForm
                  tournamentId={selected.id}
                  eligibleUsers={eligibleUsers}
                  phase={selected.status === 'registration' ? 'registration' : 'active'}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invite players</CardTitle>
              <CardDescription>
                Share this link so colleagues can create an account — then add them above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteLink tournamentId={selected.id} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Participants ({participantsWithProfiles.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {participantsWithProfiles.length === 0 && (
                <p className="text-sm text-muted-foreground">No participants yet.</p>
              )}
              {participantsWithProfiles.map(({ participant, user }, i) => (
                <div key={participant.id}>
                  {i > 0 && <Separator className="mb-2" />}
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{user?.name}</p>
                      <p className="text-muted-foreground text-xs">{user?.email}</p>
                      {user?.email && <AdminResetPasswordButton email={user.email} name={user.name ?? ''} />}
                    </div>
                    <div className="flex items-center gap-2">
                      {selected.status === 'registration' && (
                        <UnenrollButton participantId={participant.id} playerName={user?.name ?? 'this player'} />
                      )}
                      {selected.status === 'active' && (
                        <EliminatePlayerButton participantId={participant.id} playerName={user?.name ?? 'this player'} />
                      )}
                      <Badge variant="outline" className="text-xs">#{i + 1}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Always available: spin up another tournament (e.g. a bug-repro copy) any time. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a tournament</CardTitle>
          <CardDescription>
            {manageable.length === 0
              ? 'Start a new season. The first one becomes the live tournament players see.'
              : 'Add another tournament. It stays hidden from players until you set it live.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTournamentForm />
        </CardContent>
      </Card>

      {finished.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past tournaments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {finished.map(tour => (
              <div key={tour.id} className="flex items-center justify-between text-sm">
                <span>{tour.name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Finished</Badge>
                  <DeleteTournamentButton tournamentId={tour.id} name={tour.name} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
