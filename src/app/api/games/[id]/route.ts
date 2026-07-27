import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { games, matchdays, participants } from '@/lib/db/schema'
import { requireUser, requireAdmin } from '@/lib/apiAuth'
import { sendPush } from '@/lib/push'
import { isValidResult } from '@/lib/gameResult'
import { todayISO } from '@/lib/dates'
import { eq } from 'drizzle-orm'

// A matchday an admin may still restructure: it hasn't started yet.
async function getEditableMatchday(matchdayId: number) {
  const md = await db.select({ id: matchdays.id, weekStart: matchdays.weekStart }).from(matchdays).where(eq(matchdays.id, matchdayId)).then(r => r[0])
  const today = todayISO()
  const isFuture = !!md?.weekStart && md.weekStart > today
  return { md, isFuture }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const gameId = parseInt(id)
  const body = await req.json()

  const game = await db.select().from(games).where(eq(games.id, gameId)).get()
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isParticipant = session.userId === game.homePlayerId || session.userId === game.awayPlayerId
  if (!isParticipant && !session.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, homeSets, awaySets } = body

  if (action === 'enter') {
    if (game.status !== 'pending') return NextResponse.json({ error: 'Game not pending' }, { status: 400 })
    if (!isValidResult(homeSets, awaySets)) return NextResponse.json({ error: 'Invalid result' }, { status: 400 })

    const matchday = await db.select({ weekStart: matchdays.weekStart }).from(matchdays).where(eq(matchdays.id, game.matchdayId)).then(r => r[0])
    const today = todayISO()
    if (!matchday?.weekStart || matchday.weekStart > today) {
      return NextResponse.json({ error: 'Cannot enter result for a future matchday' }, { status: 400 })
    }

    await db.update(games).set({
      homeSets,
      awaySets,
      status: 'result_entered',
      submittedBy: session.userId,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

    // Nudge the opponent to confirm — fired after the response so it doesn't add latency.
    const opponentId = game.homePlayerId === session.userId ? game.awayPlayerId : game.homePlayerId
    after(() => sendPush(opponentId, {
      title: 'Confirm a result',
      body: `${session.name} entered ${homeSets}–${awaySets}. Tap to confirm.`,
      url: `/games/${gameId}`,
    }, 'resultToConfirm'))

  } else if (action === 'confirm') {
    if (game.status !== 'result_entered') return NextResponse.json({ error: 'Nothing to confirm' }, { status: 400 })
    if (session.userId === game.submittedBy) return NextResponse.json({ error: 'Cannot confirm your own result' }, { status: 403 })

    await db.update(games).set({
      status: 'confirmed',
      confirmedBy: session.userId,
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

    if (game.submittedBy) {
      const submitterId = game.submittedBy
      after(() => sendPush(submitterId, {
        title: 'Result confirmed',
        body: `${session.name} confirmed your result.`,
        url: `/games/${gameId}`,
      }, 'resultConfirmed'))
    }

  } else if (action === 'dispute') {
    if (game.status !== 'result_entered') return NextResponse.json({ error: 'Nothing to dispute' }, { status: 400 })
    if (session.userId === game.submittedBy) return NextResponse.json({ error: 'Cannot dispute your own result' }, { status: 403 })

    await db.update(games).set({
      homeSets: null,
      awaySets: null,
      status: 'pending',
      submittedBy: null,
      submittedAt: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

    if (game.submittedBy) {
      const submitterId = game.submittedBy
      after(() => sendPush(submitterId, {
        title: 'Result disputed',
        body: `${session.name} disputed the result — please re-enter the score.`,
        url: `/games/${gameId}`,
      }, 'resultDisputed'))
    }

  } else if (action === 'postpone') {
    if (!['pending', 'postponed'].includes(game.status)) return NextResponse.json({ error: 'Cannot postpone' }, { status: 400 })

    const becomingPostponed = game.status !== 'postponed'
    await db.update(games).set({
      status: becomingPostponed ? 'postponed' : 'pending',
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

    // Notify the other player(s) when a game is postponed (not when it's un-postponed).
    // If an admin who isn't in the game postpones it, both players are notified.
    if (becomingPostponed) {
      const recipients = [game.homePlayerId, game.awayPlayerId].filter(id => id !== session.userId)
      after(() => Promise.all(recipients.map(id => sendPush(id, {
        title: 'Game postponed',
        body: `${session.name} postponed your game — it'll still need to be played.`,
        url: `/games/${gameId}`,
      }, 'gamePostponed'))))
    }

  } else if (action === 'edit-players') {
    // Admin fixes the line-up of a not-yet-started matchday.
    if (!session.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    if (['confirmed', 'forfeited', 'result_entered'].includes(game.status)) {
      return NextResponse.json({ error: 'Cannot edit a game that already has a result' }, { status: 400 })
    }
    const { isFuture } = await getEditableMatchday(game.matchdayId)
    if (!isFuture) return NextResponse.json({ error: 'Can only edit future matchdays' }, { status: 400 })

    const homePlayerId = Number(body.homePlayerId)
    const awayPlayerId = Number(body.awayPlayerId)
    if (!homePlayerId || !awayPlayerId || homePlayerId === awayPlayerId) {
      return NextResponse.json({ error: 'Pick two different players' }, { status: 400 })
    }
    const enrolled = await db.select({ userId: participants.userId }).from(participants)
      .where(eq(participants.tournamentId, game.tournamentId))
    const ids = new Set(enrolled.map(p => p.userId))
    if (!ids.has(homePlayerId) || !ids.has(awayPlayerId)) {
      return NextResponse.json({ error: 'Both players must be in this tournament' }, { status: 400 })
    }

    await db.update(games).set({
      homePlayerId,
      awayPlayerId,
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

  } else if (action === 'admin-set-result') {
    // Admin correction of a result (works even on already-confirmed/forfeited games).
    if (!session.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    if (!isValidResult(homeSets, awaySets)) return NextResponse.json({ error: 'Invalid result' }, { status: 400 })

    await db.update(games).set({
      homeSets,
      awaySets,
      status: 'confirmed',
      confirmedBy: session.userId,
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

  } else if (action === 'forfeit') {
    if (!session.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    if (['confirmed', 'forfeited'].includes(game.status)) {
      return NextResponse.json({ error: 'Cannot forfeit a completed game' }, { status: 400 })
    }
    await db.update(games).set({
      status: 'forfeited',
      homeSets: 0,
      awaySets: 0,
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const gameId = parseInt(id)
  const game = await db.select().from(games).where(eq(games.id, gameId)).get()
  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (['confirmed', 'forfeited', 'result_entered'].includes(game.status)) {
    return NextResponse.json({ error: 'Cannot remove a game that already has a result' }, { status: 400 })
  }
  const { isFuture } = await getEditableMatchday(game.matchdayId)
  if (!isFuture) return NextResponse.json({ error: 'Can only edit future matchdays' }, { status: 400 })

  await db.delete(games).where(eq(games.id, gameId))
  return NextResponse.json({ ok: true })
}
