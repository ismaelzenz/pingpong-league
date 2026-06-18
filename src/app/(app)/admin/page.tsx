import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, participants, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import AdminActions from '@/components/AdminActions'
import CreateTournamentForm from '@/components/CreateTournamentForm'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) redirect('/dashboard')

  const allTournaments = await db.select().from(tournaments).orderBy(tournaments.createdAt)
  const activeTournament = allTournaments.find(t => t.status !== 'finished') ?? null

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
                    </div>
                    <Badge variant="outline" className="text-xs">#{i + 1}</Badge>
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
                    <Badge variant="secondary">Finished</Badge>
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
