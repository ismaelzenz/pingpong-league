import type { DisplayData } from '@/lib/display'
import { BoardShell, RecordsTicker } from '@/components/display/parts'
import { PagedStandings, PagedThisWeek } from '@/components/display/Paged'

/**
 * The office-TV wall board: this week's matches (left) and the standings (right) on top — both
 * auto-paging as a carousel to fit any roster size — with the record tiles scrolling in a ticker
 * along the bottom. Used by both the live /display page and the /display/preview page.
 */
export default function DisplayBoard({
  tournamentName,
  data,
  refreshMs,
}: {
  tournamentName: string
  data: DisplayData
  refreshMs?: number
}) {
  const { leaderboard, records, matchdayNumber, weekGames, byePlayers, catchUpGames } = data

  return (
    <BoardShell tournamentName={tournamentName} matchdayNumber={matchdayNumber} refreshMs={refreshMs}>
      <div className="flex-1 min-h-0 flex flex-col gap-[1.8vh]">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-[1.8vh] flex-1 min-h-0">
          <section className="lg:col-span-2 min-h-0"><PagedThisWeek weekGames={weekGames} byePlayers={byePlayers} catchUpGames={catchUpGames} /></section>
          <section className="lg:col-span-3 min-h-0"><PagedStandings rows={leaderboard} /></section>
        </div>
        <section className="shrink-0">
          <RecordsTicker records={records} />
        </section>
      </div>
    </BoardShell>
  )
}
