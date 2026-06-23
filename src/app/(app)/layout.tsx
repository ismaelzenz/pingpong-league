import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import AppNav from '@/components/AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const user = await db.select({ avatarColor: users.avatarColor }).from(users).where(eq(users.id, session.userId)).then(r => r[0])

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav name={session.name} email={session.email} isAdmin={session.isAdmin} avatarColor={user?.avatarColor ?? null} />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
