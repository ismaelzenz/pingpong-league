import type { ReactNode } from 'react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import AutoRefresh from '@/components/display/AutoRefresh'
import DisplayClock from '@/components/display/DisplayClock'
import type { LeaderRow, WeekGame, FunWallEntry, ByePlayer, RecordEntry, RecordKey } from '@/lib/display'
import { Flame, Bomb, Crown, Target, Medal, CalendarClock, Coffee, Shield, Zap, HeartPulse } from 'lucide-react'
import CatchUpTicker from '@/components/display/CatchUpTicker'
import { isFinished } from '@/lib/gameStatus'

/**
 * Shared building blocks for the office-TV board, composed differently by each layout variant
 * (ribbon / hero / columns / rotating). Everything is sized in `vh` so it scales to the real
 * viewport height on any screen, and icons are lucide SVGs (smart-TV browsers lack emoji fonts).
 */

/** Root + header. Children fill the remaining height. */
export function BoardShell({
  tournamentName,
  matchdayNumber,
  refreshMs,
  children,
}: {
  tournamentName: string
  matchdayNumber: number | null
  refreshMs?: number
  children: ReactNode
}) {
  return (
    <div className="h-screen bg-slate-950 text-slate-100 p-[2vh] flex flex-col overflow-hidden">
      {refreshMs != null && <AutoRefresh intervalMs={refreshMs} />}
      <header className="flex items-center justify-between mb-[1.6vh] shrink-0">
        <div>
          <h1 className="text-[3.4vh] leading-none font-black tracking-tight">{tournamentName}</h1>
          {matchdayNumber != null && (
            <p className="text-slate-400 text-[1.8vh] mt-[0.5vh]">Matchday {matchdayNumber}</p>
          )}
        </div>
        <div className="flex items-center gap-[2.5vh] text-slate-300">
          <span className="flex items-center gap-[0.8vh] text-[1.8vh] font-semibold tracking-wide">
            <span className="relative flex h-[1.2vh] w-[1.2vh]">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-[1.2vh] w-[1.2vh] rounded-full bg-green-500" />
            </span>
            LIVE
          </span>
          <span className="text-[3vh] font-semibold text-slate-200 tabular-nums"><DisplayClock /></span>
        </div>
      </header>
      {children}
    </div>
  )
}

