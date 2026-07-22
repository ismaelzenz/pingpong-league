import { requireSession } from '@/lib/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getLiveTournament } from '@/lib/tournament'
import AppNav from '@/components/layout/AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  const [user, tournament] = await Promise.all([
    db.select({ avatarColor: users.avatarColor }).from(users).where(eq(users.id, session.userId)).then(r => r[0]),
    getLiveTournament(),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav name={session.name} email={session.email} isAdmin={session.isAdmin} avatarColor={user?.avatarColor ?? null} tournamentName={tournament?.name ?? null} />
      {/* pb-24 on mobile clears the fixed bottom tab bar (h-16) + iOS home indicator; the bar
          is sm:hidden, so desktop reverts to the normal py-6 spacing. */}
      <main className="flex-1 container mx-auto px-4 pt-6 pb-24 sm:pb-6 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
