import { requireSession } from '@/lib/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { isNull } from 'drizzle-orm'
import DailyTournament from '@/components/dailytournament/DailyTournament'

// Self-serve daily tournament builder/runner. Any logged-in user can set up a league or knockout
// (singles or doubles), pick app users or add guests, and enter results. State lives in the
// browser (localStorage) — no database writes. Fullscreen, TV-friendly.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Daily tournament' }

export default async function DailyTournamentPage() {
  await requireSession()
  const appUsers = await db.select({ id: users.id, name: users.name, avatarColor: users.avatarColor }).from(users).where(isNull(users.archivedAt))
  const list = appUsers
    .map(u => ({ id: `u-${u.id}`, name: u.name, color: u.avatarColor ?? '#64748b' }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return <DailyTournament appUsers={list} />
}
