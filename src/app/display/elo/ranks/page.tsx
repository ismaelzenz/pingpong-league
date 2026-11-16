import { computeDisplayElo } from '@/lib/data/displayElo'
import EloBoard from '@/components/display/EloBoard'

export const dynamic = 'force-dynamic'

// The ELO wall board: the ladder and everyone's rank by day. For a second screen, or to point the
// TV at instead of /display.
export default async function DisplayEloRanksPage() {
  const elo = await computeDisplayElo()
  return <EloBoard title="ELO ranking" elo={elo} refreshMs={60_000} />
}
