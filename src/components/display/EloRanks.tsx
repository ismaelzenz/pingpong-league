'use client'

import { useEffect, useRef, useState } from 'react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import type { DisplayElo } from '@/lib/data/displayElo'

const DAY_MS = 86_400_000

/**
 * Line colours that stay apart on a dark TV from across the room. With the whole roster drawn they
 * repeat; the avatar beside each name (ringed in its colour) is what tells two apart. Player avatar
 * colours can't be used for the lines — many players never pick one.
 */
const LINE_COLOURS = ['#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a78bfa', '#fb923c', '#f87171', '#a3e635', '#22d3ee', '#e879f9']

/** The element's content size, kept current — the chart draws at real pixels so vh-sized text stays crisp. */
function useBoxSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/**
 * Everyone's ELO *rank* at the end of each day of the window, from the race's rating series. A
 * player isn't ranked (null) before their first rated game.
 */
function dailyRanks(race: DisplayElo['race']) {
  const start = new Date(race.from).getTime()
  const days = Math.max(1, Math.ceil((new Date(race.to).getTime() - start) / DAY_MS))
  const ranks = new Map(race.series.map(s => [s.userId, [] as (number | null)[]]))
  for (let d = 0; d < days; d++) {
    const cutoff = new Date(Math.min(start + (d + 1) * DAY_MS, new Date(race.to).getTime())).toISOString()
    const standing = race.series
      .map(s => ({ userId: s.userId, rating: s.points.filter(p => p.at <= cutoff).at(-1)?.rating }))
      .filter((e): e is { userId: number; rating: number } => e.rating != null)
      .sort((a, b) => b.rating - a.rating || a.userId - b.userId)
    const rankOf = new Map(standing.map((e, i) => [e.userId, i + 1]))
    for (const s of race.series) ranks.get(s.userId)!.push(rankOf.get(s.userId) ?? null)
  }
  return { days, ranks }
}

/**
 * A bump chart: each player's place on the ELO ladder, day by day over the last month. Ranks never
 * share a row, so every name fits down the right edge, and a line crossing another is an overtake.
 */
export default function EloRanks({ race }: { race: DisplayElo['race'] }) {
  const [boxRef, size] = useBoxSize()
  const series = race.series.filter(s => s.points.length > 0)

  let chart = null
  if (size && size.w > 0 && size.h > 0 && series.length > 0) {
    const { w: W, h: H } = size
    const vh = window.innerHeight / 100
    const { days, ranks } = dailyRanks(race)
    const n = series.length
    const pad = { top: 2 * vh, right: 24 * vh, bottom: 3.6 * vh, left: 4.5 * vh }
    const rowH = (H - pad.top - pad.bottom) / Math.max(1, n - 1)
    const font = Math.min(1.9 * vh, rowH * 0.62)
    const avatar = Math.min(2.8 * vh, rowH * 0.85)
    const x = (d: number) => pad.left + (days > 1 ? d / (days - 1) : 1) * (W - pad.left - pad.right)
    const y = (rank: number) => pad.top + (rank - 1) * rowH
    const xEnd = W - pad.right
    const colourOf = (i: number) => LINE_COLOURS[i % LINE_COLOURS.length]
    const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

    chart = (
      <div className="relative" style={{ width: W, height: H }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Everyone's ELO rank, day by day, over the last 30 days">
          {Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <line x1={pad.left} x2={xEnd} y1={y(i + 1)} y2={y(i + 1)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              <text x={pad.left - vh} y={y(i + 1) + font * 0.35} textAnchor="end" fill="#64748b" fontSize={font * 0.9} className="tabular-nums">{i + 1}</text>
            </g>
          ))}
          <text x={pad.left} y={H - vh} fill="#64748b" fontSize={1.6 * vh}>{day(race.from)}</text>
          <text x={xEnd} y={H - vh} textAnchor="end" fill="#64748b" fontSize={1.6 * vh}>Today</text>

          {series.map((s, i) => {
            const r = ranks.get(s.userId)!
            // One path per stretch the player was ranked: a newcomer's line starts on their debut day.
            let d = ''
            let pen = false
            r.forEach((rank, j) => {
              if (rank == null) { pen = false; return }
              d += `${pen ? ' L' : ' M'}${x(j).toFixed(1)},${y(rank).toFixed(1)}`
              pen = true
            })
            const first = r.findIndex(v => v != null)
            return (
              <g key={s.userId}>
                <path d={d} fill="none" stroke={colourOf(i)} strokeWidth={0.35 * vh} strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
                {first > 0 && <circle cx={x(first)} cy={y(r[first]!)} r={0.55 * vh} fill={colourOf(i)} />}
              </g>
            )
          })}
        </svg>
        {/* Today's order down the right edge: rank, avatar ringed in the line's colour, name. */}
        {series.map((s, i) => {
          const rank = ranks.get(s.userId)!.at(-1)
          if (rank == null) return null
          return (
            <div
              key={s.userId}
              className="absolute flex items-center gap-[0.8vh]"
              style={{ left: xEnd + 1.2 * vh, top: y(rank) - avatar / 2, height: avatar, right: 0 }}
            >
              <div className="shrink-0 rounded-full" style={{ width: avatar, height: avatar, boxShadow: `0 0 0 ${0.25 * vh}px ${colourOf(i)}` }}>
                <PlayerAvatar name={s.name} avatarColor={s.avatarColor} className="h-full w-full" fallbackClassName="text-[1.2vh]" />
              </div>
              <span className="truncate font-semibold text-slate-100" style={{ fontSize: font }}>{s.name}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={boxRef} className="h-full w-full px-[1.6vh] pb-[1.2vh]">
      {series.length === 0
        ? <p className="h-full flex items-center justify-center text-slate-500 text-[2.2vh]">No rated games yet.</p>
        : chart}
    </div>
  )
}
