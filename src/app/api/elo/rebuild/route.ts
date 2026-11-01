import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/apiAuth'
import { rebuildEloLedger } from '@/lib/eloLedger'
import { afterEloGameChange } from '@/lib/cache'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Replay every rated game from scratch. The ledger is derived, so this is always safe to run —
 * it's the escape hatch for backfilling a database whose games predate ELO, or for putting things
 * right if a manual DB edit left the chain out of step.
 */
export async function POST() {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { games, entries } = await rebuildEloLedger()
  afterEloGameChange()
  return NextResponse.json({ ok: true, games, entries })
}
