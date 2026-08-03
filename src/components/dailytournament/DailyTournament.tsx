'use client'

import { useState, useEffect } from 'react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import { Trophy, Medal, RotateCcw, Plus, X, Shuffle, Users, User, Swords, ListOrdered } from 'lucide-react'
import {
  type Person, type Competitor, type Format, type Mode, type Results, type SavedTournament, type BracketMatch,
  competitorName, scoreWinner, cycleScore, buildBracket, buildLeagueRounds, computeStandings, EMPTY_SCORE,
} from '@/lib/dailyTournament'

const STORAGE_KEY = 'zenz-daily-tournament-v1'
const GUEST_COLORS = ['#f43f5e', '#0ea5e9', '#8b5cf6', '#22c55e', '#eab308', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16']
const LINE = 'border-slate-600'
type AppUser = { id: string; name: string; color: string }

export default function DailyTournament({ appUsers }: { appUsers: AppUser[] }) {
  const [saved, setSaved] = useState<SavedTournament | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setSaved(JSON.parse(raw)) } catch { /* ignore */ }
      setLoaded(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try { if (saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); else localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [saved, loaded])

  const updateResults = (fn: (r: Results) => Results) => setSaved(s => (s ? { ...s, results: fn(s.results) } : s))
  const reset = () => { if (confirm('Start a new tournament? This clears the current one.')) setSaved(null) }

  if (!loaded) return <div className="h-screen bg-slate-950" />
  if (!saved) return <Setup appUsers={appUsers} onCreate={config => setSaved({ config, results: {} })} />

  return saved.config.format === 'knockout'
    ? <KnockoutView saved={saved} updateResults={updateResults} onReset={reset} />
    : <LeagueView saved={saved} updateResults={updateResults} onReset={reset} />
}

// ── Setup ─────────────────────────────────────────────────────────────────────────────────────

function Setup({ appUsers, onCreate }: { appUsers: AppUser[]; onCreate: (c: SavedTournament['config']) => void }) {
  const [name, setName] = useState('Daily Tournament')
  const [format, setFormat] = useState<Format>('knockout')
  const [mode, setMode] = useState<Mode>('singles')
  const [thirdPlace, setThirdPlace] = useState(true)
  const [people, setPeople] = useState<Person[]>([])
  const [pairs, setPairs] = useState<Person[][] | null>(null) // doubles: generated teams (null = not yet)
  const [search, setSearch] = useState('')
  const [guest, setGuest] = useState('')

  const has = (id: string) => people.some(p => p.id === id)
  const togglePerson = (p: Person) => {
    setPairs(null)
    setPeople(prev => (prev.some(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]))
  }
  const addGuest = () => {
    const n = guest.trim()
    if (!n) return
    setPairs(null)
    setPeople(prev => [...prev, { id: `g-${crypto.randomUUID()}`, name: n, color: GUEST_COLORS[prev.length % GUEST_COLORS.length] }])
    setGuest('')
  }
  const generatePairs = () => {
    const a = [...people]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
    const p: Person[][] = []
    for (let i = 0; i + 1 < a.length; i += 2) p.push([a[i], a[i + 1]])
    setPairs(p)
  }

  const evenPeople = people.length % 2 === 0
  const canPair = mode === 'doubles' && people.length >= 4 && evenPeople
  const competitorCount = mode === 'singles' ? people.length : (pairs?.length ?? 0)
  const valid = mode === 'singles' ? people.length >= 2 : (pairs != null && pairs.length >= 2)

  const filtered = appUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))

  const generate = () => {
    const competitors: Competitor[] = mode === 'singles'
      ? people.map(p => ({ id: crypto.randomUUID(), members: [p] }))
      : (pairs ?? []).map(t => ({ id: crypto.randomUUID(), members: t }))
    onCreate({ name: name.trim() || 'Daily Tournament', format, mode, competitors, thirdPlace })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-3xl font-black bg-transparent outline-none border-b-2 border-transparent focus:border-slate-700 w-full"
          />
          <p className="text-slate-400 mt-1">Set up a quick tournament — pick a format, add players, and go.</p>
        </div>

        {/* Format & mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Choice label="Format">
            <Toggle active={format === 'knockout'} onClick={() => setFormat('knockout')} icon={<Swords className="h-4 w-4" />} title="Knockout" desc="Single elimination bracket" />
            <Toggle active={format === 'league'} onClick={() => setFormat('league')} icon={<ListOrdered className="h-4 w-4" />} title="League" desc="Everyone plays everyone" />
          </Choice>
          <Choice label="Mode">
            <Toggle active={mode === 'singles'} onClick={() => { setMode('singles'); setPairs(null) }} icon={<User className="h-4 w-4" />} title="Singles" desc="1 v 1" />
            <Toggle active={mode === 'doubles'} onClick={() => { setMode('doubles'); setPairs(null) }} icon={<Users className="h-4 w-4" />} title="Doubles" desc="Teams of 2" />
          </Choice>
        </div>

        {format === 'knockout' && (
          <button
            onClick={() => setThirdPlace(v => !v)}
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left hover:border-slate-600 transition-colors w-full sm:w-auto"
          >
            <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${thirdPlace ? 'bg-emerald-600' : 'bg-slate-700'}`}>
              <span className={`h-5 w-5 rounded-full bg-white transition-transform ${thirdPlace ? 'translate-x-5' : ''}`} />
            </span>
            <span>
              <span className="flex items-center gap-2 font-semibold"><Medal className="h-4 w-4 text-amber-500" /> Play for 3rd place</span>
              <span className="block text-xs text-slate-400 mt-0.5">The two semifinal losers play a bronze-medal game</span>
            </span>
          </button>
        )}

        {/* People */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-bold mb-2">Add players</h2>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search league members…"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-500 mb-2"
            />
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
              {filtered.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No members found.</p>}
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => togglePerson(u)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${has(u.id) ? 'bg-emerald-500/10' : 'hover:bg-slate-800/60'}`}
                >
                  <PlayerAvatar name={u.name} avatarColor={u.color} className="h-7 w-7" fallbackClassName="text-xs" />
                  <span className="flex-1 truncate">{u.name}</span>
                  {has(u.id) ? <X className="h-4 w-4 text-slate-400" /> : <Plus className="h-4 w-4 text-slate-500" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={guest}
                onChange={e => setGuest(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addGuest() }}
                placeholder="Add a guest by name…"
                className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <button onClick={addGuest} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 text-sm font-medium">Add</button>
            </div>
          </div>

          {/* Selected pool / generated teams */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold">
                {mode === 'doubles' && pairs ? `Teams (${pairs.length})` : `Players (${people.length})`}
              </h2>
              {mode === 'doubles' && pairs && (
                <button onClick={() => setPairs(null)} className="text-xs text-slate-400 hover:text-white">Edit players</button>
              )}
            </div>

            {people.length === 0 && <p className="text-sm text-slate-500">No one added yet.</p>}

            {/* Doubles, pairs generated → show the teams */}
            {mode === 'doubles' && pairs ? (
              <>
                <div className="space-y-2">
                  {pairs.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500 w-14 shrink-0">Team {i + 1}</span>
                      <div className="flex-1 flex flex-wrap gap-3">
                        {t.map(p => (
                          <span key={p.id} className="inline-flex items-center gap-1.5 text-sm">
                            <PlayerAvatar name={p.name} avatarColor={p.color} className="h-6 w-6" fallbackClassName="text-[10px]" />
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={generatePairs} className="mt-3 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
                  <Shuffle className="h-3.5 w-3.5" /> Re-generate pairs
                </button>
              </>
            ) : (
              <>
                {/* Pool of players (singles competitors, or doubles before pairing) */}
                <div className="flex flex-wrap gap-2">
                  {people.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-slate-800 pl-1 pr-2 py-1 text-sm">
                      <PlayerAvatar name={p.name} avatarColor={p.color} className="h-6 w-6" fallbackClassName="text-[10px]" />
                      {p.name}
                      <button onClick={() => togglePerson(p)}><X className="h-3.5 w-3.5 text-slate-400 hover:text-white" /></button>
                    </span>
                  ))}
                </div>
                {mode === 'doubles' && (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={generatePairs}
                      disabled={!canPair}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold transition-colors"
                    >
                      <Shuffle className="h-4 w-4" /> Generate pairs
                    </button>
                    {people.length >= 4 && !evenPeople && <span className="text-xs text-amber-400">Even number of players needed.</span>}
                    {people.length < 4 && <span className="text-xs text-slate-500">Add at least 4 players.</span>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Generate */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={generate}
            disabled={!valid}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 font-bold transition-colors"
          >
            {format === 'knockout' ? 'Generate bracket' : 'Generate fixtures'} · {competitorCount} {mode === 'singles' ? 'players' : 'teams'}
          </button>
          {!valid && mode === 'singles' && <span className="text-sm text-slate-500">Add at least 2 players.</span>}
          {!valid && mode === 'doubles' && !pairs && <span className="text-sm text-slate-500">Add players, then generate the pairs.</span>}
          {!valid && mode === 'doubles' && pairs && pairs.length < 2 && <span className="text-sm text-slate-500">Need at least 2 teams.</span>}
        </div>
      </div>
    </div>
  )
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  )
}
function Toggle({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}`}>
      <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
    </button>
  )
}

