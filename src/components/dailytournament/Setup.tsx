'use client'

import { useState } from 'react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import { Medal, Plus, X, Shuffle, Users, User, Swords, ListOrdered } from 'lucide-react'
import { type Person, type Competitor, type Format, type Mode, type SavedTournament, type AppUser } from './logic'

const GUEST_COLORS = ['#f43f5e', '#0ea5e9', '#8b5cf6', '#22c55e', '#eab308', '#ec4899', '#f97316', '#14b8a6', '#6366f1', '#84cc16']

// ── Setup ─────────────────────────────────────────────────────────────────────────────────────

export default function Setup({ appUsers, onCreate }: { appUsers: AppUser[]; onCreate: (c: SavedTournament['config']) => void }) {
  const [name, setName] = useState('Daily Tournament')
  const [format, setFormat] = useState<Format>('knockout')
  const [mode, setMode] = useState<Mode>('singles')
  const [thirdPlace, setThirdPlace] = useState(true)
  const [people, setPeople] = useState<Person[]>([])
  const [pairs, setPairs] = useState<Person[][] | null>(null) // doubles: generated teams (null = not yet)
  const [search, setSearch] = useState('')
  const [guest, setGuest] = useState('')

  const has = (id: string) => people.some(p => p.id === id)
  const togglePerson = (p: Person) => {
    setPairs(null)
    setPeople(prev => (prev.some(x => x.id === p.id) ? prev.filter(x => x.id !== p.id) : [...prev, p]))
  }
  const addGuest = () => {
    const n = guest.trim()
    if (!n) return
    setPairs(null)
    setPeople(prev => [...prev, { id: `g-${crypto.randomUUID()}`, name: n, color: GUEST_COLORS[prev.length % GUEST_COLORS.length] }])
    setGuest('')
  }
  const generatePairs = () => {
    const a = [...people]
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
    const p: Person[][] = []
    for (let i = 0; i + 1 < a.length; i += 2) p.push([a[i], a[i + 1]])
    setPairs(p)
  }

  const evenPeople = people.length % 2 === 0
  const canPair = mode === 'doubles' && people.length >= 4 && evenPeople
  const competitorCount = mode === 'singles' ? people.length : (pairs?.length ?? 0)
  const valid = mode === 'singles' ? people.length >= 2 : (pairs != null && pairs.length >= 2)

  const filtered = appUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))

  const generate = () => {
    const competitors: Competitor[] = mode === 'singles'
      ? people.map(p => ({ id: crypto.randomUUID(), members: [p] }))
      : (pairs ?? []).map(t => ({ id: crypto.randomUUID(), members: t }))
    onCreate({ name: name.trim() || 'Daily Tournament', format, mode, competitors, thirdPlace })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-3xl font-black bg-transparent outline-none border-b-2 border-transparent focus:border-slate-700 w-full"
          />
          <p className="text-slate-400 mt-1">Set up a quick tournament — pick a format, add players, and go.</p>
        </div>

        {/* Format & mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Choice label="Format">
            <Toggle active={format === 'knockout'} onClick={() => setFormat('knockout')} icon={<Swords className="h-4 w-4" />} title="Knockout" desc="Single elimination bracket" />
            <Toggle active={format === 'league'} onClick={() => setFormat('league')} icon={<ListOrdered className="h-4 w-4" />} title="League" desc="Everyone plays everyone" />
          </Choice>
          <Choice label="Mode">
            <Toggle active={mode === 'singles'} onClick={() => { setMode('singles'); setPairs(null) }} icon={<User className="h-4 w-4" />} title="Singles" desc="1 v 1" />
            <Toggle active={mode === 'doubles'} onClick={() => { setMode('doubles'); setPairs(null) }} icon={<Users className="h-4 w-4" />} title="Doubles" desc="Teams of 2" />
          </Choice>
        </div>

        {format === 'knockout' && (
          <button
            onClick={() => setThirdPlace(v => !v)}
            className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left hover:border-slate-600 transition-colors w-full sm:w-auto"
          >
            <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${thirdPlace ? 'bg-emerald-600' : 'bg-slate-700'}`}>
              <span className={`h-5 w-5 rounded-full bg-white transition-transform ${thirdPlace ? 'translate-x-5' : ''}`} />
            </span>
            <span>
              <span className="flex items-center gap-2 font-semibold"><Medal className="h-4 w-4 text-amber-500" /> Play for 3rd place</span>
              <span className="block text-xs text-slate-400 mt-0.5">The two semifinal losers play a bronze-medal game</span>
            </span>
          </button>
        )}

        {/* People */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="font-bold mb-2">Add players</h2>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search league members…"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-500 mb-2"
            />
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
              {filtered.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">No members found.</p>}
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => togglePerson(u)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${has(u.id) ? 'bg-emerald-500/10' : 'hover:bg-slate-800/60'}`}
                >
                  <PlayerAvatar name={u.name} avatarColor={u.color} className="h-7 w-7" fallbackClassName="text-xs" />
                  <span className="flex-1 truncate">{u.name}</span>
                  {has(u.id) ? <X className="h-4 w-4 text-slate-400" /> : <Plus className="h-4 w-4 text-slate-500" />}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={guest}
                onChange={e => setGuest(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addGuest() }}
                placeholder="Add a guest by name…"
                className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <button onClick={addGuest} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 text-sm font-medium">Add</button>
            </div>
          </div>

          {/* Selected pool / generated teams */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold">
                {mode === 'doubles' && pairs ? `Teams (${pairs.length})` : `Players (${people.length})`}
              </h2>
              {mode === 'doubles' && pairs && (
                <button onClick={() => setPairs(null)} className="text-xs text-slate-400 hover:text-white">Edit players</button>
              )}
            </div>

            {people.length === 0 && <p className="text-sm text-slate-500">No one added yet.</p>}

            {/* Doubles, pairs generated → show the teams */}
            {mode === 'doubles' && pairs ? (
              <>
                <div className="space-y-2">
                  {pairs.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500 w-14 shrink-0">Team {i + 1}</span>
                      <div className="flex-1 flex flex-wrap gap-3">
                        {t.map(p => (
                          <span key={p.id} className="inline-flex items-center gap-1.5 text-sm">
                            <PlayerAvatar name={p.name} avatarColor={p.color} className="h-6 w-6" fallbackClassName="text-[10px]" />
                            {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={generatePairs} className="mt-3 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
                  <Shuffle className="h-3.5 w-3.5" /> Re-generate pairs
                </button>
              </>
            ) : (
              <>
                {/* Pool of players (singles competitors, or doubles before pairing) */}
                <div className="flex flex-wrap gap-2">
                  {people.map(p => (
                    <span key={p.id} className="inline-flex items-center gap-2 rounded-full bg-slate-800 pl-1 pr-2 py-1 text-sm">
                      <PlayerAvatar name={p.name} avatarColor={p.color} className="h-6 w-6" fallbackClassName="text-[10px]" />
                      {p.name}
                      <button onClick={() => togglePerson(p)}><X className="h-3.5 w-3.5 text-slate-400 hover:text-white" /></button>
                    </span>
                  ))}
                </div>
                {mode === 'doubles' && (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={generatePairs}
                      disabled={!canPair}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold transition-colors"
                    >
                      <Shuffle className="h-4 w-4" /> Generate pairs
                    </button>
                    {people.length >= 4 && !evenPeople && <span className="text-xs text-amber-400">Even number of players needed.</span>}
                    {people.length < 4 && <span className="text-xs text-slate-500">Add at least 4 players.</span>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Generate */}
        <div className="flex items-center gap-4 pt-2">
          <button
            onClick={generate}
            disabled={!valid}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-6 py-3 font-bold transition-colors"
          >
            {format === 'knockout' ? 'Generate bracket' : 'Generate fixtures'} · {competitorCount} {mode === 'singles' ? 'players' : 'teams'}
          </button>
          {!valid && mode === 'singles' && <span className="text-sm text-slate-500">Add at least 2 players.</span>}
          {!valid && mode === 'doubles' && !pairs && <span className="text-sm text-slate-500">Add players, then generate the pairs.</span>}
          {!valid && mode === 'doubles' && pairs && pairs.length < 2 && <span className="text-sm text-slate-500">Need at least 2 teams.</span>}
        </div>
      </div>
    </div>
  )
}

function Choice({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  )
}
function Toggle({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}`}>
      <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
    </button>
  )
}
