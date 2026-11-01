import type { ReactNode } from 'react'
import { Medal } from 'lucide-react'
import PlayerAvatar from '@/components/player/PlayerAvatar'
import PlayerLink from '@/components/player/PlayerLink'
import FormDots from '@/components/player/FormDots'
import RankMovement from '@/components/common/RankMovement'
import type { StandingRow } from '@/lib/domain/standings'
import { cn, medal } from '@/lib/utils'

/**
 * Which stat columns to show:
 * - `full`    — every stat. In the app it trims itself to fit: a phone gets W–L and Pts, `sm` adds
 *               form, GP, W, L and set difference, `md` adds sets won/lost.
 * - `compact` — form, W, L and Pts, for a half-width summary like the dashboard's; a phone gets
 *               W–L and Pts.
 */
export type StandingsColumns = 'full' | 'compact'

interface Props {
  rows: StandingRow[]
  columns?: StandingsColumns
  /** `app` follows the site theme; `tv` is the office board — fixed dark, sized in vh, rows stretch. */
  size?: 'app' | 'tv'
  /** The viewer: their row is highlighted and names link to profiles. Omit it (the TV) for neither. */
  currentUserId?: number
  /** Recent-results dots. */
  showForm?: boolean
  /** ▲▼ rank change this matchday. */
  showMovement?: boolean
  /**
   * Keep the column headings pinned under the app's top bar while the page scrolls past a long
   * table. The parent must not clip its overflow (a Card does by default: pass `overflow-visible`).
   */
  stickyHeader?: boolean
}

type Col = 'form' | 'gp' | 'w' | 'l' | 'sw' | 'sl' | 'diff' | 'wl'

const HEAD: Record<Col, { label: string; title: string }> = {
  form: { label: 'Form', title: 'Last 5 results, newest on the right' },
  gp: { label: 'GP', title: 'Games played' },
  w: { label: 'W', title: 'Wins' },
  l: { label: 'L', title: 'Losses' },
  sw: { label: 'SW', title: 'Sets won' },
  sl: { label: 'SL', title: 'Sets lost' },
  diff: { label: '+/−', title: 'Set difference' },
  wl: { label: 'W–L', title: 'Wins–losses' },
}

/** Each column's visibility class per layout. A column missing from a layout isn't rendered. */
const LAYOUT: Record<'full' | 'compact' | 'tv', Partial<Record<Col, string>>> = {
  full: {
    form: 'hidden sm:table-cell', gp: 'hidden sm:table-cell', w: 'hidden sm:table-cell', l: 'hidden sm:table-cell',
    sw: 'hidden md:table-cell', sl: 'hidden md:table-cell', diff: 'hidden sm:table-cell', wl: 'sm:hidden',
  },
  compact: { form: 'hidden sm:table-cell', w: 'hidden sm:table-cell', l: 'hidden sm:table-cell', wl: 'sm:hidden' },
  tv: { form: '', gp: '', w: '', l: '', sw: '', sl: '', diff: '' },
}

const STYLE = {
  app: {
    table: 'w-full text-sm',
    headRow: 'text-muted-foreground',
    // Opaque (card + a muted tint), so rows scrolling under a sticky header don't show through. The
    // underline is a shadow, not a border: a collapsed table's borders don't travel with sticky cells.
    head: 'px-3 py-3 font-medium bg-[color-mix(in_oklab,var(--muted)_30%,var(--card))] shadow-[inset_0_-1px_0_var(--border)]',
    row: 'border-b last:border-0 transition-colors',
    cell: 'px-3 py-2.5',
    edge: 'pl-2 sm:pl-3',
    rankText: 'text-muted-foreground',
    movement: 'text-[10px] leading-none sm:w-7 sm:text-center sm:text-xs',
    avatar: 'h-7 w-7',
    avatarText: 'text-xs',
    name: 'font-medium',
    muted: 'text-muted-foreground',
    win: 'text-green-600 dark:text-green-500',
    loss: 'text-red-500',
    pts: 'pr-4 text-lg font-bold',
    ptsHead: 'pr-4 text-foreground',
    dot: 'h-2 w-2',
  },
  tv: {
    table: 'w-full h-full',
    headRow: 'border-b border-white/10 text-[1.4vh] text-slate-400',
    head: 'px-[1.2vh] py-[0.4vh] font-medium',
    row: 'border-b border-white/5 last:border-0',
    cell: 'px-[1.2vh] py-[0.15vh] text-[1.9vh]',
    edge: 'pl-[1.6vh]',
    rankText: 'text-[2vh] font-black text-slate-300',
    movement: 'w-[3vh] text-center text-[1.6vh] font-semibold',
    avatar: 'h-[2.8vh] w-[2.8vh]',
    avatarText: 'text-[1.3vh]',
    name: 'text-[2.1vh] font-semibold',
    muted: 'text-slate-400',
    win: 'text-green-400 font-semibold',
    loss: 'text-red-400 font-semibold',
    pts: 'pr-[1.6vh] text-[2.4vh] font-black',
    ptsHead: 'pr-[1.6vh] font-bold',
    dot: 'h-[1vh] w-[1vh]',
  },
}