// ── Running: shared header ──────────────────────────────────────────────────────────────────────

function Header({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <header className="shrink-0 mb-[2vh] flex items-start justify-between">
      <h1 className="text-[3.6vh] leading-none font-black tracking-tight">{name}</h1>
      <button onClick={onReset} className="shrink-0 flex items-center gap-[1vh] rounded-lg bg-slate-800 hover:bg-slate-700 px-[1.6vh] py-[1vh] text-[1.8vh] font-medium text-slate-300 transition-colors">
        <RotateCcw className="h-[2.2vh] w-[2.2vh]" /> New
      </button>
    </header>
  )
}

function Avatars({ members, size, fallback }: { members: Person[]; size: string; fallback: string }) {
  return (
    <div className="flex -space-x-[1vh] shrink-0">
      {members.map(m => (
        <PlayerAvatar key={m.id} name={m.name} avatarColor={m.color} className={`${size} ring-2 ring-slate-900`} fallbackClassName={fallback} />
      ))}
    </div>
  )
}

function ScoreCell({ score, won, onClick }: { score: number | null | undefined; won: boolean; onClick?: () => void }) {
  if (onClick) {
    return (
      <button onClick={onClick} className={`shrink-0 min-w-[5vh] h-[5vh] rounded-lg text-[3vh] font-black tabular-nums flex items-center justify-center transition-colors ${won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
        {score ?? '–'}
      </button>
    )
  }
  return score != null ? <span className={`shrink-0 text-[3vh] font-black tabular-nums ${won ? 'text-emerald-400' : 'text-slate-500'}`}>{score}</span> : null
}

// ── Knockout ────────────────────────────────────────────────────────────────────────────────────

function KnockoutView({ saved, updateResults, onReset }: { saved: SavedTournament; updateResults: (fn: (r: Results) => Results) => void; onReset: () => void }) {
  const { competitors } = saved.config
  const bracket = buildBracket(competitors, saved.results)
  const showThird = saved.config.thirdPlace !== false && !!bracket.thirdPlace && competitors.length >= 4

  const bump = (matchId: string, side: 'a' | 'b') => updateResults(prev => {
    const cur = prev[matchId] ?? EMPTY_SCORE
    const next: Results = { ...prev, [matchId]: { ...cur, [side]: cycleScore(cur[side]) } }
    if (matchId !== 'third') {
      const round = parseInt(matchId.slice(1))
      for (const key of Object.keys(next)) {
        if (key === matchId) continue
        if (key === 'third') { if (round < bracket.finalRound) delete next[key]; continue }
        const kr = parseInt(key.slice(1))
        if (!isNaN(kr) && kr > round) delete next[key]
      }
    }
    return next
  })

  return (
    <div className="h-screen bg-slate-950 text-slate-100 p-[3vh] flex flex-col overflow-hidden">
      <Header name={saved.config.name} onReset={onReset} />
      <div className="flex-1 min-h-0 flex items-stretch overflow-x-auto">
        {bracket.rounds.map((round, r) => (
          <div key={r} className="flex items-stretch">
            <div className="w-[19vw] min-w-[220px] shrink-0 flex flex-col">
              {round.map(m => (
                <div key={m.id} style={{ flexGrow: m.weight ?? 1, flexBasis: 0 }} className="flex items-center px-[0.5vw] min-h-0">
                  <BracketMatchCard match={m} onBump={bump} />
                </div>
              ))}
            </div>
            {r < bracket.finalRound ? <BracketConnector left={round} right={bracket.rounds[r + 1]} /> : <SimpleConnector />}
          </div>
        ))}
        <div className="w-[19vw] min-w-[200px] shrink-0 flex flex-col justify-center px-[0.5vw]">
          <ResultCard tone="gold" title="Champion" competitor={bracket.champion} />
        </div>
      </div>

      {showThird && bracket.thirdPlace && (
        <div className="shrink-0 h-[22vh] mt-[2vh] pt-[2vh] border-t border-slate-800 flex items-center gap-[2vw]">
          <h2 className="shrink-0 w-[14vw] flex items-center gap-[1vh] text-[2.2vh] font-bold text-slate-300">
            <Medal className="h-[2.8vh] w-[2.8vh] text-amber-600" /> Playoff for 3rd
          </h2>
          <div className="w-[24vw] min-w-[220px] shrink-0"><BracketMatchCard match={bracket.thirdPlace} label="3rd / 4th place" onBump={bump} /></div>
          <div className="relative flex-1 min-w-[3vw] self-stretch"><div className={`absolute left-0 top-1/2 w-full border-t-2 ${LINE}`} /></div>
          <div className="w-[22vw] min-w-[200px] shrink-0"><ResultCard tone="bronze" title="3rd place" competitor={bracket.bronze} /></div>
        </div>
      )}
    </div>
  )
}

function SimpleConnector() {
  return <div className="relative w-[4vw] min-w-[40px] shrink-0"><div className={`absolute left-0 top-1/2 w-full border-t-2 ${LINE}`} /></div>
}

/** Connects a round's matches to the next, using each match's alignment weight so lines meet the
 *  vertically-centered cards — works for balanced and greedy (bye-carrying) brackets alike. */
function BracketConnector({ left, right }: { left: BracketMatch[]; right: BracketMatch[] }) {
  const total = left.reduce((s, m) => s + (m.weight ?? 1), 0) || 1
  const centers = (arr: BracketMatch[]) => {
    const cs: number[] = []
    let acc = 0
    for (const m of arr) { const w = m.weight ?? 1; cs.push(((acc + w / 2) / total) * 100); acc += w }
    return cs
  }
  const lc = centers(left)
  const rc = centers(right)
  const lines: React.ReactNode[] = []
  right.forEach((_, j) => {
    const f0 = 2 * j, f1 = 2 * j + 1
    const yR = rc[j]
    if (f1 < left.length) {
      const y0 = lc[f0], y1 = lc[f1]
      lines.push(<div key={`t${j}`} className={`absolute left-0 w-1/2 border-t-2 ${LINE}`} style={{ top: `${y0}%` }} />)
      lines.push(<div key={`b${j}`} className={`absolute left-0 w-1/2 border-t-2 ${LINE}`} style={{ top: `${y1}%` }} />)
      lines.push(<div key={`v${j}`} className={`absolute left-1/2 border-l-2 ${LINE}`} style={{ top: `${Math.min(y0, y1)}%`, height: `${Math.abs(y1 - y0)}%` }} />)
      lines.push(<div key={`m${j}`} className={`absolute left-1/2 w-1/2 border-t-2 ${LINE}`} style={{ top: `${yR}%` }} />)
    } else {
      lines.push(<div key={`s${j}`} className={`absolute left-0 w-full border-t-2 ${LINE}`} style={{ top: `${yR}%` }} />)
    }
  })
  return <div className="relative w-[4vw] min-w-[40px] shrink-0">{lines}</div>
}

function BracketMatchCard({ match, label, onBump }: { match: BracketMatch; label?: string; onBump: (id: string, side: 'a' | 'b') => void }) {
  const editable = !!(match.a && match.b)
  const winSide = match.winner ? (match.a && match.winner.id === (match.a as Competitor).id ? 'a' : 'b') : null
  return (
    <div className="w-full">
      {label && <p className="text-[1.7vh] font-medium text-slate-400 mb-[0.8vh]">{label}</p>}
      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden divide-y divide-slate-800">
        <BracketSlot slot={match.a} score={match.score?.a} won={winSide === 'a'} lost={winSide === 'b'} onClick={editable ? () => onBump(match.id, 'a') : undefined} />
        <BracketSlot slot={match.b} score={match.score?.b} won={winSide === 'b'} lost={winSide === 'a'} onClick={editable ? () => onBump(match.id, 'b') : undefined} />
      </div>
    </div>
  )
}

function BracketSlot({ slot, score, won, lost, onClick }: { slot: BracketMatch['a']; score: number | null | undefined; won: boolean; lost: boolean; onClick?: () => void }) {
  if (slot === null) { // resting (no opponent this round)
    return <div className="flex items-center px-[1.6vh] py-[1.4vh] text-[2.1vh] italic text-slate-600">Rest</div>
  }
  if (slot === undefined) { // TBD
    return (
      <div className="flex items-center gap-[1.2vh] px-[1.6vh] py-[1.4vh] text-slate-500">
        <div className="h-[4.6vh] w-[4.6vh] rounded-full border-2 border-dashed border-slate-600 shrink-0" />
        <span className="flex-1 text-[2.1vh] italic truncate">To be decided</span>
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-[1.2vh] px-[1.6vh] py-[1.2vh] ${won ? 'bg-emerald-500/10' : ''}`}>
      <div className={lost ? 'opacity-60' : ''}><Avatars members={slot.members} size="h-[4.6vh] w-[4.6vh]" fallback="text-[1.9vh]" /></div>
      <span className={`flex-1 text-[2.4vh] truncate ${won ? 'font-bold text-white' : lost ? 'font-medium text-slate-400' : 'font-semibold'}`}>{competitorName(slot)}</span>
      <ScoreCell score={score} won={won} onClick={onClick} />
    </div>
  )
}

function ResultCard({ tone, title, competitor }: { tone: 'gold' | 'bronze'; title: string; competitor?: Competitor }) {
  const Icon = tone === 'gold' ? Trophy : Medal
  if (!competitor) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-600 p-[2.5vh] text-center text-slate-500">
        <Icon className="mx-auto h-[6vh] w-[6vh] opacity-40" />
        <p className="text-[1.7vh] font-semibold uppercase tracking-widest mt-[1vh]">{title}</p>
        <p className="text-[2.2vh] italic mt-[1.5vh]">To be decided</p>
      </div>
    )
  }
  const box = tone === 'gold' ? 'border-yellow-400/60 from-yellow-400/20' : 'border-amber-600/60 from-amber-600/20'
  const iconColor = tone === 'gold' ? 'text-yellow-500' : 'text-amber-600'
  const labelColor = tone === 'gold' ? 'text-yellow-400' : 'text-amber-500'
  return (
    <div className={`rounded-2xl border-2 ${box} bg-gradient-to-b to-transparent p-[2.5vh] text-center`}>
      <Icon className={`mx-auto h-[6vh] w-[6vh] ${iconColor}`} />
      <p className={`text-[1.7vh] font-semibold uppercase tracking-widest mt-[1vh] ${labelColor}`}>{title}</p>
      <div className="flex justify-center mt-[1.6vh]"><Avatars members={competitor.members} size="h-[6.5vh] w-[6.5vh]" fallback="text-[2.4vh]" /></div>
      <p className="text-[2.3vh] font-bold mt-[1.4vh]">{competitorName(competitor)}</p>
    </div>
  )
}

