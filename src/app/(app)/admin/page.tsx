import Link from 'next/link'
import { requireAdminSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, participants, users, matchdays, games } from '@/lib/db/schema'
import { eq, and, lt, inArray, count } from 'drizzle-orm'
import { todayISO } from '@/lib/dates'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import AdminActions from '@/components/admin/AdminActions'
import CreateTournamentForm from '@/components/admin/CreateTournamentForm'
import DeleteTournamentButton from '@/components/admin/DeleteTournamentButton'
import AdminResetPasswordButton from '@/components/admin/AdminResetPasswordButton'
import UnenrollButton from '@/components/admin/UnenrollButton'
import EliminatePlayerButton from '@/components/admin/EliminatePlayerButton'
import AddPlayerForm from '@/components/admin/AddPlayerForm'
import BreakWeeksForm from '@/components/admin/BreakWeeksForm'
import StartDateForm from '@/components/admin/StartDateForm'
import SetLiveButton from '@/components/admin/SetLiveButton'
import EloTournamentToggle from '@/components/admin/EloTournamentToggle'
import WhatsNewControl from '@/components/admin/WhatsNewControl'
import { SETTINGS, getBoolSetting } from '@/lib/settings'
import { WHATS_NEW } from '@/lib/whatsNew'
import InviteLink from '@/components/admin/InviteLink'
import DeleteUserButton from '@/components/admin/DeleteUserButton'
import ArchiveUserButton from '@/components/admin/ArchiveUserButton'
import { isAdmin } from '@/lib/admin'
import { Monitor, ExternalLink, Award, Swords } from 'lucide-react'

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
  await requireAdminSession()

  const { t } = await searchParams

  // Two parallel batches: what doesn't depend on which tournament is selected, then what does.
  const [allTournaments, whatsNewEnabled, allAccounts, homePlayers, awayPlayers] = await Promise.all([
    db.select().from(tournaments).orderBy(tournaments.createdAt),
    getBoolSetting(SETTINGS.whatsNewEnabled),
    // One read of the users table serves the account list, the add-player picker and the
    // "what's new" dismissal count.
    db.select({ id: users.id, name: users.name, email: users.email, archivedAt: users.archivedAt, seen: users.whatsNewSeen })
      .from(users).orderBy(users.name),
    // Which users still have games (can't be account-deleted until removed from them).
    db.selectDistinct({ id: games.homePlayerId }).from(games),
    db.selectDistinct({ id: games.awayPlayerId }).from(games),
  ])
  const usersInGames = new Set<number>([...homePlayers, ...awayPlayers].map(r => r.id))
  const activeAccounts = allAccounts.filter(u => !u.archivedAt)

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

  // "What's new" banner state: the league-wide switch, plus how many members have dismissed the
  // current note (which is what "show again" would undo).
  const whatsNewDismissed = activeAccounts.filter(m => m.seen === WHATS_NEW.version).length

  const today = todayISO()
  const [selectedRecordedGames, overdueMatchdays, participantsWithProfiles] = await Promise.all([
    // Results already on the books for this season — what's at stake if ELO is switched on midway.
    selected
      ? db.select({ n: count() }).from(games)
          .where(and(eq(games.tournamentId, selected.id), eq(games.status, 'confirmed')))
          .then(r => r[0]?.n ?? 0)
      : 0,
    // Matchdays that have ended but still have unplayed games — counted in one grouped query.
    selected?.status === 'active'
      ? db.select({ id: matchdays.id, number: matchdays.number, count: count() })
          .from(matchdays)
          .innerJoin(games, eq(games.matchdayId, matchdays.id))
          .where(and(
            eq(matchdays.tournamentId, selected.id),
            lt(matchdays.weekEnd, today),
            inArray(games.status, ['pending', 'postponed']),
          ))
          .groupBy(matchdays.id, matchdays.number)
          .orderBy(matchdays.number)
      : [],
    selected
      ? db.select({ participant: participants, user: users })
          .from(participants)
          .leftJoin(users, eq(users.id, participants.userId))
          .where(eq(participants.tournamentId, selected.id))
          .orderBy(participants.joinedAt)
      : [],
  ])

  // Users with an account who aren't yet in the selected tournament — eligible to be added
  // by an admin (during registration, since self-join is disabled, or mid-season).
  let eligibleUsers: { id: number; name: string; email: string }[] = []
  if (selected && selected.status !== 'finished') {
    const enrolledIds = new Set(participantsWithProfiles.map(p => p.participant.userId))
    eligibleUsers = activeAccounts.filter(u => !enrolledIds.has(u.id)).sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage tournaments and participants</p>
      </div>

      {/* Office display — the public TV wall board. Opens in a new tab for the office screen. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Office display</CardTitle>
          <CardDescription>
            The public wall board — live standings, this week&apos;s games and the fun wall. Open it
            full-screen on the office TV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/display"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          >
            <Monitor className="h-4 w-4" />
            Open office display
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
        </CardContent>
      </Card>

      {/* Daily tournament — self-serve quick league/knockout, separate from the official season. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Daily tournament</CardTitle>
          <CardDescription>
            Spin up a quick one-off league or knockout (singles or doubles) with league members or
            guests — great for a lunch or after-work session. Runs in the browser, separate from the
            official season.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/dailytournament"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
          >
            <Swords className="h-4 w-4" />
            Open daily tournament
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
        </CardContent>
      </Card>

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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">What&apos;s new banner</CardTitle>
              <CardDescription>
                The release note members see at the top of every page. It stays up until you turn it
                off; each person only sees it until they dismiss it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WhatsNewControl
                enabled={whatsNewEnabled}
                dismissedCount={whatsNewDismissed}
                totalMembers={activeAccounts.length}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ELO</CardTitle>
              <CardDescription>
                Whether this season&apos;s results move players&apos; lifetime ELO ratings. Changeable at any
                time — switching it on midway asks what to do with the games already played.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EloTournamentToggle
                tournamentId={selected.id}
                countsForElo={selected.countsForElo}
                eloCountsFrom={selected.eloCountsFrom}
                playedGames={selectedRecordedGames}
              />
            </CardContent>
          </Card>

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
                  <Link
                    href={`/recap/${tour.id}`}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-muted-foreground')}
                  >
                    <Award className="h-3.5 w-3.5" />
                    Recap
                  </Link>
                  <Badge variant="secondary">Finished</Badge>
                  <DeleteTournamentButton tournamentId={tour.id} name={tour.name} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Account management — delete a member's account entirely (login + data). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts ({allAccounts.length})</CardTitle>
          <CardDescription>
            <strong>Mark as left</strong> hides an ex-member from player pickers but keeps all their
            history and recaps. <strong>Delete</strong> permanently removes an account — only possible
            for accounts with no games (e.g. guests/test accounts); real players should be archived.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {allAccounts.map((u, i) => (
            <div key={u.id}>
              {i > 0 && <Separator className="mb-2" />}
              <div className="flex items-center justify-between text-sm gap-3">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-1.5">
                    <span className={`truncate ${u.archivedAt ? 'text-muted-foreground' : ''}`}>{u.name}</span>
                    {isAdmin(u.email) && <Badge variant="secondary" className="text-[10px] shrink-0">Admin</Badge>}
                    {u.archivedAt && <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/50 text-amber-600">Left</Badge>}
                  </p>
                  <p className="text-muted-foreground text-xs truncate">{u.email}</p>
                </div>
                {!isAdmin(u.email) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <ArchiveUserButton userId={u.id} name={u.name} archived={!!u.archivedAt} />
                    {!usersInGames.has(u.id) && <DeleteUserButton userId={u.id} name={u.name} email={u.email} />}
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
