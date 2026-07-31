import PlayerAvatar from '@/components/player/PlayerAvatar'
import { Trophy } from 'lucide-react'

// Fullscreen mock knockout (doubles) for the office TV: 4 teams of 2 → two semifinals, a final
// and a champion. Unplayed — a blank bracket to fill in during a day tournament. No database.
// Sized in vh/vw so it fills the screen at any resolution (e.g. 3840×2160). View at /bracket.
export const metadata = { title: 'Knockout bracket' }

type Player = { name: string; color: string }
type Team = { players: [Player, Player] }
type Slot = Team | { tbd: string }
type Match = { a: Slot; b: Slot }

const TEAM1: Team = { players: [{ name: 'Isma', color: '#0ea5e9' }, { name: 'Sofia', color: '#eab308' }] }
const TEAM2: Team = { players: [{ name: 'Ana', color: '#ec4899' }, { name: 'Raymond', color: '#22c55e' }] }
const TEAM3: Team = { players: [{ name: 'Jurriaan', color: '#8b5cf6' }, { name: 'Menno', color: '#f97316' }] }
const TEAM4: Team = { players: [{ name: 'Sameer', color: '#f43f5e' }, { name: 'Yoni', color: '#14b8a6' }] }

const SF1: Match = { a: TEAM1, b: TEAM3 }
const SF2: Match = { a: TEAM2, b: TEAM4 }
const FINAL: Match = { a: { tbd: 'Winner of Semifinal 1' }, b: { tbd: 'Winner of Semifinal 2' } }

const LINE = 'border-slate-600'

export default function BracketPage() {
  return (
    <div className="h-screen bg-slate-950 text-slate-100 p-[3vh] flex flex-col overflow-hidden">
      <header className="shrink-0 mb-[2.5vh]">
        <h1 className="text-[4vh] leading-none font-black tracking-tight">Doubles Knockout</h1>
        <p className="text-slate-400 text-[2vh] mt-[0.8vh]">4 teams · single elimination</p>
      </header>

      <div className="flex-1 min-h-0 flex items-stretch">
        {/* Semifinals */}
        <div className="w-[27vw] shrink-0 flex flex-col">
          <div className="flex-1 flex items-center"><MatchCard match={SF1} label="Semifinal 1" /></div>
          <div className="flex-1 flex items-center"><MatchCard match={SF2} label="Semifinal 2" /></div>
        </div>

        {/* Connector: two semis → final */}
        <div className="relative flex-1 min-w-[6vw]">
          <div className={`absolute left-0 top-1/4 w-1/2 border-t-2 ${LINE}`} />
          <div className={`absolute left-0 top-3/4 w-1/2 border-t-2 ${LINE}`} />
          <div className={`absolute left-1/2 top-1/4 h-1/2 border-l-2 ${LINE}`} />
          <div className={`absolute left-1/2 top-1/2 w-1/2 border-t-2 ${LINE}`} />
        </div>

        {/* Final */}
        <div className="w-[27vw] shrink-0 flex flex-col justify-center"><MatchCard match={FINAL} label="Final" /></div>

        {/* Connector: final → champion */}
        <div className="relative flex-1 min-w-[4vw]">
          <div className={`absolute left-0 top-1/2 w-full border-t-2 ${LINE}`} />
        </div>

        {/* Champion */}
        <div className="w-[22vw] shrink-0 flex flex-col justify-center"><ChampionCard /></div>
      </div>
    </div>
  )
}

function MatchCard({ match, label }: { match: Match; label: string }) {
  return (
    <div className="w-full">
      <p className="text-[1.8vh] font-medium text-slate-400 mb-[1vh]">{label}</p>
      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden divide-y divide-slate-800">
        <SlotRow slot={match.a} />
        <SlotRow slot={match.b} />
      </div>
    </div>
  )
}

function SlotRow({ slot }: { slot: Slot }) {
  if ('tbd' in slot) {
    return (
      <div className="flex items-center gap-[1.4vh] px-[1.8vh] py-[1.8vh] text-slate-500">
        <div className="h-[5vh] w-[5vh] rounded-full border-2 border-dashed border-slate-600 shrink-0" />
        <span className="flex-1 text-[2.4vh] italic truncate">{slot.tbd}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-[1.4vh] px-[1.8vh] py-[1.6vh]">
      <div className="flex -space-x-[1vh] shrink-0">
        {slot.players.map(p => (
          <PlayerAvatar key={p.name} name={p.name} avatarColor={p.color} className="h-[5vh] w-[5vh] ring-2 ring-slate-900" fallbackClassName="text-[2vh]" />
        ))}
      </div>
      <span className="flex-1 text-[2.6vh] font-semibold truncate">
        {slot.players.map(p => p.name).join(' & ')}
      </span>
    </div>
  )
}

function ChampionCard() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-600 p-[3vh] text-center text-slate-500">
      <Trophy className="mx-auto h-[7vh] w-[7vh] opacity-40" />
      <p className="text-[1.8vh] font-semibold uppercase tracking-widest mt-[1.5vh]">Champions</p>
      <p className="text-[2.6vh] italic mt-[2vh]">To be decided</p>
    </div>
  )
}
