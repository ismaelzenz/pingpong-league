import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { tournaments, participants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import JoinTournamentButton from '@/components/JoinTournamentButton'

export const dynamic = 'force-dynamic'

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tournamentId = parseInt(id)
  const tournament = Number.isNaN(tournamentId)
    ? null
    : await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)).then(r => r[0] ?? null)

  const session = await getSession()
  const loggedIn = !!session.userId

  const alreadyIn = loggedIn && tournament
    ? !!(await db.select().from(participants)
        .where(and(eq(participants.tournamentId, tournament.id), eq(participants.userId, session.userId)))
        .then(r => r[0]))
    : false

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🏓</div>
          <h1 className="text-2xl font-bold">Ping Pong League</h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            {!tournament ? (
              <p className="text-muted-foreground">This tournament link is invalid or no longer exists.</p>
            ) : (
              <>
                <div>
                  <p className="text-lg font-bold">{tournament.name}</p>
                  <p className="text-sm text-muted-foreground">You&apos;ve been invited to join</p>
                </div>

                {tournament.status !== 'registration' ? (
                  loggedIn ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        This tournament is already underway. Ask an admin to add you and you&apos;ll be slotted in.
                      </p>
                      <Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>Go to dashboard</Link>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        This tournament is already underway. Create an account and an admin can add you.
                      </p>
                      <div className="flex flex-col gap-2">
                        <Link href="/register" className={buttonVariants()}>Create account</Link>
                        <Link href="/login" className={buttonVariants({ variant: 'outline' })}>Sign in</Link>
                      </div>
                    </>
                  )
                ) : !loggedIn ? (
                  <>
                    <p className="text-sm text-muted-foreground">Sign in or create an account to join.</p>
                    <div className="flex flex-col gap-2">
                      <Link href="/register" className={buttonVariants()}>Create account</Link>
                      <Link href="/login" className={buttonVariants({ variant: 'outline' })}>Sign in</Link>
                    </div>
                  </>
                ) : alreadyIn ? (
                  <>
                    <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900 rounded-full px-4 py-2 text-sm font-medium">
                      ✓ You&apos;re already in this tournament
                    </div>
                    <div><Link href="/dashboard" className={buttonVariants({ variant: 'outline' })}>Go to dashboard</Link></div>
                  </>
                ) : (
                  <JoinTournamentButton tournamentId={tournament.id} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
