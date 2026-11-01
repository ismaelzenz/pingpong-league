'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import type { WeekGame } from '@/lib/data/display'
import type { StandingRow } from '@/lib/domain/standings'

/** How long a new result stays celebrated: the banner shows and its row glows. */
const SHOW_MS = 15_000
/** The banner's slide-down exit, matching `.display-banner-out` in globals.css. */
const EXIT_MS = 600
/** At most this many results in one banner (several can land in one refresh). */
const MAX_SHOWN = 3

const FreshResults = createContext<ReadonlySet<number>>(new Set())

/** Ids of the games being celebrated right now — for panels to make those rows glow. */
export function useFreshResults() {
  return useContext(FreshResults)
}

interface Fresh {
  games: WeekGame[]
  /** Everyone's rank before these results, to say who climbed. */
  ranksBefore: Map<number, number>
}

/**
 * The office board's "someone just played" moment. The board refreshes every minute; this keeps
 * the latest results it has already seen, and when a refresh brings a new one it slides up a
 * banner ("Ilias beat Joah 2–1 · ▲1 to #8") and makes that game's row glow for a few seconds.
 *
 * The first render is only a baseline — opening the board never celebrates what's already there.
 * `demoAfterMs` (preview page only) fakes the newest result arriving after a delay, so the effect
 * can be seen without anyone playing a game.
 */
export default function ResultCelebration({ latest, leaderboard, demoAfterMs, children }: {
  latest: WeekGame[]
  leaderboard: StandingRow[]
  demoAfterMs?: number
  children: React.ReactNode
}) {
  const seen = useRef<Set<number> | null>(null)
  const ranksBefore = useRef<Map<number, number> | null>(null)
  const [fresh, setFresh] = useState<Fresh | null>(null)
  // Which banner is sliding out — tied to that banner, so a new one never inherits the exit.
  const [leavingFor, setLeavingFor] = useState<Fresh | null>(null)
  const leaving = fresh != null && leavingFor === fresh

  useEffect(() => {
    const ranks = new Map(leaderboard.map(r => [r.userId, r.rank]))
    if (seen.current == null) {
      seen.current = new Set(latest.map(g => g.id))
      ranksBefore.current = ranks
      return
    }
    const added = latest.filter(g => !seen.current!.has(g.id))
    for (const g of latest) seen.current.add(g.id)
    if (added.length > 0) setFresh({ games: added.slice(0, MAX_SHOWN), ranksBefore: ranksBefore.current! })
    ranksBefore.current = ranks
  }, [latest, leaderboard])

  // Preview only: the newest result "arrives" after a delay, ranked against where everyone stood
  // before this matchday.
  useEffect(() => {
    if (demoAfterMs == null || !latest[0]) return
    const before = new Map(leaderboard.map(r => [r.userId, r.rank + (r.movement ?? 0)]))
    const t = setTimeout(() => setFresh({ games: [latest[0]], ranksBefore: before }), demoAfterMs)
    return () => clearTimeout(t)
  }, [demoAfterMs, latest, leaderboard])

  useEffect(() => {
    if (!fresh) return
    // Slide out first, then unmount once the exit animation has played.
    const out = setTimeout(() => setLeavingFor(fresh), SHOW_MS - EXIT_MS)
    const done = setTimeout(() => setFresh(null), SHOW_MS)
    return () => { clearTimeout(out); clearTimeout(done) }
  }, [fresh])

  const freshIds = new Set(fresh?.games.map(g => g.id) ?? [])
  const rankNow = new Map(leaderboard.map(r => [r.userId, r.rank]))

  return (
    <FreshResults.Provider value={freshIds}>
      {children}
      {fresh && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[3vh] z-50 flex justify-center px-[2vh]">
          <div className={`${leaving ? 'display-banner-out' : 'display-banner-in'} rounded-2xl bg-slate-900/95 px-[2.4vh] py-[1.6vh] shadow-2xl ring-2 ring-sky-400/60 backdrop-blur`}>
            <p className="mb-[1vh] flex items-center gap-[0.8vh] text-[1.8vh] font-semibold uppercase tracking-wide text-sky-300">
              <Sparkles className="h-[2.2vh] w-[2.2vh]" /> New result{fresh.games.length > 1 ? 's' : ''}
            </p>
            <div className="space-y-[1vh]">
              {fresh.games.map(g => {
                const homeWon = (g.homeSets ?? 0) > (g.awaySets ?? 0)
                const [winner, loser] = homeWon
                  ? [{ id: g.homePlayerId, name: g.homeName, color: g.homeColor }, { name: g.awayName }]
                  : [{ id: g.awayPlayerId, name: g.awayName, color: g.awayColor }, { name: g.homeName }]
                const score = homeWon ? `${g.homeSets}–${g.awaySets}` : `${g.awaySets}–${g.homeSets}`
                const from = fresh.ranksBefore.get(winner.id)
                const to = rankNow.get(winner.id)
                const climbed = from != null && to != null && to < from ? from - to : 0
                return (
                  <div key={g.id} className="flex items-center gap-[1.4vh]">
                    <PlayerAvatar name={winner.name} avatarColor={winner.color} className="h-[4.4vh] w-[4.4vh] shrink-0" fallbackClassName="text-[1.8vh]" />
                    <p className="text-[3vh] text-slate-100">
                      <span className="font-bold">{winner.name}</span>
                      <span className="text-slate-400"> beat </span>
                      {loser.name}
                      <span className="ml-[1.2vh] font-mono font-black tabular-nums">{score}</span>
                    </p>
                    {climbed > 0 && (
                      <span className="rounded-full bg-green-500/15 px-[1.2vh] py-[0.3vh] text-[2vh] font-semibold text-green-400 tabular-nums">
                        ▲{climbed} to #{to}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </FreshResults.Provider>
  )
}
