'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Hourglass } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { buttonVariants } from '@/components/ui/button'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import ResultChip from '@/components/common/ResultChip'
import DeltaText from '@/components/common/DeltaText'
import Disclosure from '@/components/common/Disclosure'
import { cn } from '@/lib/utils'

type Person = { id: number; name: string; avatarColor: string | null }

/** One of the viewer's games, sorted into where it belongs on the page by the server. */
export interface MyGameItem {
  id: number
  opponent: Person
  /** "Matchday 7 · Oct 5–9" or "Catch-up game". */
  label: string
  bucket: 'catchUp' | 'thisWeek' | 'upcoming' | 'played'
  /** Catch-up only: "3 weeks overdue". */
  overdue?: string
  postponed: boolean
  /** Upcoming only: the month heading it sits under once the list is expanded. */
  month?: string
  /** Played only, from the viewer's side. */
  result?: { won: boolean; mySets: number; oppSets: number; forfeited: boolean }
  eloDelta?: number | null
}

/** Upcoming games shown before the rest fold away under "Show N more". */
const SHOW_UPCOMING = 3

/**
 * The My games page body: Upcoming / Played tabs, filterable by opponent. Upcoming runs in order of
 * urgency — games owed, this week's, then the rest — and only games that are actually due get an
 * "Enter result" button; any other game still opens with a tap to enter an early result.
 */
export default function MyGamesView({ me, games, featuredTitle }: {
  me: Person
  games: MyGameItem[]
  /** "This week", or "Next up" between matchdays. */
  featuredTitle: string
}) {
  const [tab, setTab] = useState<'upcoming' | 'played'>('upcoming')
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? games.filter(g => g.opponent.name.toLowerCase().includes(q)) : games
  }, [games, query])

  const catchUp = shown.filter(g => g.bucket === 'catchUp')
  const thisWeek = shown.filter(g => g.bucket === 'thisWeek')
  const upcoming = shown.filter(g => g.bucket === 'upcoming')
  const played = shown.filter(g => g.bucket === 'played')
  const upcomingCount = catchUp.length + thisWeek.length + upcoming.length

  const tabBtn = (key: typeof tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      aria-pressed={tab === key}
      className={cn('flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-none',
        tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
    >
      {label} <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg bg-muted p-1">
          {tabBtn('upcoming', 'Upcoming', upcomingCount)}
          {tabBtn('played', 'Played', played.length)}
        </div>
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Filter by opponent…" className="sm:w-56" />
      </div>

      {tab === 'upcoming' ? (
        upcomingCount === 0 ? (
          <Empty text={query ? 'No upcoming games against anyone matching that.' : 'Nothing left to play — season done!'} />
        ) : (
          <>
            {catchUp.length > 0 && (
              <Section title={<><Hourglass className="h-4 w-4" /> To catch up</>} count={catchUp.length} tone="text-orange-700 dark:text-orange-400">
                <Rows>{catchUp.map(g => <GameItemRow key={g.id} me={me} g={g} cta />)}</Rows>
              </Section>
            )}
            {thisWeek.length > 0 && (
              <Section title={featuredTitle} count={thisWeek.length}>
                <Rows className="me-card">{thisWeek.map(g => <GameItemRow key={g.id} me={me} g={g} cta />)}</Rows>
              </Section>
            )}
            {upcoming.length > 0 && (
              <Section title="Coming up" count={upcoming.length}>
                <Rows>{upcoming.slice(0, SHOW_UPCOMING).map(g => <GameItemRow key={g.id} me={me} g={g} />)}</Rows>
                {upcoming.length > SHOW_UPCOMING && (
                  <Disclosure label={`Show ${upcoming.length - SHOW_UPCOMING} more`}>
                    <MonthGroups me={me} games={upcoming.slice(SHOW_UPCOMING)} after={upcoming[SHOW_UPCOMING - 1]?.month} />
                  </Disclosure>
                )}
              </Section>
            )}
          </>
        )
      ) : played.length === 0 ? (
        <Empty text={query ? 'No played games against anyone matching that.' : 'No games played yet.'} />
      ) : (
        <Rows>{played.map(g => <GameItemRow key={g.id} me={me} g={g} />)}</Rows>
      )}
    </div>
  )
}

function Section({ title, count, tone, children }: { title: React.ReactNode; count: number; tone?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className={cn('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground', tone)}>
        {title} <span className="tabular-nums">· {count}</span>
      </h2>
      {children}
    </section>
  )
}

function Rows({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('divide-y overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10', className)}>{children}</div>
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl bg-card py-10 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">{text}</p>
}

/** The folded-away upcoming games, under a heading per month (the first one only if it's new). */
function MonthGroups({ me, games, after }: { me: Person; games: MyGameItem[]; after?: string }) {
  const groups: { month: string; games: MyGameItem[] }[] = []
  for (const g of games) {
    const month = g.month ?? ''
    if (groups.at(-1)?.month !== month) groups.push({ month, games: [] })
    groups.at(-1)!.games.push(g)
  }
  return (
    <div className="space-y-3 pt-1">
      {groups.map((grp, i) => (
        <div key={grp.month + i} className="space-y-2">
          {(i > 0 || grp.month !== after) && grp.month && (
            <p className="px-1 text-xs font-medium text-muted-foreground">{grp.month}</p>
          )}
          <Rows>{grp.games.map(g => <GameItemRow key={g.id} me={me} g={g} />)}</Rows>
        </div>
      ))}
    </div>
  )
}

/**
 * One game as a row: both avatars, "You vs Ana", when it is — and on the right, either the result
 * (played), an "Enter result" button (`cta`, for games that are due), or a status.
 */
function GameItemRow({ me, g, cta = false }: { me: Person; g: MyGameItem; cta?: boolean }) {
  return (
    <Link href={`/games/${g.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
      {g.result ? (
        <ResultChip won={g.result.won} className="shrink-0 text-[10px]" />
      ) : (
        <div className="flex shrink-0 -space-x-1.5">
          <PlayerAvatar name={me.name} avatarColor={me.avatarColor} className="h-7 w-7 ring-2 ring-card" fallbackClassName="text-[10px]" />
          <PlayerAvatar name={g.opponent.name} avatarColor={g.opponent.avatarColor} className="h-7 w-7 ring-2 ring-card" fallbackClassName="text-[10px]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {g.result ? 'vs ' : <>You<span className="font-normal text-muted-foreground"> vs </span></>}{g.opponent.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {g.label}
          {g.overdue && <span className="font-medium text-orange-600 dark:text-orange-400"> · {g.overdue}</span>}
          {g.postponed && <span className="font-medium text-sky-600 dark:text-sky-400"> · Postponed</span>}
          {g.result?.forfeited && ' · Forfeit'}
        </p>
      </div>
      {g.result ? (
        <span className="flex shrink-0 items-center gap-3 text-sm">
          <span className="font-mono font-semibold tabular-nums">{g.result.mySets}–{g.result.oppSets}</span>
          <span className="w-9 text-right text-xs">
            {g.eloDelta != null ? <DeltaText value={g.eloDelta} /> : <span className="text-muted-foreground">—</span>}
          </span>
        </span>
      ) : cta ? (
        // Inside the row's link, so a span styled as a button rather than a nested link.
        // "Enter" on a phone, so the overdue note beside it isn't cut off; no chevron needed then.
        <span className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'shrink-0')}>
          Enter<span className="-ml-0.5 hidden sm:inline">result</span>
        </span>
      ) : null}
      {!(cta && !g.result) && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </Link>
  )
}
