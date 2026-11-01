import { format, startOfWeek, differenceInCalendarDays, addDays } from 'date-fns'

/**
 * Today's calendar date as a 'yyyy-MM-dd' string, in the league's timezone (everyone plays in
 * Amsterdam). Using local days rather than UTC keeps matchday-week boundaries aligned with real
 * days — e.g. a result entered late Monday evening isn't treated as still "Sunday" (UTC).
 * 'en-CA' formats as yyyy-MM-dd.
 */
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
}

/** The Monday of the week containing `date`, as 'yyyy-MM-dd'. */
export function mondayOf(date: string | Date): string {
  return format(startOfWeek(new Date(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/** Human-readable week range, e.g. "Jun 3 – Jun 9, 2025". */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${format(new Date(weekStart), 'MMM d')} – ${format(new Date(weekEnd), 'MMM d, yyyy')}`
}

export interface Deadline {
  text: string
  urgent: boolean   // ≤2 days left, or overdue — worth highlighting
  overdue: boolean
}

/**
 * Urgency of playing a game within its matchday week, or null when there's nothing to nudge
 * (future week not started, or no dates). "Ends today" / "2 days left" / "Overdue".
 */
export function deadlineLabel(weekStart: string | null, weekEnd: string | null): Deadline | null {
  if (!weekStart || !weekEnd) return null
  const today = todayISO()
  if (today > weekEnd) return { text: 'Overdue', urgent: true, overdue: true }
  if (today < weekStart) return null // week hasn't started — no urgency yet
  const days = differenceInCalendarDays(new Date(weekEnd), new Date(today))
  if (days <= 0) return { text: 'Ends today', urgent: true, overdue: false }
  if (days === 1) return { text: '1 day left', urgent: true, overdue: false }
  return { text: `${days} days left`, urgent: days <= 2, overdue: false }
}

/** A short display date — "3 Jun", or "3 Jun 2025" when it isn't this year. */
export function shortDate(iso: string): string {
  const d = new Date(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** A compact Mon–Fri range for list rows: "Oct 26 – 30", or "Oct 30 – Nov 3" across months. */
export function shortRange(start: string, end: string): string {
  const a = new Date(start), b = new Date(end)
  return a.getMonth() === b.getMonth() ? `${format(a, 'MMM d')} – ${format(b, 'd')}` : `${format(a, 'MMM d')} – ${format(b, 'MMM d')}`
}

/** How long ago a matchday ended, for backlog lists: "1 week overdue", "3 weeks overdue". */
export function overdueLabel(weekEnd: string): { text: string; weeks: number } {
  const weeks = Math.max(1, Math.ceil(differenceInCalendarDays(new Date(todayISO()), new Date(weekEnd)) / 7))
  return { text: `${weeks} week${weeks === 1 ? '' : 's'} overdue`, weeks }
}

/**
 * The break between two consecutive matchdays, if the schedule skips any weeks between them —
 * e.g. "Dec 21 – Jan 1" for a winter break. Null when they're back to back.
 */
export function breakBetween(prevWeekEnd: string | null, nextWeekStart: string | null): string | null {
  if (!prevWeekEnd || !nextWeekStart) return null
  // A normal gap is the weekend: Friday → Monday is 3 days.
  if (differenceInCalendarDays(new Date(nextWeekStart), new Date(prevWeekEnd)) <= 3) return null
  return shortRange(format(addDays(new Date(prevWeekEnd), 3), 'yyyy-MM-dd'), format(addDays(new Date(nextWeekStart), -3), 'yyyy-MM-dd'))
}
