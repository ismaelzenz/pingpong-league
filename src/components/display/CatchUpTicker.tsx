'use client'

import { useEffect, useRef, useState } from 'react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import { History } from 'lucide-react'
import type { WeekGame } from '@/lib/data/display'

/**
 * Catch-up backlog strip for the office board. Each game is a pill (avatar · name · v · name ·
 * avatar). When the pills overflow their row it becomes a seamless marquee (two copies scrolling
 * -50%); when they fit, it stays a single static row — so a lone game shows exactly once instead
 * of being duplicated by the loop.
 */
function Pill({ g }: { g: WeekGame }) {
  return (
    <span className="flex items-center gap-[0.9vh] mr-[1.4vh] shrink-0 rounded-full bg-slate-950/40 border border-sky-300/40 px-[1.4vh] py-[0.6vh]">
      <PlayerAvatar name={g.homeName} avatarColor={g.homeColor} className="h-[2.6vh] w-[2.6vh] shrink-0" fallbackClassName="text-[1.2vh]" />
      <span className="text-[1.9vh] font-medium text-slate-100 whitespace-nowrap">{g.homeName}</span>
      <span className="text-[1.4vh] font-bold uppercase text-sky-200/80">v</span>
      <span className="text-[1.9vh] font-medium text-slate-100 whitespace-nowrap">{g.awayName}</span>
      <PlayerAvatar name={g.awayName} avatarColor={g.awayColor} className="h-[2.6vh] w-[2.6vh] shrink-0" fallbackClassName="text-[1.2vh]" />
    </span>
  )
}

export default function CatchUpTicker({ games }: { games: WeekGame[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(false)

  useEffect(() => {
    const measure = () => {
      const c = containerRef.current, copy = copyRef.current
      if (!c || !copy) return
      setScroll(copy.scrollWidth > c.clientWidth + 2)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [games])

  const duration = Math.max(24, games.length * 4)

  return (
    <div className="shrink-0 mt-[0.8vh] flex items-center gap-[1.4vh] rounded-xl bg-sky-400/10 border border-sky-400/30 px-[1.6vh] py-[0.8vh] overflow-hidden">
      <div className="flex items-center gap-[0.8vh] shrink-0 text-sky-200">
        <History className="h-[2.4vh] w-[2.4vh]" />
        <span className="text-[1.6vh] font-semibold uppercase tracking-wide whitespace-nowrap">Catch-up · {games.length} to play</span>
      </div>
      <div ref={containerRef} className="relative flex-1 min-w-0 overflow-hidden py-[0.5vh]">
        <div className={`flex w-max ${scroll ? 'display-marquee' : ''}`} style={scroll ? { animationDuration: `${duration}s` } : undefined}>
          <div ref={copyRef} className="flex shrink-0">
            {games.map((g, i) => <Pill key={i} g={g} />)}
          </div>
          {/* Second copy only when scrolling — it's what makes the -50% loop seamless. */}
          {scroll && (
            <div className="flex shrink-0" aria-hidden>
              {games.map((g, i) => <Pill key={i} g={g} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
