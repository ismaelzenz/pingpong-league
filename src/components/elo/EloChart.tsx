'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn, showElo } from '@/lib/utils'

export interface ChartPoint { playedAt: string; rating: number; delta: number }
export interface ChartSeries { userId: number; name: string; points: ChartPoint[] }

interface Props {
  series: ChartSeries[]
  /** Ids to draw, in the order the user picked them — that order fixes each line's colour. */
  selected: number[]
  /** Colour key under the plot. Off when the parent's own player chips already show it. */
  legend?: boolean
}

/** Six categorical slots, defined on `.elo-viz` in globals.css. See the note there before reordering. */
const SLOTS = 6

const PAD = { top: 16, right: 76, bottom: 26, left: 40 }
/** Drawing width before the container has been measured (and the server render). */
const DEFAULT_W = 760

/**
 * Axis tick label. A league's history runs across seasons, so once the plotted span crosses more
 * than about ten months a bare "26 Sept" is ambiguous — the year goes in.
 */
function formatTick(t: number, spanMs: number): string {
  const long = spanMs > 300 * 86_400_000
  return new Date(t).toLocaleDateString('en-GB', long
    ? { month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' })
}

function formatFull(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Rating over time for the players the reader picked, drawn as overlaid lines on one shared
 * scale. Time is the x-axis (not game number) so two players' lines line up on the same days
 * even when one has played twice as often — which is the whole point of the comparison.
 *
 * Plain SVG: the app ships no charting library, and a multi-series line with a crosshair is
 * little more than a couple of path strings.
 */
export default function EloChart({ series, selected, legend = true }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)

  // Draw at the container's real width, so 11px labels stay 11px on a phone instead of the whole
  // plot shrinking (or needing a sideways scroll). Shorter on narrow screens to keep its shape.
  const [W, setW] = useState(DEFAULT_W)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // On a narrow plot the line-end name labels collide; the colour chips under the chart already
  // name each line, so they go and the plot takes their margin.
  const narrow = W < 500
  const H = narrow ? 220 : 300

  const drawn = useMemo(
    () => selected
      .map(id => series.find(s => s.userId === id))
      .filter((s): s is ChartSeries => !!s && s.points.length > 0)
      .slice(0, SLOTS),
    [series, selected],
  )

  // Room on the right for the longest full name at a line's end (~6.6px a character at 11px).
  const longestName = Math.max(0, ...drawn.map(s => s.name.length))
  const padRight = narrow ? 12 : Math.max(PAD.right, Math.round(longestName * 6.6) + 20)
  const pad = useMemo(() => ({ ...PAD, right: padRight }), [padRight])

  const scale = useMemo(() => {
    const all = drawn.flatMap(s => s.points)
    if (all.length === 0) return null

    const times = all.map(p => new Date(p.playedAt).getTime())
    let tMin = Math.min(...times)
    let tMax = Math.max(...times)
    if (tMin === tMax) { tMin -= 86_400_000; tMax += 86_400_000 } // a single day → give it width

    const ratings = all.map(p => p.rating)
    // Pad the rating axis to a round 20 either side so the lines never touch the frame.
    const rMin = Math.floor((Math.min(...ratings) - 15) / 20) * 20
    const rMax = Math.ceil((Math.max(...ratings) + 15) / 20) * 20

    const x = (t: number) => pad.left + ((t - tMin) / (tMax - tMin)) * (W - pad.left - pad.right)
    const y = (r: number) => pad.top + (1 - (r - rMin) / (rMax - rMin)) * (H - pad.top - pad.bottom)
    return { x, y, tMin, tMax, rMin, rMax }
  }, [drawn, W, H, pad])

  if (!scale || drawn.length === 0) {
    return (
      <div ref={boxRef} className="flex items-center justify-center h-56 text-sm text-muted-foreground text-center px-6">
        Add a player to plot their rating over time.
      </div>
    )
  }

  const { x, y, tMin, tMax, rMin, rMax } = scale

  // Y gridlines on a round step that yields 4–6 lines whatever the range.
  const span = rMax - rMin
  const step = span <= 100 ? 20 : span <= 250 ? 50 : span <= 500 ? 100 : 200
  const yTicks: number[] = []
  for (let r = Math.ceil(rMin / step) * step; r <= rMax; r += step) yTicks.push(r)

  const xTicks = [tMin, tMin + (tMax - tMin) / 2, tMax]

  // Which point each line is showing at the crosshair: its most recent game at or before that
  // moment — a step-wise read, because a rating holds until the next game changes it.
  const hoverTime = hoverX == null ? null : tMin + ((hoverX - pad.left) / (W - pad.left - pad.right)) * (tMax - tMin)
  const readout = hoverTime == null ? [] : drawn.map((s, i) => {
    const at = [...s.points].reverse().find(p => new Date(p.playedAt).getTime() <= hoverTime)
    return { series: s, slot: i, point: at ?? null }
  })

  // Line-end labels, nudged apart: lines often finish close together, and their names would print
  // on top of each other. Top to bottom, each label keeps a line's height below any earlier one
  // it would overlap horizontally.
  const LABEL_GAP = 13
  const labelY = new Map<number, number>()
  const placed: { x: number; y: number; w: number }[] = []
  for (const s of [...drawn].sort((a, b) => y(a.points.at(-1)!.rating) - y(b.points.at(-1)!.rating))) {
    const last = s.points.at(-1)!
    const lx = x(new Date(last.playedAt).getTime()) + 9
    const w = s.name.length * 6.6
    let ly = y(last.rating) + 4
    for (const p of placed) {
      if (lx < p.x + p.w && p.x < lx + w && ly - p.y < LABEL_GAP) ly = p.y + LABEL_GAP
    }
    placed.push({ x: lx, y: ly, w })
    labelY.set(s.userId, ly)
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const box = svg.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    setHoverX(Math.min(W - pad.right, Math.max(pad.left, px)))
  }

  return (
    <div className="elo-viz">
      <div ref={boxRef}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          // pan-y: a vertical swipe still scrolls the page; a sideways drag moves the crosshair.
          className="w-full touch-pan-y"
          role="img"
          aria-label={`Rating over time for ${drawn.map(s => s.name).join(', ')}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHoverX(null)}
        >
          {/* Gridlines and axes stay recessive — they orient, they don't compete with the data. */}
          {yTicks.map(r => (
            <g key={r}>
              <line x1={pad.left} x2={W - pad.right} y1={y(r)} y2={y(r)} stroke="currentColor" strokeWidth={1} className="text-border" />
              <text x={pad.left - 8} y={y(r) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{r}</text>
            </g>
          ))}
          {/* The 1000 baseline everyone starts from — the one gridline worth calling out. */}
          {rMin < 1000 && rMax > 1000 && (
            <line x1={pad.left} x2={W - pad.right} y1={y(1000)} y2={y(1000)} stroke="currentColor" strokeWidth={1} strokeDasharray="4 4" className="text-muted-foreground/60" />
          )}
          {xTicks.map((t, i) => (
            <text key={i} x={x(t)} y={H - 8} textAnchor={i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'} className="fill-muted-foreground text-[11px]">
              {formatTick(t, tMax - tMin)}
            </text>
          ))}

          {hoverX != null && (
            <line x1={hoverX} x2={hoverX} y1={pad.top} y2={H - pad.bottom} stroke="currentColor" strokeWidth={1} className="text-muted-foreground/70" />
          )}

          {drawn.map((s, i) => {
            const colour = `var(--series-${i + 1})`
            const d = s.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(new Date(p.playedAt).getTime()).toFixed(1)},${y(p.rating).toFixed(1)}`).join(' ')
            const last = s.points[s.points.length - 1]
            return (
              <g key={s.userId}>
                <path d={d} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {/* A 2px surface ring keeps the end marker legible where two lines cross. */}
                <circle cx={x(new Date(last.playedAt).getTime())} cy={y(last.rating)} r={4} fill={colour} stroke="var(--card)" strokeWidth={2} />
                {/* Direct label at the line's end: identity never rests on colour alone. A player
                    who stopped playing early ends mid-plot, so the label gets a surface-coloured
                    halo (paint-order: stroke first) to stay readable over whatever crosses it. */}
                {!narrow && <text
                  x={x(new Date(last.playedAt).getTime()) + 9}
                  y={labelY.get(s.userId) ?? y(last.rating) + 4}
                  className="fill-foreground text-[11px] font-medium"
                  stroke="var(--card)"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {s.name}
                </text>}
              </g>
            )
          })}

          {hoverX != null && readout.map(({ series: s, slot, point }) => point && (
            <circle
              key={s.userId}
              cx={x(new Date(point.playedAt).getTime())}
              cy={y(point.rating)}
              r={4}
              fill={`var(--series-${slot + 1})`}
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>

      {/* Tooltip as HTML below the plot rather than floating over it — on a phone a floating
          card would sit under the reader's own thumb. */}
      <div className="min-h-[2.25rem] mt-1 px-1">
        {hoverTime != null && readout.some(r => r.point) ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted-foreground tabular-nums">{formatFull(new Date(hoverTime).toISOString())}</span>
            {readout.filter(r => r.point).map(({ series: s, slot, point }) => (
              <span key={s.userId} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `var(--series-${slot + 1})` }} />
                <span className="text-muted-foreground">{s.name}</span>
                <span className="font-semibold tabular-nums">{showElo(point!.rating)}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Hover or drag across the chart to read every rating on a given day.</p>
        )}
      </div>

      {/* Legend — always present for two or more series. */}
      {legend && drawn.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 px-1">
          {drawn.map((s, i) => (
            <span key={s.userId} className={cn('inline-flex items-center gap-1.5 text-xs')}>
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `var(--series-${i + 1})` }} />
              <span className="text-muted-foreground">{s.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
