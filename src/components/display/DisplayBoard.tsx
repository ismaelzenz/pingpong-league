import PlayerAvatar from '@/components/player/PlayerAvatar'
import AutoRefresh from '@/components/display/AutoRefresh'
import DisplayClock from '@/components/display/DisplayClock'
import type { DisplayData, FunWallEntry } from '@/lib/display'

/**
 * The office-TV wall board, rendered from a ready-made {@link DisplayData}. The live page
 * (/display) passes real data + a refresh interval; the preview page passes hardcoded data.
 *
 * Sizing tiers: base/`xl:` target laptops & 1080p; `min-[2560px]:` is the 4K-TV tier (much larger
 * type, avatars and padding). The whole board is a full-height flex column so the leaderboard
 * stretches to fill the screen — minimal empty space on a big display.
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
  const { leaderboard, funWall, matchdayNumber, weekGames } = data
  const playedThisWeek = weekGames.filter(g => g.status === 'confirmed' || g.status === 'forfeited').length

  return (
    <div className="h-screen bg-slate-950 text-slate-100 p-6 xl:p-10 min-[2560px]:p-16 flex flex-col overflow-hidden">
      {refreshMs != null && <AutoRefresh intervalMs={refreshMs} />}

      {/* Header */}
      <header className="flex items-center justify-between mb-6 xl:mb-8 min-[2560px]:mb-12 shrink-0">
        <div className="flex items-center gap-4 min-[2560px]:gap-8">
          <span className="text-4xl xl:text-5xl min-[2560px]:text-8xl">🏓</span>
          <div>
            <h1 className="text-3xl xl:text-4xl min-[2560px]:text-7xl font-black tracking-tight">{tournamentName}</h1>
            {matchdayNumber != null && (
              <p className="text-slate-400 text-lg xl:text-xl min-[2560px]:text-4xl">Matchday {matchdayNumber}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6 min-[2560px]:gap-12 text-slate-300">
          <span className="flex items-center gap-2 min-[2560px]:gap-4 text-sm xl:text-base min-[2560px]:text-3xl">
            <span className="relative flex h-3 w-3 min-[2560px]:h-5 min-[2560px]:w-5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-3 w-3 min-[2560px]:h-5 min-[2560px]:w-5 rounded-full bg-green-500" />
            </span>
            LIVE
          </span>
          <span className="text-2xl xl:text-3xl min-[2560px]:text-6xl font-semibold text-slate-200"><DisplayClock /></span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 xl:gap-8 min-[2560px]:gap-12 flex-1 min-h-0">
        {/* Leaderboard — takes the larger share and stretches to full height */}
        <section className="lg:col-span-3 min-h-0">
          <div className="rounded-2xl bg-slate-900/80 ring-1 ring-white/5 overflow-hidden h-full">
            <table className="w-full h-full">
              <thead>
                <tr className="text-slate-400 text-xs xl:text-sm min-[2560px]:text-2xl border-b border-white/10">
                  <th className="text-left pl-4 xl:pl-6 min-[2560px]:pl-10 pr-1 py-1.5 min-[2560px]:py-4 font-medium">#</th>
                  <th className="text-left pl-1 py-1.5 min-[2560px]:py-4 font-medium w-full">Player</th>
                  <th className="text-right px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-4 font-medium">GP</th>
                  <th className="text-right px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-4 font-medium">W</th>
                  <th className="text-right px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-4 font-medium">L</th>
                  <th className="text-right px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-4 font-medium">SW</th>
                  <th className="text-right px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-4 font-medium">SL</th>
                  <th className="text-right px-4 xl:px-6 min-[2560px]:px-10 py-1.5 min-[2560px]:py-4 font-bold">Pts</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.userId} className="border-b border-white/5 last:border-0">
                    <td className="pl-4 xl:pl-6 min-[2560px]:pl-10 pr-1 py-1.5 min-[2560px]:py-3">
                      <div className="flex items-center gap-1.5 min-[2560px]:gap-4">
                        <span className="w-6 min-[2560px]:w-12 text-center shrink-0 text-base xl:text-lg min-[2560px]:text-4xl font-black text-slate-300">
                          {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
                        </span>
                        <Movement value={row.movement} />
                      </div>
                    </td>
                    <td className="pl-1 py-1.5 min-[2560px]:py-3">
                      <div className="flex items-center gap-2.5 min-[2560px]:gap-5">
                        <PlayerAvatar name={row.name} avatarColor={row.avatarColor} className="h-7 w-7 xl:h-8 xl:w-8 min-[2560px]:h-16 min-[2560px]:w-16 shrink-0" fallbackClassName="text-xs min-[2560px]:text-2xl" />
                        <span className="font-semibold text-base xl:text-lg min-[2560px]:text-4xl truncate">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-3 text-right text-slate-400 text-sm xl:text-base min-[2560px]:text-3xl tabular-nums">{row.gamesPlayed}</td>
                    <td className="px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-3 text-right text-green-400 font-semibold text-sm xl:text-base min-[2560px]:text-3xl tabular-nums">{row.victories}</td>
                    <td className="px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-3 text-right text-red-400 font-semibold text-sm xl:text-base min-[2560px]:text-3xl tabular-nums">{row.losses}</td>
                    <td className="px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-3 text-right text-sm xl:text-base min-[2560px]:text-3xl tabular-nums">{row.setsWon}</td>
                    <td className="px-2.5 min-[2560px]:px-5 py-1.5 min-[2560px]:py-3 text-right text-sm xl:text-base min-[2560px]:text-3xl tabular-nums">{row.setsLost}</td>
                    <td className="px-4 xl:px-6 min-[2560px]:px-10 py-1.5 min-[2560px]:py-3 text-right font-black text-lg xl:text-xl min-[2560px]:text-5xl tabular-nums">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Right column: this week + fun wall. Stretches to the leaderboard's height. */}
        <div className="lg:col-span-2 flex flex-col gap-6 xl:gap-8 min-[2560px]:gap-12 h-full min-h-0">
          <section className="flex-1 flex flex-col rounded-2xl bg-slate-900/80 ring-1 ring-white/5 p-4 xl:p-6 min-[2560px]:p-10 min-h-0">
            <div className="flex items-baseline justify-between mb-4 min-[2560px]:mb-8 shrink-0">
              <h2 className="text-xl xl:text-2xl min-[2560px]:text-5xl font-bold">This week</h2>
              <span className="rounded-full bg-slate-800 px-3 min-[2560px]:px-6 py-1 min-[2560px]:py-2 text-slate-300 text-sm xl:text-base min-[2560px]:text-3xl font-semibold tabular-nums">
                {playedThisWeek}/{weekGames.length} played
              </span>
            </div>
            {weekGames.length === 0 ? (
              <p className="text-slate-500 flex-1 flex items-center justify-center min-[2560px]:text-3xl">No games scheduled this week.</p>
            ) : (
              <div className="flex-1 flex flex-col gap-1.5 min-[2560px]:gap-3 min-h-0">
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
                      className={`flex-1 min-h-[2.25rem] flex items-center gap-3 min-[2560px]:gap-6 rounded-xl px-3 xl:px-4 min-[2560px]:px-8 ring-1 ${confirmed ? 'bg-slate-800/60 ring-white/10' : awaiting ? 'bg-amber-500/5 ring-amber-500/25' : 'bg-slate-800/25 ring-white/5'}`}
                    >
                      <div className="flex-1 flex items-center justify-end gap-2.5 min-[2560px]:gap-5 min-w-0">
                        <span className={`truncate text-right text-base xl:text-lg min-[2560px]:text-3xl ${homeWon ? 'font-bold text-white' : 'text-slate-300'}`}>{g.homeName}</span>
                        <PlayerAvatar name={g.homeName} avatarColor={g.homeColor} className="h-8 w-8 xl:h-9 xl:w-9 min-[2560px]:h-16 min-[2560px]:w-16 shrink-0" fallbackClassName="text-xs min-[2560px]:text-2xl" />
                      </div>
                      <div className="shrink-0 w-20 min-[2560px]:w-44 flex flex-col items-center justify-center leading-tight">
                        {confirmed ? (
                          <span className="font-mono font-black text-white text-lg xl:text-2xl min-[2560px]:text-5xl tabular-nums">{g.homeSets}–{g.awaySets}</span>
                        ) : awaiting && hasScore ? (
                          <>
                            <span className="font-mono font-black text-amber-400 text-lg xl:text-2xl min-[2560px]:text-5xl tabular-nums">{g.homeSets}–{g.awaySets}</span>
                            <span className="text-[10px] xl:text-xs min-[2560px]:text-xl font-semibold uppercase tracking-wide text-amber-400/80">to confirm</span>
                          </>
                        ) : (
                          <span className="rounded-full bg-slate-700/60 px-2.5 min-[2560px]:px-5 py-0.5 min-[2560px]:py-1.5 text-xs min-[2560px]:text-2xl font-bold uppercase tracking-wide text-slate-400">vs</span>
                        )}
                      </div>
                      <div className="flex-1 flex items-center gap-2.5 min-[2560px]:gap-5 min-w-0">
                        <PlayerAvatar name={g.awayName} avatarColor={g.awayColor} className="h-8 w-8 xl:h-9 xl:w-9 min-[2560px]:h-16 min-[2560px]:w-16 shrink-0" fallbackClassName="text-xs min-[2560px]:text-2xl" />
                        <span className={`truncate text-base xl:text-lg min-[2560px]:text-3xl ${awayWon ? 'font-bold text-white' : 'text-slate-300'}`}>{g.awayName}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="shrink-0">
            <h2 className="text-xl xl:text-2xl min-[2560px]:text-5xl font-bold mb-3 min-[2560px]:mb-6">🏅 Records</h2>
            <div className="grid grid-cols-2 gap-3 xl:gap-4 min-[2560px]:gap-8">
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
    <span className="w-8 min-[2560px]:w-16 shrink-0 text-center text-sm xl:text-base min-[2560px]:text-3xl font-semibold tabular-nums">
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
    <div className={`rounded-2xl bg-gradient-to-br ${accent} ring-1 p-4 xl:p-5 min-[2560px]:p-8 flex flex-col gap-2 min-[2560px]:gap-4`}>
      <div className="flex items-center gap-2 min-[2560px]:gap-4 text-slate-300 text-sm xl:text-base min-[2560px]:text-3xl font-medium">
        <span className="text-xl xl:text-2xl min-[2560px]:text-5xl">{emoji}</span>
        {title}
      </div>
      {entry ? (
        <div className="flex items-center gap-3 min-[2560px]:gap-6">
          <PlayerAvatar name={entry.name} avatarColor={entry.avatarColor} className="h-10 w-10 xl:h-12 xl:w-12 min-[2560px]:h-20 min-[2560px]:w-20" fallbackClassName="text-base min-[2560px]:text-3xl" />
          <div className="min-w-0">
            <p className="font-bold text-lg xl:text-xl min-[2560px]:text-4xl truncate">{entry.name}</p>
            <p className="text-slate-300 text-sm xl:text-base min-[2560px]:text-2xl truncate">{entry.value}</p>
          </div>
        </div>
      ) : (
        <p className="text-slate-500 text-sm xl:text-base min-[2560px]:text-2xl">No data yet</p>
      )}
    </div>
  )
}
