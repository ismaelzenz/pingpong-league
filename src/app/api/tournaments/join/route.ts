import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'

// Self-serve joining is currently disabled: clicking an invite link no longer enrolls a
// player. An admin adds players from the admin panel instead. Kept as a 403 so any stale
// client that still calls it fails clearly rather than silently enrolling.
export async function POST() {
  const guard = await requireUser()
  if (guard instanceof NextResponse) return guard

  return NextResponse.json(
    { error: 'Joining is handled by an admin — ask them to add you to the tournament.' },
    { status: 403 },
  )
}
