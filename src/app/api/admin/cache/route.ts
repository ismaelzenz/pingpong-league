import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiAuth'
import { clearAllCaches } from '@/lib/cache'

/**
 * Drop every cached read. The app invalidates on its own writes; this is for data changed from
 * outside it (the Turso dashboard, a migration, a script), which would otherwise show until the
 * cache's max age runs out.
 */
export async function POST() {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  clearAllCaches()
  return NextResponse.json({ ok: true })
}
