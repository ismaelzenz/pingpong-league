'use client'

import { Trophy } from 'lucide-react'
import { type Competitor, type Results, type SavedTournament, type StandingRow, competitorName, scoreWinner, cycleScore, buildLeagueRounds, computeStandings, EMPTY_SCORE } from './logic'
import { Header, Avatars, ScoreCell } from './parts'

// ── League ────────────────────────────────────────────────────────────────────────────────────

export default function LeagueView({ saved, updateResults, onReset }: { saved: SavedTournament; updateResults: (fn: (r: Results) => Results) => void; onReset: () => void }) {
  const { competitors } = saved.config
  const rounds = buildLeagueRounds(competitors)
  const standings = computeStandings(competitors, saved.results)

  // Once every fixture has a result, crown the season with a podium of the top three.
  const allMatches = rounds.flatMap(r => r.matches)
  const complete = allMatches.length > 0 && allMatches.every(m => scoreWinner(saved.results[m.id]) != null)
  const podium = standings.slice(0, 3)

  const bump = (id: string, side: 'a' | 'b') => updateResults(prev => {
    const cur = prev[id] ?? EMPTY_SCORE
    return { ...prev, [id]: { ...cur, [side]: cycleScore(cur[side]) } }
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-[3vh] flex flex-col">
      <Header name={saved.config.name} onReset={onReset} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-[3vh]">
        {/* Standings */}
        <div className="lg:col-span-2">
          <h2 className="text-[2.4vh] font-bold mb-[1.4vh]">Standings</h2>
          <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-slate-400 text-[1.5vh] border-b border-slate-800">
                  <th className="text-left pl-[1.6vh] pr-1 py-[1vh] font-medium">#</th>
                  <th className="text-left pl-1 py-[1vh] font-medium w-full">{saved.config.mode === 'singles' ? 'Player' : 'Team'}</th>
                  <th className="text-right px-[1.2vh] py-[1vh] font-medium">P</th>
                  <th className="text-right px-[1.2vh] py-[1vh] font-medium">W</th>
                  <th className="text-right px-[1.2vh] py-[1vh] font-medium">L</th>
                  <th className="text-right px-[1.6vh] py-[1vh] font-medium">+/–</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => (
                  <tr key={row.competitor.id} className="border-b border-slate-800 last:border-0">
                    <td className="pl-[1.6vh] pr-1 py-[1vh] text-[2vh] font-black text-slate-300">
                      {i === 0 ? <Trophy className="h-[2.2vh] w-[2.2vh] text-yellow-500" /> : i + 1}
                    </td>
                    <td className="pl-1 py-[1vh]">
                      <div className="flex items-center gap-[1vh] min-w-0">
                        <Avatars members={row.competitor.members} size="h-[3.4vh] w-[3.4vh]" fallback="text-[1.4vh]" />
                        <span className="font-semibold text-[2vh] truncate">{competitorName(row.competitor)}</span>
                      </div>
                    </td>
                    <td className="px-[1.2vh] py-[1vh] text-right text-[1.9vh] text-slate-400 tabular-nums">{row.played}</td>
                    <td className="px-[1.2vh] py-[1vh] text-right text-[1.9vh] text-green-400 font-semibold tabular-nums">{row.won}</td>
                    <td className="px-[1.2vh] py-[1vh] text-right text-[1.9vh] text-red-400 font-semibold tabular-nums">{row.lost}</td>
                    <td className="px-[1.6vh] py-[1vh] text-right text-[1.9vh] font-bold tabular-nums">{row.setsWon - row.setsLost > 0 ? '+' : ''}{row.setsWon - row.setsLost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {complete && podium.length > 0 && <LeaguePodium top={podium} />}
        </div>

        {/* Fixtures */}
        <div className="lg:col-span-3 space-y-[2vh]">
          <h2 className="text-[2.4vh] font-bold">Fixtures</h2>
          {rounds.map(round => (
            <div key={round.number}>
              <p className="text-[1.7vh] font-semibold uppercase tracking-wider text-slate-500 mb-[1vh]">Round {round.number}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1.4vh]">
                {round.matches.map(m => {
                  const score = saved.results[m.id]
                  const w = scoreWinner(score)
                  return (
                    <div key={m.id} className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden divide-y divide-slate-800">
                      <LeagueSlot competitor={m.a} score={score?.a} won={w === 'a'} lost={w === 'b'} onClick={() => bump(m.id, 'a')} />
                      <LeagueSlot competitor={m.b} score={score?.b} won={w === 'b'} lost={w === 'a'} onClick={() => bump(m.id, 'b')} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Final league podium — three steps (1st tallest, in the middle), shown once the season is over.
const PODIUM_META: Record<1 | 2 | 3, { step: string; card: string; badge: string; label: string; av: string; avf: string }> = {
  1: { step: 'h-[15vh]', card: 'border-yellow-400/60 from-yellow-400/25', badge: 'bg-yellow-500 text-yellow-950', label: 'text-yellow-400', av: 'h-[7.5vh] w-[7.5vh]', avf: 'text-[2.8vh]' },
  2: { step: 'h-[10.5vh]', card: 'border-slate-300/50 from-slate-300/15', badge: 'bg-slate-300 text-slate-900', label: 'text-slate-300', av: 'h-[6vh] w-[6vh]', avf: 'text-[2.3vh]' },
  3: { step: 'h-[7.5vh]', card: 'border-amber-600/50 from-amber-600/15', badge: 'bg-amber-600 text-amber-950', label: 'text-amber-500', av: 'h-[6vh] w-[6vh]', avf: 'text-[2.3vh]' },
}

function LeaguePodium({ top }: { top: StandingRow[] }) {
  const [first, second, third] = top
  return (
    <div className="mt-[3vh]">
      <h2 className="flex items-center gap-[1vh] text-[2.4vh] font-bold mb-[2vh]">
        <Trophy className="h-[2.6vh] w-[2.6vh] text-yellow-500" /> Final podium
      </h2>
      <div className="flex items-end justify-center gap-[1.4vh]">
        {second && <PodiumColumn place={2} row={second} />}
        {first && <PodiumColumn place={1} row={first} />}
        {third && <PodiumColumn place={3} row={third} />}
      </div>
    </div>
  )
}

function PodiumColumn({ place, row }: { place: 1 | 2 | 3; row: StandingRow }) {
  const m = PODIUM_META[place]
  return (
    <div className="flex flex-1 min-w-0 max-w-[14vw] flex-col items-center">
      <Avatars members={row.competitor.members} size={m.av} fallback={m.avf} />
      <p className="mt-[1vh] mb-[1.2vh] px-1 text-[1.9vh] font-bold text-center truncate max-w-full">{competitorName(row.competitor)}</p>
      <div className={`w-full ${m.step} rounded-t-xl border-2 ${m.card} bg-gradient-to-b to-transparent flex items-start justify-center pt-[1.4vh]`}>
        <span className={`inline-flex items-center justify-center h-[4vh] w-[4vh] rounded-full font-black text-[2.2vh] ${m.badge}`}>{place}</span>
      </div>
    </div>
  )
}

function LeagueSlot({ competitor, score, won, lost, onClick }: { competitor: Competitor; score: number | null | undefined; won: boolean; lost: boolean; onClick: () => void }) {
  return (
    <div className={`flex items-center gap-[1.2vh] px-[1.6vh] py-[1.1vh] ${won ? 'bg-emerald-500/10' : ''}`}>
      <div className={lost ? 'opacity-60' : ''}><Avatars members={competitor.members} size="h-[4vh] w-[4vh]" fallback="text-[1.7vh]" /></div>
      <span className={`flex-1 text-[2.2vh] truncate ${won ? 'font-bold text-white' : lost ? 'font-medium text-slate-400' : 'font-semibold'}`}>{competitorName(competitor)}</span>
      <ScoreCell score={score} won={won} onClick={onClick} />
    </div>
  )
}
