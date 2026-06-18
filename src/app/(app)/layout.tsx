import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import AppNav from '@/components/AppNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav name={session.name} email={session.email} isAdmin={session.isAdmin} />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
