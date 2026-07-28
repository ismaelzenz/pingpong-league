import { format, startOfWeek, differenceInCalendarDays } from 'date-fns'

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
