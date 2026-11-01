import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireSession } from '@/lib/auth/session'
import { getFinishedTournaments, getFinishedTournamentById, computeRecap } from '@/lib/data/recap'
import RecapView from '@/components/recap/RecapView'
import PastSeasons from '@/components/recap/PastSeasons'
import { ChevronLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = await getFinishedTournamentById(parseInt(id))
  return { title: t ? `${t.name} recap` : 'Season recap' }
}

export default async function SeasonRecapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()

  const tournament = await getFinishedTournamentById(parseInt(id))
  if (!tournament) notFound()

  const [recap, finished] = await Promise.all([
    computeRecap(tournament.id, tournament.name),
    getFinishedTournaments(),
  ])

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Link href="/recap" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        Latest recap
      </Link>
      <RecapView recap={recap} currentUserId={session.userId} />
      <PastSeasons seasons={finished} currentId={tournament.id} />
    </div>
  )
}
