'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useApiAction } from '@/hooks/useApiAction'
import { cn, joinNames } from '@/lib/utils'
import { X } from 'lucide-react'
import { OUTCOMES, type Outcome } from '@/lib/domain/gameResult'
import OutcomeButton from '@/components/game/OutcomeButton'
import ConfirmResultPanel from '@/components/game/ConfirmResultPanel'

interface Member { id: number; name: string; email: string }

interface Props {
  /** Everyone with an account — being in the tournament has nothing to do with being rateable. */
  members: Member[]
  me: { id: number; name: string }
}

type Side = 'home' | 'away'

/**
 * One team's slot: tap it to arm that side, then names picked below land here. Declared at module
 * level rather than inside the form — a component created during render is a new type every pass,
 * which would remount (and reset) on every keystroke in the search box.
 */
function SideBox({ side, ids, label, armed, onArm, onRemove, nameOf }: {
  side: Side
  ids: number[]
  label: string
  armed: boolean
  onArm: (side: Side) => void
  onRemove: (side: Side, id: number) => void
  nameOf: (id: number) => string
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onArm(side)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onArm(side) } }}
      aria-pressed={armed}
      className={cn(
        'cursor-pointer rounded-lg border p-2.5 min-h-[5.5rem] transition-colors',
        armed ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50',
      )}
    >
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">{ids.length}</span>
      </div>
      {ids.length === 0 ? (
        <p className="text-xs text-muted-foreground">{armed ? 'Tap a name below' : 'Tap here, then pick names'}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ids.map(id => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
              {nameOf(id)}
              <button
                type="button"
                aria-label={`Remove ${nameOf(id)}`}
                onClick={e => { e.stopPropagation(); onRemove(side, id) }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Log a game played outside the league, with sides of any size.
 *
 * The lunchtime game is 2v3 or 4v4 as often as it's 1v1, so this is a two-team builder rather than
 * an opponent dropdown: search the whole account list, tap a name to drop them onto whichever side
 * is armed. Every account is eligible, which is the point — everyone who actually played gets a
 * rating out of it.
 *
 * Two steps: build the sides and pick the winner, then confirm. A recorded game moves every listed
 * player's rating immediately, so a mis-tap is a real edit to other people's numbers.
 */
export default function RecordEloGameForm({ members, me }: Props) {
  const { run, loading } = useApiAction()
  const [home, setHome] = useState<number[]>([me.id])
  const [away, setAway] = useState<number[]>([])
  const [arm, setArm] = useState<Side>('away')
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Outcome | null>(null)

  const byId = useMemo(() => new Map(members.map(m => [m.id, m])), [members])
  const nameOf = (id: number) => byId.get(id)?.name ?? '—'

  const matches = useMemo(() => {
    const taken = new Set([...home, ...away])
    const q = query.trim().toLowerCase()
    return members
      .filter(m => !taken.has(m.id))
      .filter(m => !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 40)
  }, [members, query, home, away])

  const allTaken = home.length + away.length >= members.length

  function add(id: number) {
    ;(arm === 'home' ? setHome : setAway)(cur => (cur.includes(id) ? cur : [...cur, id]))
    setQuery('')
    setPending(null)
  }

  function remove(side: Side, id: number) {
    ;(side === 'home' ? setHome : setAway)(cur => cur.filter(x => x !== id))
    setPending(null)
  }

  const ready = home.length > 0 && away.length > 0

  async function commit() {
    if (!pending || !ready) return
    const ok = await run('/api/elo/games', {
      method: 'POST',
      body: {
        homePlayerIds: home,
        awayPlayerIds: away,
        homeSets: pending.homeSets,
        awaySets: pending.awaySets,
      },
      success: 'Game recorded — ratings updated',
    })
    if (ok) { setHome([me.id]); setAway([]); setPending(null); setQuery(''); setArm('away') }
  }

  if (pending) {
    const homeWon = pending.homeSets > pending.awaySets
    return (
      <ConfirmResultPanel
        score={<>
          <span className={homeWon ? '' : 'text-muted-foreground'}>{joinNames(home.map(nameOf))}</span>
          <span className="font-mono"> {pending.homeSets} – {pending.awaySets} </span>
          <span className={homeWon ? 'text-muted-foreground' : ''}>{joinNames(away.map(nameOf))}</span>
        </>}
        note={<>Counts immediately and moves every listed player&apos;s rating. Anyone who played can correct it afterwards.</>}
        confirmLabel="Confirm"
        loading={loading}
        onConfirm={commit}
        onBack={() => setPending(null)}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <SideBox side="home" ids={home} label="Side A" armed={arm === 'home'} onArm={setArm} onRemove={remove} nameOf={nameOf} />
        <SideBox side="away" ids={away} label="Side B" armed={arm === 'away'} onArm={setArm} onRemove={remove} nameOf={nameOf} />
      </div>

      <div>
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search a name to add to ${arm === 'home' ? 'Side A' : 'Side B'}…`}
          className="mb-2"
        />
        <div className="max-h-40 overflow-y-auto rounded-lg border divide-y">
          {matches.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {allTaken ? 'Everyone is already on a side.' : 'No one matches that search.'}
            </p>
          ) : matches.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => add(m.id)}
              className="w-full flex items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
            >
              <span className="shrink-0">{m.name}{m.id === me.id && ' (you)'}</span>
              <span className="italic text-muted-foreground text-xs truncate">{m.email}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-muted-foreground mb-2">Who won, and how?</p>
        <div className="grid grid-cols-2 gap-2">
          {(['home', 'away'] as const).map(side => (
            <div key={side} className="space-y-2">
              {OUTCOMES.filter(o => o.winner === side).map(o => (
                <OutcomeButton
                  key={o.detail}
                  label={`${side === 'home' ? 'Side A' : 'Side B'} won`}
                  detail={o.detail}
                  disabled={loading || !ready}
                  onClick={() => {
                    if (!ready) { toast.error('Both sides need at least one player'); return }
                    setPending(o)
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Counts for ELO only — it never touches the league table. Sides can be uneven: each is rated
        on its players&apos; average, so a bigger team isn&apos;t automatically a stronger one.
      </p>
    </div>
  )
}
