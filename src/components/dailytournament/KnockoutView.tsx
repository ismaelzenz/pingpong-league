'use client'

import { Trophy, Medal } from 'lucide-react'
import { type Person, type Competitor, type Results, type SavedTournament, type BracketMatch, competitorName, cycleScore, buildBracket, EMPTY_SCORE } from './logic'
import { Header, Avatars, ScoreCell } from './parts'

const LINE = 'border-slate-600'

// ── Knockout ────────────────────────────────────────────────────────────────────────────────────

export default function KnockoutView({ saved, updateResults, onReset }: { saved: SavedTournament; updateResults: (fn: (r: Results) => Results) => void; onReset: () => void }) {
  const { competitors } = saved.config
  const bracket = buildBracket(competitors, saved.results)
  const showThird = saved.config.thirdPlace !== false && !!bracket.thirdPlace && competitors.length >= 4

  const bump = (matchId: string, side: 'a' | 'b') => updateResults(prev => {
    const cur = prev[matchId] ?? EMPTY_SCORE
    const next: Results = { ...prev, [matchId]: { ...cur, [side]: cycleScore(cur[side]) } }
    // Editing a side match invalidates later rounds on that side, plus the centre final and the
    // 3rd-place game (both depend on who comes through). The final / 3rd-place games themselves
    // have nothing downstream, so tapping them clears nothing.
    const m = /^([LR])r(\d+)-/.exec(matchId)
    if (m) {
      const sidePrefix = m[1]
      const round = parseInt(m[2])
      for (const key of Object.keys(next)) {
        if (key === matchId) continue
        const km = /^([LR])r(\d+)-/.exec(key)
        if (km && km[1] === sidePrefix && parseInt(km[2]) > round) { delete next[key]; continue }
        if (key === 'final' || key === 'third') delete next[key]
      }
    }
    return next
  })

  // The bracket is built as two balanced halves that meet in a centre final (see buildBracket),
  // so it draws symmetrically: `left` flows rightward, `right` flows leftward, final in the middle.
  const { left, right, final: finalMatch } = bracket
  // The beaten finalist — styled as the runner-up so the podium (1st / 2nd / 3rd) is complete.
  const runnerUp: Competitor | undefined = finalMatch?.winner && finalMatch.a && finalMatch.b
    ? (finalMatch.winner.id === (finalMatch.a as Competitor).id ? (finalMatch.b as Competitor) : (finalMatch.a as Competitor))
    : undefined
  const tallest = Math.max(left[0]?.length ?? 1, right[0]?.length ?? 1, 1)
  const vBudget = showThird ? 70 : 88 // vh available for the bracket rows
  const scale = Math.max(0.5, Math.min(1, vBudget / (tallest * 13)))

  return (
    <div
      className="h-screen bg-slate-950 text-slate-100 p-[3vh] flex flex-col overflow-hidden"
      style={{ '--s': scale } as React.CSSProperties}
    >
      <Header name={saved.config.name} onReset={onReset} />
      <div className="flex-1 min-h-0 flex items-stretch">
        {/* Left half — outer round on the far left, flowing inward to the centre. The first
            round (real player names) gets a touch more width so names aren't clipped. */}
        {left.map((round, rr) => (
          <div key={`l${rr}`} className="flex items-stretch min-w-0" style={{ flexGrow: rr === 0 ? 4 : 3, flexBasis: 0 }}>
            <RoundColumn round={round} onBump={bump} />
            {rr < left.length - 1 ? <BracketConnector left={round} right={left[rr + 1]} /> : <SimpleConnector />}
          </div>
        ))}

        {/* Centre — the final sits at the vertical middle so the two semifinal lines meet it; the
            champion is pinned directly above it (absolute, so it never shifts the final off-centre
            and never collides with it, whatever the height). */}
        <div className="flex flex-col justify-center min-w-0 px-[0.4vw]" style={{ flexGrow: 3.4, flexBasis: 0 }}>
          <div className="relative">
            <div className="absolute bottom-full inset-x-0 mb-[2.5vh]">
              <ResultCard tone="gold" title="Champion" competitor={bracket.champion} />
            </div>
            {finalMatch && <BracketMatchCard match={finalMatch} label={left.length ? 'Final' : undefined} onBump={bump} />}
            {runnerUp && (
              <div className="absolute top-full inset-x-0 mt-[1.8vh] flex justify-center">
                <PodiumTag members={runnerUp.members} name={competitorName(runnerUp)} title="2nd place"
                  className="border-slate-400/40 bg-slate-400/5" titleClass="text-slate-300" />
              </div>
            )}
          </div>
        </div>

        {/* Right half — mirror of the left: inner round nearest the centre, flowing outward. */}
        {right.length > 0 && <SimpleConnector />}
        {right.map((_, i) => {
          const rr = right.length - 1 - i // render centre-out: semifinal first, outer round last
          const round = right[rr]
          return (
            <div key={`r${rr}`} className="flex items-stretch min-w-0" style={{ flexGrow: rr === 0 ? 4 : 3, flexBasis: 0 }}>
              <RoundColumn round={round} onBump={bump} />
              {rr > 0 && <BracketConnector left={right[rr - 1]} right={round} mirror />}
            </div>
          )
        })}
      </div>

      {/* 3rd-place playoff — kept small and muted so it never competes with the main bracket. */}
      {showThird && bracket.thirdPlace && (
        <div className="shrink-0 h-[15vh] mt-[1.5vh] pt-[1.5vh] border-t border-slate-800/70 flex items-center gap-[1.6vw] text-slate-400">
          <h2 className="shrink-0 flex items-center gap-[0.8vh] text-[1.8vh] font-semibold">
            <Medal className="h-[2.2vh] w-[2.2vh] text-amber-700" /> Playoff for 3rd
          </h2>
          <div className="w-[20vw] min-w-[190px] shrink-0"><BracketMatchCard match={bracket.thirdPlace} onBump={bump} /></div>
          <div className="relative w-[4vw] min-w-[28px] self-stretch"><div className={`absolute left-0 top-1/2 w-full border-t-2 ${LINE}`} /></div>
          {bracket.bronze ? (
            <PodiumTag members={bracket.bronze.members} name={competitorName(bracket.bronze)} title="3rd place"
              className="shrink-0 border-amber-700/30 bg-amber-700/5" titleClass="text-amber-600/80" />
          ) : (
            <div className="shrink-0 inline-flex items-center gap-[1.2vh] rounded-xl border border-amber-700/30 bg-amber-700/5 px-[1.6vh] py-[1.1vh]">
              <Medal className="h-[3.4vh] w-[3.4vh] text-amber-700/50 shrink-0" />
              <div>
                <p className="text-[1.3vh] font-semibold uppercase tracking-wider text-amber-700/60">3rd place</p>
                <p className="text-[1.8vh] italic text-slate-500">To be decided</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** One vertical column of matches in a round, each row weighted so rounds line up. The vertical
 *  padding keeps neighbouring pairing boxes from touching. */
function RoundColumn({ round, onBump }: { round: BracketMatch[]; onBump: (id: string, side: 'a' | 'b') => void }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {round.map(m => (
        <div key={m.id} style={{ flexGrow: m.weight ?? 1, flexBasis: 0 }} className="flex items-center px-[0.4vw] py-[calc(var(--s)*0.8vh)] min-h-0 min-w-0">
          <BracketMatchCard match={m} onBump={onBump} />
        </div>
      ))}
    </div>
  )
}

function SimpleConnector() {
  return <div className="relative w-[2.6vw] min-w-[22px] shrink-0"><div className={`absolute left-0 top-1/2 w-full border-t-2 ${LINE}`} /></div>
}

/** Connects a round's matches to the next, using each match's alignment weight so lines meet the
 *  vertically-centered cards — works for balanced and greedy (bye-carrying) brackets alike. */
function BracketConnector({ left, right, mirror }: { left: BracketMatch[]; right: BracketMatch[]; mirror?: boolean }) {
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
      // Overshoot the vertical line 1px at each end: its % height rounds independently from the
      // horizontal lines' % positions, which otherwise leaves a ~1px gap at one corner (the bottom).
      lines.push(<div key={`v${j}`} className={`absolute left-1/2 border-l-2 ${LINE}`} style={{ top: `calc(${Math.min(y0, y1)}% - 1px)`, height: `calc(${Math.abs(y1 - y0)}% + 2px)` }} />)
      lines.push(<div key={`m${j}`} className={`absolute left-1/2 w-1/2 border-t-2 ${LINE}`} style={{ top: `${yR}%` }} />)
    } else {
      lines.push(<div key={`s${j}`} className={`absolute left-0 w-full border-t-2 ${LINE}`} style={{ top: `${yR}%` }} />)
    }
  })
  return <div className={`relative w-[2.6vw] min-w-[22px] shrink-0 ${mirror ? '-scale-x-100' : ''}`}>{lines}</div>
}

function BracketMatchCard({ match, label, onBump }: { match: BracketMatch; label?: string; onBump: (id: string, side: 'a' | 'b') => void }) {
  const editable = !!(match.a && match.b)
  const winSide = match.winner ? (match.a && match.winner.id === (match.a as Competitor).id ? 'a' : 'b') : null
  return (
    <div className="w-full min-w-0">
      {label && <p className="text-[calc(var(--s)*1.7vh)] font-medium text-slate-400 mb-[calc(var(--s)*0.8vh)]">{label}</p>}
      <div className="rounded-xl border border-slate-700 bg-slate-900 overflow-hidden divide-y divide-slate-800">
        <BracketSlot slot={match.a} score={match.score?.a} won={winSide === 'a'} lost={winSide === 'b'} onClick={editable ? () => onBump(match.id, 'a') : undefined} />
        <BracketSlot slot={match.b} score={match.score?.b} won={winSide === 'b'} lost={winSide === 'a'} onClick={editable ? () => onBump(match.id, 'b') : undefined} />
      </div>
    </div>
  )
}

function BracketSlot({ slot, score, won, lost, onClick }: { slot: BracketMatch['a']; score: number | null | undefined; won: boolean; lost: boolean; onClick?: () => void }) {
  if (slot === null) { // resting (no opponent this round)
    return <div className="flex items-center px-[calc(var(--s)*1.2vh)] py-[calc(var(--s)*1vh)] text-[calc(var(--s)*2vh)] italic text-slate-600">Rest</div>
  }
  if (slot === undefined) { // TBD
    return (
      <div className="flex items-center gap-[calc(var(--s)*0.9vh)] px-[calc(var(--s)*1.2vh)] py-[calc(var(--s)*1vh)] text-slate-500 min-w-0">
        <div className="h-[calc(var(--s)*3.4vh)] w-[calc(var(--s)*3.4vh)] rounded-full border-2 border-dashed border-slate-600 shrink-0" />
        <span className="flex-1 text-[calc(var(--s)*2vh)] italic truncate">TBD</span>
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-[calc(var(--s)*0.9vh)] px-[calc(var(--s)*1.2vh)] py-[calc(var(--s)*1vh)] min-w-0 ${won ? 'bg-emerald-500/10' : ''}`}>
      <div className={lost ? 'opacity-60' : ''}><Avatars members={slot.members} size="h-[calc(var(--s)*3.4vh)] w-[calc(var(--s)*3.4vh)]" fallback="text-[calc(var(--s)*1.5vh)]" /></div>
      <span className={`flex-1 text-[calc(var(--s)*2.1vh)] truncate ${won ? 'font-bold text-white' : lost ? 'font-medium text-slate-400' : 'font-semibold'}`}>{competitorName(slot)}</span>
      <ScoreCell score={score} won={won} onClick={onClick} />
    </div>
  )
}

// The champion trophy card — the largest of the podium, to crown the bracket.
function ResultCard({ tone, title, competitor }: { tone: 'gold' | 'bronze'; title: string; competitor?: Competitor }) {
  const Icon = tone === 'gold' ? Trophy : Medal
  if (!competitor) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-600 p-[2.4vh] text-center text-slate-500">
        <Icon className="mx-auto h-[6vh] w-[6vh] opacity-40" />
        <p className="text-[1.7vh] font-semibold uppercase tracking-widest mt-[1vh]">{title}</p>
        <p className="text-[2.1vh] italic mt-[1.4vh]">To be decided</p>
      </div>
    )
  }
  const box = tone === 'gold' ? 'border-yellow-400/60 from-yellow-400/20' : 'border-amber-600/60 from-amber-600/20'
  const iconColor = tone === 'gold' ? 'text-yellow-500' : 'text-amber-600'
  const labelColor = tone === 'gold' ? 'text-yellow-400' : 'text-amber-500'
  return (
    <div className={`rounded-2xl border-2 ${box} bg-gradient-to-b to-transparent p-[2.4vh] text-center shadow-lg shadow-yellow-500/10`}>
      <Icon className={`mx-auto h-[6vh] w-[6vh] ${iconColor}`} />
      <p className={`text-[1.7vh] font-semibold uppercase tracking-widest mt-[1vh] ${labelColor}`}>{title}</p>
      <div className="flex justify-center mt-[1.6vh]"><Avatars members={competitor.members} size="h-[7vh] w-[7vh]" fallback="text-[2.7vh]" /></div>
      <p className="text-[2.5vh] font-bold mt-[1.3vh]">{competitorName(competitor)}</p>
    </div>
  )
}

/** Compact horizontal medal chip for the runner-up (silver) and 3rd place (bronze). */
function PodiumTag({ members, name, title, className, titleClass }: { members: Person[]; name: string; title: string; className: string; titleClass: string }) {
  return (
    <div className={`inline-flex items-center gap-[1.2vh] rounded-xl border px-[1.6vh] py-[1.1vh] ${className}`}>
      <Avatars members={members} size="h-[4vh] w-[4vh]" fallback="text-[1.6vh]" />
      <div className="min-w-0 text-left">
        <p className={`text-[1.3vh] font-semibold uppercase tracking-wider ${titleClass}`}>{title}</p>
        <p className="text-[2vh] font-bold text-slate-200 truncate">{name}</p>
      </div>
    </div>
  )
}
