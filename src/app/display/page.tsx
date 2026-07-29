import { getLiveTournament } from '@/lib/tournament'
import { computeDisplayData } from '@/lib/display'
import AutoRefresh from '@/components/display/AutoRefresh'
import DisplayBoard from '@/components/display/DisplayBoard'

export const dynamic = 'force-dynamic'

const REFRESH_MS = 60_000

export default async function DisplayPage() {
  const live = await getLiveTournament()
  const tournament = live?.status === 'active' ? live : null

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-6">
        <AutoRefresh intervalMs={REFRESH_MS} />
        <div className="text-8xl">🏓</div>
        <p className="text-3xl text-slate-400">No active tournament right now.</p>
        <a href="/display/preview" className="text-slate-500 hover:text-slate-300 text-lg underline underline-offset-4">
          See a preview of the board
        </a>
      </div>
    )
  }

  const data = await computeDisplayData(tournament.id)

  return <DisplayBoard tournamentName={tournament.name} data={data} refreshMs={REFRESH_MS} />
}
