import { format, startOfWeek } from 'date-fns'

/** Today's calendar date as a 'yyyy-MM-dd' string (UTC), used for matchday-week comparisons. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

/** The Monday of the week containing `date`, as 'yyyy-MM-dd'. */
export function mondayOf(date: string | Date): string {
  return format(startOfWeek(new Date(date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

/** Human-readable week range, e.g. "Jun 3 – Jun 9, 2025". */
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  return `${format(new Date(weekStart), 'MMM d')} – ${format(new Date(weekEnd), 'MMM d, yyyy')}`
}