// ── League ────────────────────────────────────────────────────────────────────────────────────

function LeagueView({ saved, updateResults, onReset }: { saved: SavedTournament; updateResults: (fn: (r: Results) => Results) => void; onReset: () => void }) {
  const { competitors } = saved.config
  const rounds = buildLeagueRounds(competitors)
  const standings = computeStandings(competitors, saved.results)

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
                    <td className="pl-[1.6vh] pr-1 py-[1vh] text-[2vh] font-black text-slate-300">{i === 0 ? '🏆' : i + 1}</td>
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

function LeagueSlot({ competitor, score, won, lost, onClick }: { competitor: Competitor; score: number | null | undefined; won: boolean; lost: boolean; onClick: () => void }) {
  return (
    <div className={`flex items-center gap-[1.2vh] px-[1.6vh] py-[1.1vh] ${won ? 'bg-emerald-500/10' : ''}`}>
      <div className={lost ? 'opacity-60' : ''}><Avatars members={competitor.members} size="h-[4vh] w-[4vh]" fallback="text-[1.7vh]" /></div>
      <span className={`flex-1 text-[2.2vh] truncate ${won ? 'font-bold text-white' : lost ? 'font-medium text-slate-400' : 'font-semibold'}`}>{competitorName(competitor)}</span>
      <ScoreCell score={score} won={won} onClick={onClick} />
    </div>
  )
}
