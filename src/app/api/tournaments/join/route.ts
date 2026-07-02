import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

// Self-serve joining is currently disabled: clicking an invite link no longer enrolls a
// player. An admin adds players from the admin panel instead. Kept as a 403 so any stale
// client that still calls it fails clearly rather than silently enrolling.
export async function POST() {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json(
    { error: 'Joining is handled by an admin — ask them to add you to the tournament.' },
    { status: 403 },
  )
}