/** Full standings table (all columns). Fills its parent's height; all rows stretch to fit. */
export function StandingsTable({ rows }: { rows: LeaderRow[] }) {
  return (
    <div className="rounded-2xl bg-slate-900/80 ring-1 ring-white/5 overflow-hidden h-full">
      <table className="w-full h-full">
        <thead>
          <tr className="text-slate-400 text-[1.4vh] border-b border-white/10">
            <th className="text-left pl-[1.6vh] pr-1 py-[0.4vh] font-medium">#</th>
            <th className="text-left pl-1 py-[0.4vh] font-medium w-full">Player</th>
            <th className="text-right px-[1.2vh] py-[0.4vh] font-medium">GP</th>
            <th className="text-right px-[1.2vh] py-[0.4vh] font-medium">W</th>
            <th className="text-right px-[1.2vh] py-[0.4vh] font-medium">L</th>
            <th className="text-right px-[1.2vh] py-[0.4vh] font-medium">SW</th>
            <th className="text-right px-[1.2vh] py-[0.4vh] font-medium">SL</th>
            <th className="text-right px-[1.6vh] py-[0.4vh] font-bold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const medalColor = ['text-yellow-400', 'text-slate-300', 'text-amber-600'][row.rank - 1]
            return (
              <tr key={row.userId} className="border-b border-white/5 last:border-0">
                <td className="pl-[1.6vh] pr-1 py-[0.15vh]">
                  <div className="flex items-center gap-[0.8vh]">
                    <span className="w-[2.8vh] flex justify-center shrink-0">
                      {row.rank <= 3
                        ? <Medal className={`h-[2.2vh] w-[2.2vh] ${medalColor}`} strokeWidth={2.2} />
                        : <span className="text-[2vh] font-black text-slate-300 tabular-nums">{row.rank}</span>}
                    </span>
                    <Movement value={row.movement} />
                  </div>
                </td>
                <td className="pl-1 py-[0.15vh]">
                  <div className="flex items-center gap-[1vh] min-w-0">
                    <PlayerAvatar name={row.name} avatarColor={row.avatarColor} className="h-[2.8vh] w-[2.8vh] shrink-0" fallbackClassName="text-[1.3vh]" />
                    <span className="font-semibold text-[2.1vh] truncate">{row.name}</span>
                  </div>
                </td>
                <td className="px-[1.2vh] py-[0.15vh] text-right text-slate-400 text-[1.9vh] tabular-nums">{row.gamesPlayed}</td>
                <td className="px-[1.2vh] py-[0.15vh] text-right text-green-400 font-semibold text-[1.9vh] tabular-nums">{row.victories}</td>
                <td className="px-[1.2vh] py-[0.15vh] text-right text-red-400 font-semibold text-[1.9vh] tabular-nums">{row.losses}</td>
                <td className="px-[1.2vh] py-[0.15vh] text-right text-[1.9vh] tabular-nums">{row.setsWon}</td>
                <td className="px-[1.2vh] py-[0.15vh] text-right text-[1.9vh] tabular-nums">{row.setsLost}</td>
                <td className="px-[1.6vh] py-[0.15vh] text-right font-black text-[2.4vh] tabular-nums">{row.points}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * This week's fixtures. Fills its parent's height; rows stretch. Handles postponed games.
 * `summary` overrides the header count (used when only a page of games is passed in for paging).
 */
export function ThisWeekPanel({ weekGames, summary, byePlayers, catchUpGames }: { weekGames: WeekGame[]; summary?: { played: number; total: number }; byePlayers?: ByePlayer[]; catchUpGames?: WeekGame[] }) {
  const played = summary ? summary.played : weekGames.filter(g => isFinished(g.status)).length
  const total = summary ? summary.total : weekGames.length
  return (
    <div className="h-full flex flex-col rounded-2xl bg-slate-900/80 ring-1 ring-white/5 p-[1.6vh]">
      <div className="flex items-baseline justify-between mb-[1.2vh] shrink-0">
        <h2 className="text-[2.5vh] font-bold">This week</h2>
        <span className="rounded-full bg-slate-800 px-[1.4vh] py-[0.4vh] text-slate-300 text-[1.8vh] font-semibold tabular-nums">
          {played}/{total} played
        </span>
      </div>
      {weekGames.length === 0 ? (
        <p className="text-slate-500 flex-1 flex items-center justify-center text-[2.2vh]">No games scheduled this week.</p>
      ) : (
        <div className="flex-1 flex flex-col gap-[0.8vh] min-h-0">
          {weekGames.map((g) => {
            const confirmed = isFinished(g.status)
            const postponed = g.status === 'postponed'
            // Only a confirmed result is final, so only then do we bold the winner.
            const homeWon = confirmed && (g.homeSets ?? 0) > (g.awaySets ?? 0)
            const awayWon = confirmed && (g.awaySets ?? 0) > (g.homeSets ?? 0)
            return (
              <div
                key={g.id}
                className={`flex-1 min-h-0 overflow-hidden flex items-center gap-[1.4vh] rounded-xl px-[2vh] ring-1 ${confirmed ? 'bg-slate-800/60 ring-white/10' : postponed ? 'bg-sky-500/5 ring-sky-500/25' : 'bg-slate-800/25 ring-white/5'}`}
              >
                {/* Home: avatar anchored to the far left, name reads inward toward the score */}
                <div className="flex-1 flex items-center gap-[1.6vh] min-w-0">
                  <PlayerAvatar name={g.homeName} avatarColor={g.homeColor} className="h-[4.6vh] w-[4.6vh] shrink-0" fallbackClassName="text-[2vh]" />
                  <span className={`truncate text-[3vh] ${homeWon ? 'font-bold text-white' : 'text-slate-300'}`}>{g.homeName}</span>
                </div>
                <div className="shrink-0 w-[12vh] flex flex-col items-center justify-center leading-none">
                  {confirmed ? (
                    <span className="font-mono font-black text-white text-[3.9vh] tabular-nums">{g.homeSets}–{g.awaySets}</span>
                  ) : postponed ? (
                    <div className="flex flex-col items-center gap-[0.3vh] text-sky-300/90">
                      <CalendarClock className="h-[2.4vh] w-[2.4vh]" />
                      <span className="text-[1.4vh] font-semibold uppercase tracking-wide">postponed</span>
                    </div>
                  ) : (
                    <span className="rounded-full bg-slate-700/60 px-[1.4vh] py-[0.4vh] text-[2.1vh] font-bold uppercase tracking-wide text-slate-400">vs</span>
                  )}
                </div>
                {/* Away: name reads inward toward the score, avatar anchored to the far right */}
                <div className="flex-1 flex items-center justify-end gap-[1.6vh] min-w-0">
                  <span className={`truncate text-right text-[3vh] ${awayWon ? 'font-bold text-white' : 'text-slate-300'}`}>{g.awayName}</span>
                  <PlayerAvatar name={g.awayName} avatarColor={g.awayColor} className="h-[4.6vh] w-[4.6vh] shrink-0" fallbackClassName="text-[2vh]" />
                </div>
              </div>
            )
          })}
        </div>
      )}
      {catchUpGames && catchUpGames.length > 0 && <CatchUpTicker games={catchUpGames} />}
      {byePlayers && byePlayers.length > 0 && (
        <div className="shrink-0 mt-[0.8vh] flex items-center gap-[1.2vh] rounded-xl bg-slate-800/40 ring-1 ring-white/5 px-[1.6vh] py-[0.8vh]">
          <Coffee className="h-[2.4vh] w-[2.4vh] text-slate-400 shrink-0" />
          <div className="flex items-center gap-[1.6vh] min-w-0 flex-1">
            {byePlayers.map(b => (
              <span key={b.userId} className="flex items-center gap-[0.8vh] min-w-0">
                <PlayerAvatar name={b.name} avatarColor={b.avatarColor} className="h-[3vh] w-[3vh] shrink-0" fallbackClassName="text-[1.4vh]" />
                <span className="text-[2.1vh] text-slate-200 truncate">{b.name}</span>
              </span>
            ))}
          </div>
          <span className="text-[1.6vh] text-slate-500 shrink-0">rests this week</span>
        </div>
      )}
    </div>
  )
}

const RECORD_META: Record<RecordKey, { title: string; icon: ReactNode; accent: string }> = {
  onFire: { title: 'On fire', icon: <Flame className="h-[2.6vh] w-[2.6vh] text-orange-400" />, accent: 'from-orange-500/20 to-red-500/10 ring-orange-500/20' },
  destroyer: { title: 'The Destroyer', icon: <Bomb className="h-[2.6vh] w-[2.6vh] text-purple-400" />, accent: 'from-purple-500/20 to-fuchsia-500/10 ring-purple-500/20' },
  clutch: { title: 'Clutch', icon: <Target className="h-[2.6vh] w-[2.6vh] text-sky-400" />, accent: 'from-sky-500/20 to-cyan-500/10 ring-sky-500/20' },
  bestWinRate: { title: 'Best win rate', icon: <Crown className="h-[2.6vh] w-[2.6vh] text-yellow-400" />, accent: 'from-yellow-500/20 to-amber-500/10 ring-yellow-500/20' },
  theWall: { title: 'The Wall', icon: <Shield className="h-[2.6vh] w-[2.6vh] text-emerald-400" />, accent: 'from-emerald-500/20 to-teal-500/10 ring-emerald-500/20' },
  setMachine: { title: 'Set machine', icon: <Zap className="h-[2.6vh] w-[2.6vh] text-pink-400" />, accent: 'from-pink-500/20 to-rose-500/10 ring-pink-500/20' },
  nailBiter: { title: 'Nail-biter', icon: <HeartPulse className="h-[2.6vh] w-[2.6vh] text-red-400" />, accent: 'from-red-500/20 to-rose-500/10 ring-red-500/20' },
}

// Text shown on a record tile when nobody has earned it yet (e.g. first matchday).
const RECORD_PLACEHOLDER = 'Waiting for a hero'

// Canonical order shown on the board. Every category always appears; ones with no holder yet
// (e.g. first matchday, before anyone qualifies) render an "up for grabs" placeholder.
const RECORD_KEYS: RecordKey[] = ['onFire', 'destroyer', 'clutch', 'bestWinRate', 'theWall', 'setMachine', 'nailBiter']

function RecordTileByKey({ recordKey, entry }: { recordKey: RecordKey; entry?: RecordEntry }) {
  const meta = RECORD_META[recordKey]
  return <FunTile icon={meta.icon} title={meta.title} entry={entry ?? null} accent={meta.accent} />
}

/** All record categories in order; `limit` caps how many show (for the small grid layouts). */
export function RecordTiles({ records, limit }: { records: RecordEntry[]; limit?: number }) {
  const byKey = new Map(records.map(r => [r.key, r]))
  const keys = limit != null ? RECORD_KEYS.slice(0, limit) : RECORD_KEYS
  return <>{keys.map(k => <RecordTileByKey key={k} recordKey={k} entry={byKey.get(k)} />)}</>
}

/** Continuous horizontal marquee of all record tiles for the bottom of the board. */
export function RecordsTicker({ records, secondsPerItem = 10 }: { records: RecordEntry[]; secondsPerItem?: number }) {
  const byKey = new Map(records.map(r => [r.key, r]))
  const tiles = RECORD_KEYS.map(k => ({ key: k, entry: byKey.get(k) }))
  const loop = [...tiles, ...tiles] // two identical copies → seamless -50% loop
  const duration = Math.max(24, tiles.length * secondsPerItem)
  return (
    <div className="overflow-hidden">
      <div className="flex w-max h-[12vh] display-marquee" style={{ animationDuration: `${duration}s` }}>
        {loop.map((t, i) => (
          <div key={`${t.key}-${i}`} className="w-[34vh] shrink-0 mr-[1.6vh] h-full">
            <RecordTileByKey recordKey={t.key} entry={t.entry} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Movement({ value }: { value: number | null }) {
  return (
    <span className="w-[3vh] shrink-0 text-center text-[1.6vh] font-semibold tabular-nums">
      {value == null
        ? null
        : value > 0
          ? <span className="text-green-400">▲{value}</span>
          : value < 0
            ? <span className="text-red-400">▼{Math.abs(value)}</span>
            : <span className="text-slate-600">–</span>}
    </span>
  )
}

function FunTile({ icon, title, entry, accent }: { icon: ReactNode; title: string; entry: FunWallEntry | null; accent: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${accent} ring-1 p-[1.2vh] h-full flex flex-col justify-center gap-[0.8vh]`}>
      <div className="flex items-center gap-[1vh] text-slate-300 text-[1.8vh] font-medium">
        <span className="shrink-0">{icon}</span>
        {title}
      </div>
      {entry ? (
        <div className="flex items-center gap-[1.2vh]">
          <PlayerAvatar name={entry.name} avatarColor={entry.avatarColor} className="h-[3.6vh] w-[3.6vh] shrink-0" fallbackClassName="text-[1.7vh]" />
          <div className="min-w-0">
            <p className="font-bold text-[2.1vh] truncate">{entry.name}</p>
            <p className="text-slate-300 text-[1.6vh] truncate">{entry.value}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-[1.2vh] text-slate-500">
          <div className="h-[3.6vh] w-[3.6vh] rounded-full bg-slate-700/40 ring-1 ring-white/5 shrink-0" />
          <span className="text-[1.8vh] italic">{RECORD_PLACEHOLDER}</span>
        </div>
      )}
    </div>
  )
}
