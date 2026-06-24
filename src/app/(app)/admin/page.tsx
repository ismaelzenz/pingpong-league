import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, participants, users, matchdays, games } from '@/lib/db/schema'
import { eq, and, lt, inArray } from 'drizzle-orm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import AdminActions from '@/components/AdminActions'
import CreateTournamentForm from '@/components/CreateTournamentForm'
import DeleteTournamentButton from '@/components/DeleteTournamentButton'
import AdminResetPasswordButton from '@/components/AdminResetPasswordButton'
import UnenrollButton from '@/components/UnenrollButton'
import EliminatePlayerButton from '@/components/EliminatePlayerButton'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) redirect('/dashboard')

  const allTournaments = await db.select().from(tournaments).orderBy(tournaments.createdAt)
  const activeTournament = allTournaments.find(t => t.status !== 'finished') ?? null

  // Check for matchdays that have ended but still have unplayed games
  const today = new Date().toISOString().split('T')[0]
  let overdueMatchdays: { id: number; number: number; count: number }[] = []
  if (activeTournament?.status === 'active') {
    const pastMatchdays = await db.select({ id: matchdays.id, number: matchdays.number })
      .from(matchdays)
      .where(and(eq(matchdays.tournamentId, activeTournament.id), lt(matchdays.weekEnd, today)))
    for (const md of pastMatchdays) {
      const unplayed = await db.select().from(games)
        .where(and(eq(games.matchdayId, md.id), inArray(games.status, ['pending', 'postponed'])))
      if (unplayed.length > 0) overdueMatchdays.push({ id: md.id, number: md.number, count: unplayed.length })
    }
  }

  const participantsWithProfiles = activeTournament
    ? await db.select({ participant: participants, user: users })
        .from(participants)
        .leftJoin(users, eq(users.id, participants.userId))
        .where(eq(participants.tournamentId, activeTournament.id))
        .orderBy(participants.joinedAt)
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage tournaments and participants</p>
      </div>

      {overdueMatchdays.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-800">⚠️ Unplayed games from past matchdays</p>
            <p className="text-xs text-yellow-700">The following matchdays have ended with games still pending. Go to each matchday to forfeit or reschedule individual games.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {overdueMatchdays.map(md => (
                <Link key={md.id} href={`/matchdays/${md.id}`}>
                  <Badge variant="outline" className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 cursor-pointer">
                    Matchday {md.number} — {md.count} unplayed
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!activeTournament ? (
        <Card>
          <CardHeader>
            <CardTitle>Create a tournament</CardTitle>
            <CardDescription>Start a new season. Players can register once it&apos;s created.</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateTournamentForm />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{activeTournament.name}</CardTitle>
                  <CardDescription>Current tournament</CardDescription>
                </div>
                <Badge variant={activeTournament.status === 'active' ? 'default' : 'outline'}>
                  {activeTournament.status === 'registration' ? 'Registration open' : 'Active'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <AdminActions
                tournamentId={activeTournament.id}
                status={activeTournament.status}
                participantCount={participantsWithProfiles.length}
              />
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
                      {activeTournament.status === 'registration' && (
                        <UnenrollButton participantId={participant.id} playerName={user?.name ?? 'this player'} />
                      )}
                      {activeTournament.status === 'active' && (
                        <EliminatePlayerButton participantId={participant.id} playerName={user?.name ?? 'this player'} />
                      )}
                      <Badge variant="outline" className="text-xs">#{i + 1}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {allTournaments.filter(t => t.status === 'finished').length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Past tournaments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {allTournaments.filter(t => t.status === 'finished').map(t => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span>{t.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Finished</Badge>
                      <DeleteTournamentButton tournamentId={t.id} name={t.name} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
