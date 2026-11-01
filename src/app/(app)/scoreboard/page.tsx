import { requireSession } from '@/lib/auth/session'
import Link from 'next/link'
import { computeStandingsWithMovement } from '@/lib/data/standings'
import { getLiveTournament } from '@/lib/data/tournaments'
import { getLatestFinishedTournament } from '@/lib/data/recap'
import { Card, CardContent } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import EmptyState from '@/components/common/EmptyState'
import MyPositionCard from '@/components/scoreboard/MyPositionCard'
import StandingsTable from '@/components/scoreboard/StandingsTable'

export const dynamic = 'force-dynamic'

export default async function ScoreboardPage() {
  const session = await requireSession()

  const live = await getLiveTournament()
  const tournament = live?.status === 'active' ? live : null

  if (!tournament) {
    const lastFinished = await getLatestFinishedTournament()
    return (
      <EmptyState emoji="🏓" title="No active tournament" hint="Check back once a season is underway — the standings will show up here.">
        {lastFinished && (
          <Link href="/recap" className={buttonVariants()}>🏆 View {lastFinished.name} recap</Link>
        )}
      </EmptyState>
    )
  }

  const scores = await computeStandingsWithMovement(tournament.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scoreboard</h1>
        <p className="text-muted-foreground">{tournament.name}</p>
      </div>

      <MyPositionCard standings={scores} userId={session.userId} />

      {/* overflow-visible: a clipping card would stop the table's header from sticking. */}
      <Card className="py-0 overflow-visible">
        <CardContent className="p-0">
          <StandingsTable rows={scores} currentUserId={session.userId} stickyHeader />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        1 pt per set won + 1 for the win · ▲▼ rank change this matchday · dots: last 5 results, newest on the right
      </p>
    </div>
  )
}
