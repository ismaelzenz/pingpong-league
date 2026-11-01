import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, matchdays } from '@/lib/db/schema'
import { and, eq, inArray, lte, gte } from 'drizzle-orm'
import { getLiveTournamentFresh } from '@/lib/data/tournaments'
import { sendPush } from '@/lib/services/push'
import { todayISO } from '@/lib/dates'
import { UNPLAYED_STATUSES } from '@/lib/domain/gameStatus'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Weekly nudge (run by a Vercel cron every Thursday): remind anyone who still hasn't played
// this week's game that the matchday ends Friday — two days left, today and tomorrow.
//
// Secured with CRON_SECRET: Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`
// on cron invocations when that env var is set. If it isn't set (e.g. local testing), the
// route is open — set it in production.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tournament = await getLiveTournamentFresh()
  if (!tournament || tournament.status !== 'active') {
    return NextResponse.json({ ok: true, reason: 'no active tournament', notified: 0 })
  }

  // The matchday whose Mon–Fri window contains today.
  const today = todayISO()
  const matchday = await db.select().from(matchdays)
    .where(and(
      eq(matchdays.tournamentId, tournament.id),
      lte(matchdays.weekStart, today),
      gte(matchdays.weekEnd, today),
    ))
    .then(r => r[0] ?? null)

  if (!matchday) {
    return NextResponse.json({ ok: true, reason: 'no matchday in progress today', notified: 0 })
  }

  // Regular (non catch-up) games in this matchday that still need playing.
  const unplayed = await db.select().from(games)
    .where(and(
      eq(games.matchdayId, matchday.id),
      eq(games.isCatchUp, false),
      inArray(games.status, [...UNPLAYED_STATUSES]),
    ))

  const playerIds = [...new Set(unplayed.flatMap(g => [g.homePlayerId, g.awayPlayerId]))]

  await Promise.all(playerIds.map(id => sendPush(id, {
    title: '🏓 2 days left to play',
    body: `Your Matchday ${matchday.number} game isn't played yet — it ends Friday. Tap to sort it out.`,
    url: '/my-games',
  }, 'weeklyReminder')))

  return NextResponse.json({ ok: true, matchday: matchday.number, notified: playerIds.length })
}
