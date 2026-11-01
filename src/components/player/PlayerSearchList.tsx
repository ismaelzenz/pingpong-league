'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface PlayerOption {
  id: number
  name: string
  /** Shown muted after the name, and searchable — tells two people with the same name apart. */
  email?: string
}

interface Props {
  options: PlayerOption[]
  onPick: (id: number) => void
  placeholder?: string
  /** Shown when nothing matches the search. */
  emptyText?: string
  /** The viewer, marked "(you)" in the list. */
  currentUserId?: number
  autoFocus?: boolean
  /** Height of the scrolling list. */
  listClassName?: string
}

/**
 * Search box over a scrolling list of players; tapping a name picks it and clears the search.
 * The one way to choose players in the app — inline in the ELO game form, and inside the chart's
 * "Add player" dropdown — so both look and behave the same.
 */
export default function PlayerSearchList({
  options, onPick, placeholder = 'Search a name…', emptyText = 'No one matches that search.',
  currentUserId, autoFocus, listClassName = 'max-h-40',
}: Props) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options
      .filter(o => !q || o.name.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q))
      .slice(0, 40)
  }, [options, query])

  return (
    <div>
      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="mb-2"
      />
      <div className={cn('overflow-y-auto rounded-lg border divide-y', listClassName)}>
        {matches.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">{query.trim() ? 'No one matches that search.' : emptyText}</p>
        ) : matches.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => { onPick(o.id); setQuery('') }}
            className="w-full flex items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
          >
            <span className="shrink-0">{o.name}{o.id === currentUserId && ' (you)'}</span>
            {o.email && <span className="italic text-muted-foreground text-xs truncate">{o.email}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
