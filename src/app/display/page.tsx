import { getLiveTournament } from '@/lib/tournament'
import { computeDisplayData, type FunWallEntry } from '@/lib/display'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import AutoRefresh from '@/components/display/AutoRefresh'
import DisplayClock from '@/components/display/DisplayClock'

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
      </div>
    )
  }

  const { leaderboard, funWall, matchdayNumber, weekGames } = await computeDisplayData(tournament.id)
  const playedThisWeek = weekGames.filter(g => g.status === 'confirmed' || g.status === 'forfeited').length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 xl:p-10">
      <AutoRefresh intervalMs={REFRESH_MS} />

      {/* Header */}
      <header className="flex items-center justify-between mb-6 xl:mb-8">
        <div className="flex items-center gap-4">
          <span className="text-4xl xl:text-5xl">🏓</span>
          <div>
            <h1 className="text-3xl xl:text-4xl font-black tracking-tight">{tournament.name}</h1>
            {matchdayNumber != null && (
              <p className="text-slate-400 text-lg xl:text-xl">Matchday {matchdayNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 text-slate-300">
          <span className="flex items-center gap-2 text-sm xl:text-base">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
            </span>
            LIVE
          </span>
          <span className="text-2xl xl:text-3xl font-semibold text-slate-200"><DisplayClock /></span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 xl:gap-8">
        {/* Leaderboard — takes the larger share */}
        <section className="lg:col-span-3">
          <div className="rounded-2xl bg-slate-900/80 ring-1 ring-white/5 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-slate-400 text-xs xl:text-sm border-b border-white/10">
                  <th className="text-left pl-4 xl:pl-6 pr-1 py-1.5 font-medium">#</th>
                  <th className="text-left pl-1 py-1.5 font-medium w-full">Player</th>
                  <th className="text-right px-2.5 py-1.5 font-medium">GP</th>
                  <th className="text-right px-2.5 py-1.5 font-medium">W</th>
                  <th className="text-right px-2.5 py-1.5 font-medium">L</th>
                  <th className="text-right px-2.5 py-1.5 font-medium">SW</th>
                  <th className="text-right px-2.5 py-1.5 font-medium">SL</th>
                  <th className="text-right px-4 xl:px-6 py-1.5 font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.userId} className="border-b border-white/5 last:border-0">
                    <td className="pl-4 xl:pl-6 pr-1 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 text-center shrink-0 text-base xl:text-lg font-black text-slate-300">
                          {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
                        </span>
                        <Movement value={row.movement} />
                      </div>
                    </td>
                    <td className="pl-1 py-1.5">
                      <div className="flex items-center gap-2.5">
                        <PlayerAvatar name={row.name} avatarColor={row.avatarColor} className="h-7 w-7 xl:h-8 xl:w-8 shrink-0" fallbackClassName="text-xs" />
                        <span className="font-semibold text-base xl:text-lg truncate">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-slate-400 text-sm xl:text-base tabular-nums">{row.gamesPlayed}</td>
                    <td className="px-2.5 py-1.5 text-right text-green-400 font-semibold text-sm xl:text-base tabular-nums">{row.victories}</td>
                    <td className="px-2.5 py-1.5 text-right text-red-400 font-semibold text-sm xl:text-base tabular-nums">{row.losses}</td>
                    <td className="px-2.5 py-1.5 text-right text-sm xl:text-base tabular-nums">{row.setsWon}</td>
                    <td className="px-2.5 py-1.5 text-right text-sm xl:text-base tabular-nums">{row.setsLost}</td>
                    <td className="px-4 xl:px-6 py-1.5 text-right font-black text-lg xl:text-xl tabular-nums">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right column: this week + fun wall. Stretches to the leaderboard's height. */}
        <div className="lg:col-span-2 flex flex-col gap-6 xl:gap-8 h-full">
          <section className="flex-1 flex flex-col rounded-2xl bg-slate-900/80 ring-1 ring-white/5 p-4 xl:p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xl xl:text-2xl font-bold">This week</h2>
              <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300 text-sm xl:text-base font-semibold tabular-nums">
                {playedThisWeek}/{weekGames.length} played
              </span>
            </div>
            {weekGames.length === 0 ? (
              <p className="text-slate-500 flex-1 flex items-center justify-center">No games scheduled this week.</p>
            ) : (
              <div className="flex-1 flex flex-col gap-1.5">
                {weekGames.map((g) => {
                  const confirmed = g.status === 'confirmed' || g.status === 'forfeited'
                  const awaiting = g.status === 'result_entered'
                  const hasScore = g.homeSets != null && g.awaySets != null
                  // Only a confirmed result is final, so only then do we bold the winner.
                  const homeWon = confirmed && (g.homeSets ?? 0) > (g.awaySets ?? 0)
                  const awayWon = confirmed && (g.awaySets ?? 0) > (g.homeSets ?? 0)
                  return (
                    <div
                      key={g.id}
                      className={`flex-1 min-h-[2.25rem] flex items-center gap-3 rounded-xl px-3 xl:px-4 ring-1 ${confirmed ? 'bg-slate-800/60 ring-white/10' : awaiting ? 'bg-amber-500/5 ring-amber-500/25' : 'bg-slate-800/25 ring-white/5'}`}
                    >
                      <div className="flex-1 flex items-center justify-end gap-2.5 min-w-0">
                        <span className={`truncate text-right text-base xl:text-lg ${homeWon ? 'font-bold text-white' : 'text-slate-300'}`}>{g.homeName}</span>
                        <PlayerAvatar name={g.homeName} avatarColor={g.homeColor} className="h-8 w-8 xl:h-9 xl:w-9 shrink-0" fallbackClassName="text-xs" />
                      </div>
                      <div className="shrink-0 w-20 flex flex-col items-center justify-center leading-tight">
                        {confirmed ? (
                          <span className="font-mono font-black text-white text-lg xl:text-2xl tabular-nums">{g.homeSets}–{g.awaySets}</span>
                        ) : awaiting && hasScore ? (
                          <>
                            <span className="font-mono font-black text-amber-400 text-lg xl:text-2xl tabular-nums">{g.homeSets}–{g.awaySets}</span>
                            <span className="text-[10px] xl:text-xs font-semibold uppercase tracking-wide text-amber-400/80">to confirm</span>
                          </>
                        ) : (
                          <span className="rounded-full bg-slate-700/60 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-slate-400">vs</span>
                        )}
                      </div>
                      <div className="flex-1 flex items-center gap-2.5 min-w-0">
                        <PlayerAvatar name={g.awayName} avatarColor={g.awayColor} className="h-8 w-8 xl:h-9 xl:w-9 shrink-0" fallbackClassName="text-xs" />
                        <span className={`truncate text-base xl:text-lg ${awayWon ? 'font-bold text-white' : 'text-slate-300'}`}>{g.awayName}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xl xl:text-2xl font-bold mb-3">🏅 Records</h2>
            <div className="grid grid-cols-2 gap-3 xl:gap-4">
              <FunTile emoji="🔥" title="On fire" entry={funWall.onFire} accent="from-orange-500/20 to-red-500/10 ring-orange-500/20" />
              <FunTile emoji="🧨" title="The Destroyer" entry={funWall.destroyer} accent="from-purple-500/20 to-fuchsia-500/10 ring-purple-500/20" />
              <FunTile emoji="👑" title="Best win rate" entry={funWall.bestWinRate} accent="from-yellow-500/20 to-amber-500/10 ring-yellow-500/20" />
              <FunTile emoji="🎯" title="Clutch" entry={funWall.clutch} accent="from-sky-500/20 to-cyan-500/10 ring-sky-500/20" />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Movement({ value }: { value: number | null }) {
  return (
    <span className="w-8 shrink-0 text-center text-sm xl:text-base font-semibold tabular-nums">
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

function FunTile({ emoji, title, entry, accent }: { emoji: string; title: string; entry: FunWallEntry | null; accent: string }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${accent} ring-1 p-4 xl:p-5 flex flex-col gap-2`}>
      <div className="flex items-center gap-2 text-slate-300 text-sm xl:text-base font-medium">
        <span className="text-xl xl:text-2xl">{emoji}</span>
        {title}
      </div>
      {entry ? (
        <div className="flex items-center gap-3">
          <PlayerAvatar name={entry.name} avatarColor={entry.avatarColor} className="h-10 w-10 xl:h-12 xl:w-12" fallbackClassName="text-base" />
          <div className="min-w-0">
            <p className="font-bold text-lg xl:text-xl truncate">{entry.name}</p>
            <p className="text-slate-300 text-sm xl:text-base truncate">{entry.value}</p>
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-sm xl:text-base">No data yet</p>
      )}
    </div>
  )
}
