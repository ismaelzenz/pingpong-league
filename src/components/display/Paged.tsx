'use client'

import { useState, useEffect, useRef } from 'react'
import type { WeekGame, ByePlayer } from '@/lib/data/display'
import type { StandingRow } from '@/lib/domain/standings'
import { StandingsPanel, ThisWeekPanel } from '@/components/display/parts'
import { isFinished } from '@/lib/domain/gameStatus'
import { useFreshResults } from '@/components/display/ResultCelebration'

/**
 * Auto-paging for the standings and this-week panels, built as a real carousel: every page is
 * laid out side by side on a track, and the track slides so the current page moves out while the
 * next moves in — one continuous motion. Scales to any roster size; a single page is static.
 * The active page bounces (0→1→…→N-1→…→0) so every transition is a single, natural slide step.
 */

function paginate(length: number, maxPerPage: number) {
  const pageCount = Math.max(1, Math.ceil(length / maxPerPage))
  const pageSize = Math.ceil(length / pageCount) // even distribution across pages
  return { pageCount, pageSize }
}

function usePingPong(pageCount: number, intervalMs: number) {
  const [i, setI] = useState(0)
  const dir = useRef(1)
  useEffect(() => {
    dir.current = 1
    if (pageCount <= 1) return
    const t = setInterval(() => {
      setI(prev => {
        let next = prev + dir.current
        if (next > pageCount - 1) { dir.current = -1; next = pageCount - 2 }
        else if (next < 0) { dir.current = 1; next = 1 }
        return Math.min(Math.max(next, 0), pageCount - 1)
      })
    }, intervalMs)
    return () => clearInterval(t)
  }, [pageCount, intervalMs])
  return Math.min(i, Math.max(0, pageCount - 1))
}

function PageDots({ count, active }: { count: number; active: number }) {
  return (
    <div className="shrink-0 flex justify-center gap-[0.8vh]">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`h-[1vh] w-[1vh] rounded-full transition-colors ${i === active ? 'bg-slate-200' : 'bg-slate-600'}`} />
      ))}
    </div>
  )
}

/** Horizontal carousel track: renders every page side by side and slides to the active one. */
function Slider({ pageCount, page, children }: { pageCount: number; page: number; children: React.ReactNode[] }) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ width: `${pageCount * 100}%`, transform: `translateX(-${page * (100 / pageCount)}%)` }}
      >
        {children.map((child, i) => (
          <div key={i} className="h-full shrink-0" style={{ width: `${100 / pageCount}%` }}>
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

export function PagedStandings({ rows, maxPerPage = 18, intervalMs = 20000 }: { rows: StandingRow[]; maxPerPage?: number; intervalMs?: number }) {
  const { pageCount, pageSize } = paginate(rows.length, maxPerPage)
  const page = usePingPong(pageCount, intervalMs)
  const from = page * pageSize + 1
  const to = Math.min(rows.length, from + pageSize - 1)
  return (
    <div className="h-full flex flex-col min-h-0 rounded-2xl bg-slate-900/80 ring-1 ring-white/5 overflow-hidden">
      {/* "1–12 of 23" says there's more to come — the dots alone didn't. */}
      <div className="shrink-0 flex items-baseline justify-between px-[1.6vh] pt-[1.4vh] pb-[1vh]">
        <h2 className="text-[2.5vh] font-bold">Standings</h2>
        {pageCount > 1 && (
          <span className="rounded-full bg-slate-800 px-[1.4vh] py-[0.4vh] text-slate-300 text-[1.8vh] font-semibold tabular-nums">
            {from}–{to} of {rows.length}
          </span>
        )}
      </div>
      {/* Fills over each page's time on screen, so you can see a page turn coming. Re-keyed per
          page to restart the animation. */}
      {pageCount > 1 && (
        <div className="shrink-0 h-[0.3vh] bg-white/5">
          <div key={page} className="h-full bg-sky-400/70 origin-left display-progress" style={{ animationDuration: `${intervalMs}ms` }} />
        </div>
      )}
      <Slider pageCount={pageCount} page={page}>
        {Array.from({ length: pageCount }, (_, i) => (
          <StandingsPanel key={i} rows={rows.slice(i * pageSize, i * pageSize + pageSize)} />
        ))}
      </Slider>
    </div>
  )
}

export function PagedThisWeek({ weekGames, byePlayers, catchUpGames, maxPerPage = 10, intervalMs = 20000 }: { weekGames: WeekGame[]; byePlayers?: ByePlayer[]; catchUpGames?: WeekGame[]; maxPerPage?: number; intervalMs?: number }) {
  const total = weekGames.length
  const played = weekGames.filter(g => isFinished(g.status)).length
  const { pageCount, pageSize } = paginate(total, maxPerPage)
  const page = usePingPong(pageCount, intervalMs)
  const freshIds = useFreshResults()
  return (
    <div className="h-full flex flex-col gap-[1vh] min-h-0">
      <Slider pageCount={pageCount} page={page}>
        {Array.from({ length: pageCount }, (_, i) => (
          <ThisWeekPanel key={i} weekGames={weekGames.slice(i * pageSize, i * pageSize + pageSize)} summary={{ played, total }} byePlayers={byePlayers} catchUpGames={catchUpGames} freshIds={freshIds} />
        ))}
      </Slider>
      {pageCount > 1 && <PageDots count={pageCount} active={page} />}
    </div>
  )
}
