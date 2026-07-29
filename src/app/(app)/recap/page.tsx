import { requireSession } from '@/lib/session'
import { getFinishedTournaments, computeRecap } from '@/lib/recap'
import RecapView from '@/components/recap/RecapView'
import PastSeasons from '@/components/recap/PastSeasons'
import EmptyState from '@/components/common/EmptyState'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Season recap' }

export default async function RecapPage() {
  const session = await requireSession()

  const finished = await getFinishedTournaments()
  const latest = finished[0]
  if (!latest) {
    return <EmptyState emoji="🏆" title="No finished season yet" hint="Once a tournament wraps up, its recap — champion, awards and season stats — will appear here." />
  }

  const recap = await computeRecap(latest.id, latest.name)

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <RecapView recap={recap} currentUserId={session.userId} />
      <PastSeasons seasons={finished} currentId={latest.id} />
    </div>
  )
}
