import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { games, users, matchdays } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import PlayerLink from '@/components/PlayerLink'
import GameResultForm from '@/components/GameResultForm'
import AdminGameActions from '@/components/AdminGameActions'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; variant: 'default' | 'outline' | 'secondary' | 'destructive' }> = {
  pending: { label: 'Not played yet', variant: 'outline' },
  result_entered: { label: 'Awaiting confirmation', variant: 'secondary' },
  confirmed: { label: 'Confirmed', variant: 'default' },
  postponed: { label: 'Postponed', variant: 'secondary' },
  forfeited: { label: 'Forfeited', variant: 'destructive' },
}

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const game = await db.select().from(games).where(eq(games.id, parseInt(id))).then(r => r[0] ?? null)
  if (!game) notFound()

  const [homePlayer, awayPlayer, matchday] = await Promise.all([
    db.select({ id: users.id, name: users.name, avatarColor: users.avatarColor }).from(users).where(eq(users.id, game.homePlayerId)).then(r => r[0]),
    db.select({ id: users.id, name: users.name, avatarColor: users.avatarColor }).from(users).where(eq(users.id, game.awayPlayerId)).then(r => r[0]),
    db.select({ id: matchdays.id, number: matchdays.number, weekStart: matchdays.weekStart }).from(matchdays).where(eq(matchdays.id, game.matchdayId)).then(r => r[0]),
  ])

  const isParticipant = session.userId === game.homePlayerId || session.userId === game.awayPlayerId
  const isSubmitter = game.submittedBy === session.userId
  const canConfirm = game.status === 'result_entered' && isParticipant && !isSubmitter
  const today = new Date().toISOString().split('T')[0]
  const matchdayStarted = !matchday?.weekStart || matchday.weekStart <= today
  const canEnter = game.status === 'pending' && isParticipant && matchdayStarted
  const canPostpone = (game.status === 'pending' || game.status === 'postponed') && (isParticipant || session.isAdmin)
  const canAdminAct = session.isAdmin && !['confirmed', 'forfeited'].includes(game.status)

  const config = statusConfig[game.status] ?? statusConfig.pending

  const initials = (name?: string) =>
    (name ?? '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <Link
          href={matchday ? `/matchdays/${matchday.id}` : '/matchdays'}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 -ml-2 px-2 py-1 rounded-md hover:bg-accent transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          {matchday ? `Matchday ${matchday.number}` : 'Matchdays'}
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Game details</h1>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-around text-center gap-4">
            <PlayerLink userId={game.homePlayerId} currentUserId={session.userId} className="flex-1 flex flex-col items-center gap-2">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-base text-white" style={{ backgroundColor: homePlayer?.avatarColor ?? undefined }}>
                  {initials(homePlayer?.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">Home</p>
                <p className={`font-bold text-lg ${homePlayer?.id === session.userId ? 'text-primary' : ''}`}>
                  {homePlayer?.name ?? '—'}{homePlayer?.id === session.userId && ' (you)'}
                </p>
              </div>
            </PlayerLink>
            <div className="text-center px-2">
              {game.homeSets !== null && game.awaySets !== null ? (
                <div className="flex items-center gap-3">
                  <span className={`text-4xl font-black ${game.homeSets > game.awaySets ? 'text-green-600' : game.homeSets < game.awaySets ? 'text-red-500' : ''}`}>
                    {game.homeSets}
                  </span>
                  <span className="text-2xl text-muted-foreground">–</span>
                  <span className={`text-4xl font-black ${game.awaySets > game.homeSets ? 'text-green-600' : game.awaySets < game.homeSets ? 'text-red-500' : ''}`}>
                    {game.awaySets}
                  </span>
                </div>
              ) : (
                <span className="text-3xl font-black text-muted-foreground">vs</span>
              )}
              {matchday && <p className="text-xs text-muted-foreground mt-1">Matchday {matchday.number}</p>}
            </div>
            <PlayerLink userId={game.awayPlayerId} currentUserId={session.userId} className="flex-1 flex flex-col items-center gap-2">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="text-base text-white" style={{ backgroundColor: awayPlayer?.avatarColor ?? undefined }}>
                  {initials(awayPlayer?.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm text-muted-foreground">Away</p>
                <p className={`font-bold text-lg ${awayPlayer?.id === session.userId ? 'text-primary' : ''}`}>
                  {awayPlayer?.name ?? '—'}{awayPlayer?.id === session.userId && ' (you)'}
                </p>
              </div>
            </PlayerLink>
          </div>
        </CardContent>
      </Card>

      {isParticipant && (
        <>
          {game.status === 'pending' && !matchdayStarted && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-4 pb-4 text-sm text-blue-800">
                📅 This game is scheduled for a future matchday. You&apos;ll be able to enter the result once the matchday starts.
              </CardContent>
            </Card>
          )}

          {canEnter && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Enter result</CardTitle>
              </CardHeader>
              <CardContent>
                <GameResultForm gameId={game.id} mode="enter" />
              </CardContent>
            </Card>
          )}

          {game.status === 'result_entered' && isSubmitter && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4 text-sm text-yellow-800">
                ⏳ You entered the result. Waiting for your opponent to confirm.
              </CardContent>
            </Card>
          )}

          {canConfirm && (
            <Card className="border-yellow-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Confirm result</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Your opponent entered: <strong>{game.homeSets} – {game.awaySets}</strong> (home – away sets). Is this correct?
                </p>
              </CardHeader>
              <CardContent>
                <GameResultForm gameId={game.id} mode="confirm" />
              </CardContent>
            </Card>
          )}

          {canPostpone && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Game actions</p>
                <GameResultForm gameId={game.id} mode="postpone" isPostponed={game.status === 'postponed'} />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {game.status === 'confirmed' && (
        <div className="text-center text-sm text-muted-foreground py-4">
          ✅ Result confirmed. The scoreboard has been updated.
        </div>
      )}

      {canAdminAct && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-4">
            <AdminGameActions gameId={game.id} isPostponed={game.status === 'postponed'} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
