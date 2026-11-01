'use client'

import PlayerAvatar from '@/components/player/PlayerAvatar'
import { RotateCcw } from 'lucide-react'
import { type Person } from './logic'

// ── Running: shared header ──────────────────────────────────────────────────────────────────────

export function Header({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <header className="shrink-0 mb-[2vh] flex items-start justify-between">
      <h1 className="text-[3.6vh] leading-none font-black tracking-tight">{name}</h1>
      <button onClick={onReset} className="shrink-0 flex items-center gap-[1vh] rounded-lg bg-slate-800 hover:bg-slate-700 px-[1.6vh] py-[1vh] text-[1.8vh] font-medium text-slate-300 transition-colors">
        <RotateCcw className="h-[2.2vh] w-[2.2vh]" /> New
      </button>
    </header>
  )
}

export function Avatars({ members, size, fallback }: { members: Person[]; size: string; fallback: string }) {
  return (
    <div className="flex -space-x-[1vh] shrink-0">
      {members.map(m => (
        <PlayerAvatar key={m.id} name={m.name} avatarColor={m.color} className={`${size} ring-2 ring-slate-900`} fallbackClassName={fallback} />
      ))}
    </div>
  )
}

export function ScoreCell({ score, won, onClick }: { score: number | null | undefined; won: boolean; onClick?: () => void }) {
  if (onClick) {
    return (
      <button onClick={onClick} className={`shrink-0 min-w-[calc(var(--s)*3.8vh)] h-[calc(var(--s)*3.8vh)] rounded-lg text-[calc(var(--s)*2.4vh)] font-black tabular-nums flex items-center justify-center transition-colors ${won ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}>
        {score ?? '–'}
      </button>
    )
  }
  return score != null ? <span className={`shrink-0 text-[calc(var(--s)*2.4vh)] font-black tabular-nums ${won ? 'text-emerald-400' : 'text-slate-500'}`}>{score}</span> : null
}
