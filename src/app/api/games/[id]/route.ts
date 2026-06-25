import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { games, matchdays, participants } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { eq } from 'drizzle-orm'

// A matchday an admin may still restructure: it hasn't started yet.
async function getEditableMatchday(matchdayId: number) {
  const md = await db.select({ id: matchdays.id, weekStart: matchdays.weekStart }).from(matchdays).where(eq(matchdays.id, matchdayId)).then(r => r[0])
  const today = new Date().toISOString().split('T')[0]
  const isFuture = !!md?.weekStart && md.weekStart > today
  return { md, isFuture }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    const today = new Date().toISOString().split('T')[0]
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

  } else if (action === 'confirm') {
    if (game.status !== 'result_entered') return NextResponse.json({ error: 'Nothing to confirm' }, { status: 400 })
    if (session.userId === game.submittedBy) return NextResponse.json({ error: 'Cannot confirm your own result' }, { status: 403 })

    await db.update(games).set({
      status: 'confirmed',
      confirmedBy: session.userId,
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

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

  } else if (action === 'postpone') {
    if (!['pending', 'postponed'].includes(game.status)) return NextResponse.json({ error: 'Cannot postpone' }, { status: 400 })

    await db.update(games).set({
      status: game.status === 'postponed' ? 'pending' : 'postponed',
      updatedAt: new Date().toISOString(),
    }).where(eq(games.id, gameId))

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
  const session = await getSession()
  if (!session.userId || !session.isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

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

function isValidResult(h: number, a: number) {
  return (h === 2 && (a === 0 || a === 1)) || (a === 2 && (h === 0 || h === 1))
}
