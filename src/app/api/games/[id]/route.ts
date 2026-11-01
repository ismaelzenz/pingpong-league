import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { games, matchdays, participants } from '@/lib/db/schema'
import { requireUser, requireAdmin } from '@/lib/apiAuth'
import { sendPush } from '@/lib/push'
import { isValidResult } from '@/lib/gameResult'
import { winnersOf } from '@/lib/elo'
import { syncEloForGame } from '@/lib/eloLedger'
import { afterLeagueChange } from '@/lib/cache'
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
    // A postponed game can be scored directly once it's played (no need to un-postpone first).
    if (game.status !== 'pending' && game.status !== 'postponed') {
      return NextResponse.json({ error: 'Result already entered or game finished' }, { status: 400 })
    }
    if (!isParticipant) return NextResponse.json({ error: 'Only the players can enter a result' }, { status: 403 })
    if (!isValidResult(homeSets, awaySets)) return NextResponse.json({ error: 'Invalid result' }, { status: 400 })

    // A future matchday is no longer a barrier. People play ahead — someone's away next week, or
    // two players are both free today — and refusing the result just meant it got entered late or
    // not at all. The matchday still says when the game was *scheduled*; `submittedAt` records
    // when it was actually played.

    // Auto-approved: whichever player was quicker to the phone settles it. `submittedAt` doubles as
    // when the game was played — it's the moment a player stood there and typed the score in — and
    // it's what orders the ELO ledger, so it's set once here and never moved by a later correction.
    const now = new Date().toISOString()
    await db.update(games).set({
      homeSets,
      awaySets,
      status: 'confirmed',
      submittedBy: session.userId,
      submittedAt: now,
      // No confirmedBy: nobody confirmed it, the system approved it on entry.
      confirmedAt: now,
      updatedAt: now,
    }).where(eq(games.id, gameId))

    await syncEloForGame('league', gameId, winnersOf({ homePlayerIds: [game.homePlayerId], awayPlayerIds: [game.awayPlayerId], homeSets, awaySets }))

    // Tell the opponent it's on the board — and that they can correct it if it's wrong.
    const opponentId = game.homePlayerId === session.userId ? game.awayPlayerId : game.homePlayerId
    after(() => sendPush(opponentId, {
      title: 'Result recorded',
      body: `${session.name} entered ${homeSets}–${awaySets}. Tap to check it — you can report it if it's wrong.`,
      url: `/games/${gameId}`,
    }, 'resultRecorded'))

  } else if (action === 'report') {
    // "Report a wrong result": either player can overwrite a recorded score with the right one.
    // No approval step here either — the correction stands the moment it's submitted.
    if (game.status !== 'confirmed') return NextResponse.json({ error: 'No recorded result to correct' }, { status: 400 })
    if (!isParticipant) return NextResponse.json({ error: 'Only the players can correct a result' }, { status: 403 })
    if (!isValidResult(homeSets, awaySets)) return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
    if (homeSets === game.homeSets && awaySets === game.awaySets) {
      return NextResponse.json({ error: 'That is already the recorded result' }, { status: 400 })
    }

    const now = new Date().toISOString()
    await db.update(games).set({
      homeSets,
      awaySets,
      correctedBy: session.userId,
      correctedAt: now,
      updatedAt: now,
      // submittedAt is deliberately untouched: the game was still played when it was played.
    }).where(eq(games.id, gameId))

    // Ratings only ever depended on who won, so a 2–0 → 2–1 fix reshuffles the league table and
    // leaves every rating alone; a flipped winner replays the ledger from that game onward.
    const eloChanged = await syncEloForGame('league', gameId, winnersOf({ homePlayerIds: [game.homePlayerId], awayPlayerIds: [game.awayPlayerId], homeSets, awaySets }))
    afterLeagueChange()

    const otherId = game.homePlayerId === session.userId ? game.awayPlayerId : game.homePlayerId
    after(() => sendPush(otherId, {
      title: 'Result corrected',
      body: `${session.name} changed the score to ${homeSets}–${awaySets}.`,
      url: `/games/${gameId}`,
    }, 'resultCorrected'))

    return NextResponse.json({ ok: true, eloChanged })

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

    const now = new Date().toISOString()
    await db.update(games).set({
      homeSets,
      awaySets,
      status: 'confirmed',
      confirmedBy: session.userId,
      confirmedAt: now,
      // A game the admin scores from scratch has no entry timestamp yet — give it one, since
      // that's what places it in the ELO ledger's chronology.
      submittedAt: game.submittedAt ?? now,
      updatedAt: now,
    }).where(eq(games.id, gameId))

    await syncEloForGame('league', gameId, winnersOf({ homePlayerIds: [game.homePlayerId], awayPlayerIds: [game.awayPlayerId], homeSets, awaySets }))

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

    // A forfeit has no winner, so it drops out of ELO entirely — if the game had been rated
    // before, this pulls it back out and replays what came after.
    await syncEloForGame('league', gameId, null)

  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // Every branch that reaches here wrote to the game.
  afterLeagueChange()
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
  afterLeagueChange()
  return NextResponse.json({ ok: true })
}
