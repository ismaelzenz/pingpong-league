import { NextRequest, NextResponse } from 'next/server'
import { getLiveTournament } from '@/lib/tournament'
import { autoConfirmEndedMatchdays } from '@/lib/autoConfirm'
import { todayISO } from '@/lib/dates'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Daily job (Vercel cron): once a matchday has ended, auto-confirm any of its results still stuck
// "awaiting confirmation", so a forgotten confirmation doesn't hold up the scoreboard.
//
// Secured with CRON_SECRET like the reminder cron: Vercel sends `Authorization: Bearer <secret>`.
// If CRON_SECRET isn't set (e.g. local testing) the route is open.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tournament = await getLiveTournament()
  if (!tournament || tournament.status !== 'active') {
    return NextResponse.json({ ok: true, reason: 'no active tournament', confirmed: 0 })
  }

  const confirmed = await autoConfirmEndedMatchdays(tournament.id, todayISO())
  return NextResponse.json({ ok: true, confirmed })
}
