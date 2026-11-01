'use client'

import { useState, useEffect } from 'react'
import { type Results, type SavedTournament, type AppUser } from './logic'
import Setup from './Setup'
import KnockoutView from './KnockoutView'
import LeagueView from './LeagueView'

const STORAGE_KEY = 'zenz-daily-tournament-v1'

export default function DailyTournament({ appUsers }: { appUsers: AppUser[] }) {
  const [saved, setSaved] = useState<SavedTournament | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) setSaved(JSON.parse(raw)) } catch { /* ignore */ }
      setLoaded(true)
    })
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => {
    if (!loaded) return
    try { if (saved) localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); else localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [saved, loaded])

  const updateResults = (fn: (r: Results) => Results) => setSaved(s => (s ? { ...s, results: fn(s.results) } : s))
  const reset = () => { if (confirm('Start a new tournament? This clears the current one.')) setSaved(null) }

  if (!loaded) return <div className="h-screen bg-slate-950" />
  if (!saved) return <Setup appUsers={appUsers} onCreate={config => setSaved({ config, results: {} })} />

  return saved.config.format === 'knockout'
    ? <KnockoutView saved={saved} updateResults={updateResults} onReset={reset} />
    : <LeagueView saved={saved} updateResults={updateResults} onReset={reset} />
}
