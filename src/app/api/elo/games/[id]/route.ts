import { NextRequest, NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { eloGamePlayers, eloGames, eloHistory } from '@/lib/db/schema'
import { requireUser } from '@/lib/auth/api'
import { sendPush } from '@/lib/services/push'
import { isValidResult } from '@/lib/domain/gameResult'
import { winnersOf } from '@/lib/domain/elo'
import { rebuildEloLedger, syncEloForGame } from '@/lib/services/eloLedger'
import { and, eq } from 'drizzle-orm'
import { afterEloGameChange } from '@/lib/cache'
import { readJson } from '@/lib/http'

/** Load a casual game plus its two sides, or null. */
async function loadGame(gameId: number) {
  const game = await db.select().from(eloGames).where(eq(eloGames.id, gameId)).then(r => r[0])
  if (!game) return null
  const players = await db.select().from(eloGamePlayers).where(eq(eloGamePlayers.eloGameId, gameId))
  return {
    game,
    homePlayerIds: players.filter(p => p.side === 'home').map(p => p.userId),
    awayPlayerIds: players.filter(p => p.side === 'away').map(p => p.userId),
  }
}

/**
 * Correct a casual game's score ("report a wrong result"). Anyone who played can do it, it takes
 * effect immediately, and — as everywhere else — the ratings are only replayed if the result
 * actually changed which side won.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const gameId = parseInt(id)
  const loaded = await loadGame(gameId)
  if (!loaded) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { game, homePlayerIds, awayPlayerIds } = loaded

  const everyone = [...homePlayerIds, ...awayPlayerIds]
  const played = everyone.includes(session.userId)
  if (!played && !session.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const json = await readJson(req)
  if (json instanceof NextResponse) return json
  const { homeSets, awaySets } = json
  if (!isValidResult(Number(homeSets), Number(awaySets))) {
    return NextResponse.json({ error: 'Invalid result — best of 3, so 2–0 or 2–1' }, { status: 400 })
  }
  if (Number(homeSets) === game.homeSets && Number(awaySets) === game.awaySets) {
    return NextResponse.json({ error: 'That is already the recorded result' }, { status: 400 })
  }

  await db.update(eloGames).set({
    homeSets: Number(homeSets),
    awaySets: Number(awaySets),
    correctedBy: session.userId,
    correctedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // playedAt stays put — a correction doesn't change when the game happened.
  }).where(eq(eloGames.id, gameId))

  const eloChanged = await syncEloForGame('elo', gameId, winnersOf({
    homePlayerIds, awayPlayerIds, homeSets: Number(homeSets), awaySets: Number(awaySets),
  }))

  if (played) {
    const others = everyone.filter(uid => uid !== session.userId)
    after(() => Promise.all(others.map(uid => sendPush(uid, {
      title: 'ELO game corrected',
      body: `${session.name} changed the score to ${homeSets}–${awaySets}.`,
      url: '/elo',
    }, 'resultCorrected'))))
  }

  afterEloGameChange()
  return NextResponse.json({ ok: true, eloChanged })
}

/** Delete a casual game entered by mistake — anyone who played in it, or an admin. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireUser()
  if (session instanceof NextResponse) return session

  const { id } = await params
  const gameId = parseInt(id)
  const loaded = await loadGame(gameId)
  if (!loaded) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const everyone = [...loaded.homePlayerIds, ...loaded.awayPlayerIds]
  if (!everyone.includes(session.userId) && !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.delete(eloHistory).where(and(eq(eloHistory.source, 'elo'), eq(eloHistory.refId, gameId)))
  await db.delete(eloGamePlayers).where(eq(eloGamePlayers.eloGameId, gameId))
  await db.delete(eloGames).where(eq(eloGames.id, gameId))
  // Removing a game from the middle of the chain shifts every rating after it, so replay.
  await rebuildEloLedger()

  afterEloGameChange()
  return NextResponse.json({ ok: true })
}
