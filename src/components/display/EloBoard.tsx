import type { DisplayElo } from '@/lib/data/displayElo'
import { BoardShell, ELO_RECORD_KEYS, RecordsTicker } from '@/components/display/parts'
import { PagedEloLadder, PanelFrame } from '@/components/display/Paged'
import EloRanks from '@/components/display/EloRanks'

/**
 * The ELO wall board at /display/elo/ranks: the all-time ladder (left), everyone's place on it
 * day by day over the last month (right), and the ELO record tiles along the bottom.
 */
export default function EloBoard({ title, elo, refreshMs }: { title: string; elo: DisplayElo; refreshMs?: number }) {
  return (
    <BoardShell tournamentName={title} matchdayNumber={null} refreshMs={refreshMs}>
      <div className="flex-1 min-h-0 flex flex-col gap-[1.8vh]">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-[1.8vh] flex-1 min-h-0">
          <section className="lg:col-span-2 min-h-0"><PagedEloLadder rows={elo.ladder} title="Ladder" /></section>
          <section className="lg:col-span-3 min-h-0">
            <PanelFrame title="Rank by day" chip="Ladder place · last 30 days" page={0} pageCount={1} intervalMs={0}>
              {[<EloRanks key="ranks" race={elo.race} />]}
            </PanelFrame>
          </section>
        </div>
        <section className="shrink-0">
          {/* Four tiles are narrower than a TV, so the marquee gets them twice over to loop seamlessly. */}
          <RecordsTicker records={elo.records} keys={[...ELO_RECORD_KEYS, ...ELO_RECORD_KEYS]} />
        </section>
      </div>
    </BoardShell>
  )
}
