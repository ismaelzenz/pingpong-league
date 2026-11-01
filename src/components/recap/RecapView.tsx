import type { RecapData } from '@/lib/recap'
import { Card, CardContent } from '@/components/ui/card'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import PlayerLink from '@/components/player/PlayerLink'
import { TrendingUp, Flame, Bomb, Target, Crown, Shield, Zap, HeartPulse } from 'lucide-react'
import { medal } from '@/lib/utils'

/** Renders a finished tournament's recap. Shared by /recap (latest) and /recap/[id] (a specific season). */
export default function RecapView({ recap, currentUserId }: { recap: RecapData; currentUserId: number }) {
  const { tournament, champion, podium, awards, totals, standings, bestStreakByUser, personalByUser } = recap
  const me = standings.find(s => s.userId === currentUserId)

  const awardTiles = [
    { Icon: TrendingUp, iconClass: 'text-blue-500', title: 'Most improved', entry: awards.mostImproved, accent: 'from-blue-500/25 to-indigo-500/10 ring-blue-500/40 dark:from-blue-500/15 dark:to-indigo-500/5 dark:ring-blue-500/25' },
    { Icon: Flame, iconClass: 'text-orange-500', title: 'On fire', entry: awards.onFire, accent: 'from-orange-500/25 to-red-500/10 ring-orange-500/40 dark:from-orange-500/15 dark:to-red-500/5 dark:ring-orange-500/25' },
    { Icon: Bomb, iconClass: 'text-purple-500', title: 'The Destroyer', entry: awards.destroyer, accent: 'from-purple-500/25 to-fuchsia-500/10 ring-purple-500/40 dark:from-purple-500/15 dark:to-fuchsia-500/5 dark:ring-purple-500/25' },
    { Icon: Target, iconClass: 'text-sky-500', title: 'Clutch', entry: awards.clutch, accent: 'from-sky-500/25 to-cyan-500/10 ring-sky-500/40 dark:from-sky-500/15 dark:to-cyan-500/5 dark:ring-sky-500/25' },
    { Icon: Crown, iconClass: 'text-yellow-500', title: 'Best win rate', entry: awards.bestWinRate, accent: 'from-yellow-500/25 to-amber-500/10 ring-yellow-500/40 dark:from-yellow-500/15 dark:to-amber-500/5 dark:ring-yellow-500/25' },
    { Icon: Shield, iconClass: 'text-emerald-500', title: 'The Wall', entry: awards.theWall, accent: 'from-emerald-500/25 to-teal-500/10 ring-emerald-500/40 dark:from-emerald-500/15 dark:to-teal-500/5 dark:ring-emerald-500/25' },
    { Icon: Zap, iconClass: 'text-pink-500', title: 'Set machine', entry: awards.setMachine, accent: 'from-pink-500/25 to-rose-500/10 ring-pink-500/40 dark:from-pink-500/15 dark:to-rose-500/5 dark:ring-pink-500/25' },
    { Icon: HeartPulse, iconClass: 'text-red-500', title: 'Nail-biter', entry: awards.nailBiter, accent: 'from-red-500/25 to-rose-500/10 ring-red-500/40 dark:from-red-500/15 dark:to-rose-500/5 dark:ring-red-500/25' },
  ].filter(t => t.entry)

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Season recap</p>
        <h1 className="text-3xl font-black">{tournament.name}</h1>
      </div>

      {/* Champion */}
      {champion && (
        <Card className="border-yellow-400/60 bg-gradient-to-b from-yellow-400/25 to-transparent dark:border-yellow-400/50 dark:from-yellow-400/10">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-3">
            <div className="text-5xl">🏆</div>
            <PlayerAvatar name={champion.name} avatarColor={champion.avatarColor} className="h-20 w-20" fallbackClassName="text-2xl" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-yellow-600 dark:text-yellow-400">Champion</p>
              <p className="text-2xl font-black">{champion.name}</p>
              <p className="text-muted-foreground text-sm mt-1">
                {champion.points} pts · {champion.victories}W–{champion.losses}L
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Podium */}
      {podium.length >= 2 && (
        <div className="grid grid-cols-3 gap-3 items-end">
          {[podium[1], podium[0], podium[2]].map((p, i) => {
            if (!p) return <div key={i} />
            const medal = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : '🥉'
            const height = p.rank === 1 ? 'pt-6 pb-8' : 'pt-4 pb-6'
            return (
              <Card key={p.userId} className={p.rank === 1 ? 'border-yellow-400/40' : ''}>
                <CardContent className={`${height} flex flex-col items-center text-center gap-1.5`}>
                  <div className="text-2xl">{medal}</div>
                  <PlayerAvatar name={p.name} avatarColor={p.avatarColor} className={p.rank === 1 ? 'h-14 w-14' : 'h-11 w-11'} fallbackClassName="text-base" />
                  <p className="font-bold text-sm truncate max-w-full">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.points} pts</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Season awards */}
      {awardTiles.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-3">🏅 Season awards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {awardTiles.map(t => (
              <div key={t.title} className={`rounded-xl bg-gradient-to-br ${t.accent} ring-1 p-4 flex items-center gap-3`}>
                <t.Icon className={`h-6 w-6 shrink-0 ${t.iconClass}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">{t.title}</p>
                  <p className="font-bold truncate">{t.entry!.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.entry!.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* League by the numbers */}
      <div>
        <h2 className="text-lg font-bold mb-3">📊 The season in numbers</h2>
        <Card>
          <CardContent className="py-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div><p className="text-2xl font-black">{totals.games}</p><p className="text-xs text-muted-foreground">Games played</p></div>
            <div><p className="text-2xl font-black">{totals.sets}</p><p className="text-xs text-muted-foreground">Sets played</p></div>
            <div><p className="text-2xl font-black">{totals.deciders}</p><p className="text-xs text-muted-foreground">Went to a decider (2–1)</p></div>
            <div><p className="text-2xl font-black">{totals.straightSets}</p><p className="text-xs text-muted-foreground">Clean sweeps (2–0)</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Your season */}
      {me && (() => {
        const mine = personalByUser[me.userId]
        const winRate = me.gamesPlayed ? Math.round((me.victories / me.gamesPlayed) * 100) : 0
        const totalSets = me.setsWon + me.setsLost
        const setWinRate = totalSets ? Math.round((me.setsWon / totalSets) * 100) : 0
        const gap = champion ? champion.points - me.points : 0
        const headline = me.rank === 1
          ? 'League champion 🏆'
          : gap > 0 ? `${gap} pt${gap !== 1 ? 's' : ''} behind the champion` : null
        const myBadges = awardTiles.filter(t => t.entry!.userId === me.userId)
        const tiles: { label: string; value: string | number; className?: string }[] = [
          { label: 'Final rank', value: `#${me.rank}` },
          { label: 'Points', value: me.points, className: 'text-primary' },
          { label: 'Win rate', value: `${winRate}%` },
          { label: 'Set win rate', value: `${setWinRate}%` },
          { label: 'Wins', value: me.victories, className: 'text-green-600' },
          { label: 'Losses', value: me.losses, className: 'text-red-500' },
          { label: 'Games played', value: me.gamesPlayed },
          { label: 'Best streak', value: bestStreakByUser[me.userId] ?? 0 },
          { label: 'Sets won', value: me.setsWon },
          { label: 'Sets lost', value: me.setsLost },
          { label: 'Clean sweeps (2–0)', value: mine?.cleanSweeps ?? 0 },
          { label: 'Deciders won (2–1)', value: mine?.decidersWon ?? 0 },
        ]
        return (
          <div>
            <h2 className="text-lg font-bold mb-3">🫵 Your season</h2>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-5 space-y-5">
                <div className="flex items-center gap-3">
                  <PlayerAvatar name={me.name} avatarColor={me.avatarColor} className="h-12 w-12" fallbackClassName="text-lg" />
                  <div className="min-w-0">
                    <p className="font-bold text-lg truncate">{me.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Finished {me.rank === 1 ? '🥇 1st' : me.rank === 2 ? '🥈 2nd' : me.rank === 3 ? '🥉 3rd' : `#${me.rank}`} of {standings.length}
                      {headline && <> · {headline}</>}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 text-center">
                  {tiles.map(t => (
                    <div key={t.label}>
                      <p className={`text-xl font-bold ${t.className ?? ''}`}>{t.value}</p>
                      <p className="text-xs text-muted-foreground">{t.label}</p>
                    </div>
                  ))}
                </div>

                {(mine?.favorite || mine?.nemesis) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mine.favorite && (
                      <div className="rounded-lg bg-background/60 ring-1 ring-border p-4 flex flex-col items-center text-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">😈 Favourite opponent</p>
                        <PlayerAvatar name={mine.favorite.name} avatarColor={mine.favorite.avatarColor} className="h-11 w-11" fallbackClassName="text-sm" />
                        <div className="max-w-full">
                          <p className="font-semibold truncate">{mine.favorite.name}</p>
                          <p className="text-xs text-muted-foreground">You won {mine.favorite.wins} of {mine.favorite.wins + mine.favorite.losses}</p>
                        </div>
                      </div>
                    )}
                    {mine.nemesis && (
                      <div className="rounded-lg bg-background/60 ring-1 ring-border p-4 flex flex-col items-center text-center gap-2">
                        <p className="text-xs font-medium text-muted-foreground">😤 Your nemesis</p>
                        <PlayerAvatar name={mine.nemesis.name} avatarColor={mine.nemesis.avatarColor} className="h-11 w-11" fallbackClassName="text-sm" />
                        <div className="max-w-full">
                          <p className="font-semibold truncate">{mine.nemesis.name}</p>
                          <p className="text-xs text-muted-foreground">You lost {mine.nemesis.losses} of {mine.nemesis.wins + mine.nemesis.losses}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {myBadges.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Your badges</p>
                    <div className="flex flex-wrap gap-2">
                      {myBadges.map(b => (
                        <span key={b.title} className="inline-flex items-center gap-1.5 rounded-full bg-background/70 ring-1 ring-border px-3 py-1 text-xs font-medium">
                          <b.Icon className={`h-3.5 w-3.5 ${b.iconClass}`} />{b.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      })()}

      {/* Final standings */}
      <div>
        <h2 className="text-lg font-bold mb-3">Final standings</h2>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground">
                    <th className="text-left pl-4 pr-1 py-2.5 font-medium">#</th>
                    <th className="text-left pl-1 pr-4 py-2.5 font-medium w-full">Player</th>
                    <th className="text-right px-3 py-2.5 font-medium">W</th>
                    <th className="text-right px-3 py-2.5 font-medium">L</th>
                    <th className="text-right px-4 py-2.5 font-medium">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map(s => {
                    const isMe = s.userId === currentUserId
                    return (
                      <tr key={s.userId} className={`border-b last:border-0 ${isMe ? 'bg-primary/5' : ''}`}>
                        <td className="pl-4 pr-1 py-2.5 text-muted-foreground">{medal(s.rank) ?? s.rank}</td>
                        <td className="pl-1 pr-4 py-2.5">
                          {isMe ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <PlayerAvatar name={s.name} avatarColor={s.avatarColor} className="h-6 w-6 shrink-0" fallbackClassName="text-[10px]" />
                              <span className="text-primary font-medium truncate">{s.name} (you)</span>
                            </div>
                          ) : (
                            <PlayerLink userId={s.userId} currentUserId={currentUserId} className="flex items-center gap-2 w-fit min-w-0">
                              <PlayerAvatar name={s.name} avatarColor={s.avatarColor} className="h-6 w-6 shrink-0" fallbackClassName="text-[10px]" />
                              <span className="font-medium truncate hover:underline">{s.name}</span>
                            </PlayerLink>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-green-600">{s.victories}</td>
                        <td className="px-3 py-2.5 text-right text-red-500">{s.losses}</td>
                        <td className="px-4 py-2.5 text-right font-bold">{s.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