// Smart-TV browsers lack emoji fonts, so the board draws its medals as icons.
const TV_MEDAL = ['text-yellow-400', 'text-slate-300', 'text-amber-600']

/**
 * The league table — one component for the scoreboard page, the dashboard summary and the office
 * TV, so all three rank, colour and label players the same way. Props pick the columns and extras.
 */
export default function StandingsTable({
  rows, columns = 'full', size = 'app', currentUserId, showForm = true, showMovement = true, stickyHeader = false,
}: Props) {
  const s = STYLE[size]
  // Pinned just below the top bar (h-14 + its 1px border).
  const head = cn(s.head, stickyHeader && 'sticky top-[57px] z-10')
  const layout = LAYOUT[size === 'tv' ? 'tv' : columns]
  const cols = (Object.keys(HEAD) as Col[]).filter(c => c in layout && (c !== 'form' || showForm))
  // A phone has no room for the Form column, so there the dots sit under the name instead.
  const dotsUnderName = showForm && size === 'app' && 'sm:hidden'

  const cell = (c: Col, e: StandingRow): ReactNode => {
    const diff = e.setsWon - e.setsLost
    switch (c) {
      // A block-level flex, centred under its heading: inline dots would sit on the text baseline.
      case 'form': return <FormDots form={e.form} className="flex justify-center" dotClassName={s.dot} />
      case 'gp': return <span className={s.muted}>{e.gamesPlayed}</span>
      case 'w': return <span className={s.win}>{e.victories}</span>
      case 'l': return <span className={s.loss}>{e.losses}</span>
      case 'sw': return e.setsWon
      case 'sl': return e.setsLost
      case 'diff': return <span className={diff > 0 ? '' : s.muted}>{diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : '0'}</span>
      case 'wl': return <><span className={s.win}>{e.victories}</span><span className={s.muted}>–</span><span className={s.loss}>{e.losses}</span></>
    }
  }

  return (
    <table className={s.table}>
      <thead>
        <tr className={s.headRow}>
          <th className={cn(head, s.edge, 'pr-1 text-left', size === 'app' && 'rounded-tl-xl')}>#</th>
          <th className={cn(head, 'w-full px-2 text-left')}>Player</th>
          {cols.map(c => (
            <th key={c} className={cn(head, c === 'form' ? 'text-center' : 'text-right', layout[c])}>
              <abbr title={HEAD[c].title} className="no-underline">{HEAD[c].label}</abbr>
            </th>
          ))}
          <th className={cn(head, s.ptsHead, 'text-right', size === 'app' && 'rounded-tr-xl')}>Pts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(e => {
          const isMe = e.userId === currentUserId
          const name = (
            <>
              <PlayerAvatar name={e.name} avatarColor={e.avatarColor} className={cn(s.avatar, 'shrink-0')} fallbackClassName={s.avatarText} />
              <span className="min-w-0">
                <span className={cn('block truncate', s.name, isMe && 'me-text', currentUserId != null && !isMe && 'hover:underline')}>
                  {e.name}{isMe && ' (you)'}
                </span>
                {dotsUnderName !== false && <FormDots form={e.form} className={cn('mt-1', dotsUnderName)} dotClassName={s.dot} />}
              </span>
            </>
          )
          return (
            <tr key={e.userId} className={cn(s.row, isMe ? 'me-tint' : size === 'app' && 'hover:bg-muted/30')}>
              {/* A coloured left edge marks your row at a glance, even mid-scroll. */}
              <td className={cn(s.cell, s.edge, 'pr-1', size === 'app' && 'border-l-[3px]', isMe ? 'me-edge' : 'border-l-transparent')}>
                <div className={cn('flex items-center', size === 'app' ? 'flex-col sm:flex-row sm:gap-1.5' : 'gap-[0.8vh]')}>
                  <span className={cn('flex w-7 shrink-0 justify-center tabular-nums', size === 'tv' && 'w-[2.8vh]', s.rankText)}>
                    {size === 'tv' && e.rank <= 3
                      ? <Medal className={cn('h-[2.2vh] w-[2.2vh]', TV_MEDAL[e.rank - 1])} strokeWidth={2.2} />
                      : (size === 'app' && medal(e.rank)) || e.rank}
                  </span>
                  {showMovement && (
                    <span className={cn('shrink-0 tabular-nums', s.movement)}>
                      <RankMovement movement={e.movement} quiet />
                    </span>
                  )}
                </div>
              </td>
              <td className={cn(s.cell, 'max-w-0 px-2')}>
                {currentUserId != null
                  ? <PlayerLink userId={e.userId} currentUserId={currentUserId} className="flex min-w-0 items-center gap-2">{name}</PlayerLink>
                  : <div className="flex min-w-0 items-center gap-[1vh]">{name}</div>}
              </td>
              {cols.map(c => (
                <td key={c} className={cn(s.cell, 'whitespace-nowrap tabular-nums', c === 'form' ? 'text-center' : 'text-right', layout[c])}>{cell(c, e)}</td>
              ))}
              <td className={cn(s.cell, s.pts, 'text-right tabular-nums')}>{e.points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
