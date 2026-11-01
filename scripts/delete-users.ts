/**
 * Safely delete users from a database (defaults to PRODUCTION via .env.production.local).
 *
 *   npm run db:delete-user -- <email> [<email>...]            # DRY RUN (shows what would happen)
 *   npm run db:delete-user -- <email> --yes                   # actually delete
 *   npm run db:delete-user -- <email> --yes --force           # also delete their game history (destructive)
 *   npm run db:delete-user -- <email> --local                 # target .env.local instead of prod
 *
 * A user referenced by real games (as a player) is SKIPPED unless --force, because removing them
 * would corrupt a tournament's schedule/standings. Prefer eliminating such players via the Admin
 * panel. Guests/test accounts with no games are safe to delete.
 *
 * The same goes for casual ELO games they played in: --force deletes those games outright (for
 * every player in them), and the ELO ledger is then replayed so nobody keeps points from a game
 * that no longer exists.
 */
import { config } from 'dotenv'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { and, eq, inArray, ne, or } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

const {
  users, participants, games, pushSubscriptions, notificationPrefs, passwordResetTokens,
  eloGames, eloGamePlayers, eloHistory,
} = schema

async function main() {
  const args = process.argv.slice(2)
  const doDelete = args.includes('--yes')
  const force = args.includes('--force')
  const local = args.includes('--local')
  const emails = args.filter(a => !a.startsWith('--')).map(e => e.trim().toLowerCase())

  const envFile = local ? '.env.local' : '.env.production.local'
  config({ path: envFile })

  if (emails.length === 0) {
    console.error('Usage: npm run db:delete-user -- <email> [<email>...] [--yes] [--force] [--local]')
    console.error('  Without --yes this is a DRY RUN — it changes nothing.')
    process.exit(1)
  }

  const url = process.env.TURSO_DATABASE_URL ?? ''
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) { console.error(`No TURSO_DATABASE_URL found in ${envFile}.`); process.exit(1) }

  const masked = url.startsWith('file:') ? url : url.replace(/(libsql:\/\/)[^.]*/, '$1***')
  console.log(`Env file:  ${envFile}`)
  console.log(`Target DB: ${masked}  ${url.startsWith('file:') ? '(LOCAL file)' : '(REMOTE — likely PRODUCTION)'}`)
  console.log(doDelete ? (force ? '⚠️  MODE: DELETE + FORCE (removes game history too)' : 'MODE: DELETE') : 'MODE: DRY RUN (no changes)')
  console.log('')

  const client = createClient(url.startsWith('file:') ? { url } : { url, authToken })
  const db = drizzle(client, { schema })

  let deleted = 0, skipped = 0
  for (const email of emails) {
    const user = await db.select().from(users).where(eq(users.email, email)).then(r => r[0])
    if (!user) { console.log(`✗ ${email} — not found`); continue }

    const parts = await db.select().from(participants).where(eq(participants.userId, user.id))
    const gameRows = await db.select().from(games).where(or(eq(games.homePlayerId, user.id), eq(games.awayPlayerId, user.id)))
    const subRows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id))
    const prefRows = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, user.id))
    const tokenRows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))
    const eloGameIds = (await db.select({ id: eloGamePlayers.eloGameId }).from(eloGamePlayers)
      .where(eq(eloGamePlayers.userId, user.id))).map(r => r.id)

    console.log(`• ${user.name} <${user.email}> (id ${user.id})`)
    console.log(`    participants: ${parts.length} · games: ${gameRows.length} · eloGames: ${eloGameIds.length} · pushSubs: ${subRows.length} · prefs: ${prefRows.length} · resetTokens: ${tokenRows.length}`)

    if ((gameRows.length > 0 || eloGameIds.length > 0) && !force) {
      console.log(`    ⚠️  SKIPPED — has ${gameRows.length} league game(s) and ${eloGameIds.length} ELO game(s); deleting would corrupt a tournament and everyone's ratings.`)
      console.log('        Eliminate them via Admin instead, or re-run with --force to also delete their games.')
      skipped++
      continue
    }

    if (!doDelete) {
      console.log('    (dry run) would delete the rows above and the user account.')
      continue
    }

    // FK-safe order: children first, then the user.
    if (gameRows.length > 0 && force) {
      await db.delete(games).where(or(eq(games.homePlayerId, user.id), eq(games.awayPlayerId, user.id)))
    }
    if (eloGameIds.length > 0) {
      await db.delete(eloHistory).where(and(eq(eloHistory.source, 'elo'), inArray(eloHistory.refId, eloGameIds)))
      await db.delete(eloGamePlayers).where(inArray(eloGamePlayers.eloGameId, eloGameIds))
      await db.delete(eloGames).where(inArray(eloGames.id, eloGameIds))
    }
    await db.update(games).set({ submittedBy: null }).where(eq(games.submittedBy, user.id))
    await db.update(games).set({ confirmedBy: null }).where(eq(games.confirmedBy, user.id))
    await db.update(games).set({ correctedBy: null }).where(eq(games.correctedBy, user.id))
    await db.update(eloGames).set({ correctedBy: null }).where(eq(eloGames.correctedBy, user.id))
    // `submitted_by` is NOT NULL on ELO games, and an admin can log a game they didn't play in. Hand
    // the authorship to one of the players so the game (and everyone's points from it) survives.
    for (const g of await db.select({ id: eloGames.id }).from(eloGames).where(eq(eloGames.submittedBy, user.id))) {
      const player = await db.select({ userId: eloGamePlayers.userId }).from(eloGamePlayers)
        .where(and(eq(eloGamePlayers.eloGameId, g.id), ne(eloGamePlayers.userId, user.id))).then(r => r[0])
      if (player) await db.update(eloGames).set({ submittedBy: player.userId }).where(eq(eloGames.id, g.id))
    }
    // Their ledger rows are derived; the rebuild below recreates the ledger without them.
    await db.delete(eloHistory).where(or(eq(eloHistory.userId, user.id), eq(eloHistory.opponentId, user.id)))
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id))
    await db.delete(notificationPrefs).where(eq(notificationPrefs.userId, user.id))
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))
    await db.delete(participants).where(eq(participants.userId, user.id))
    await db.delete(users).where(eq(users.id, user.id))
    console.log('    ✓ deleted')
    deleted++
  }

  // Ratings are chained, so removing anyone's games shifts every rating after them. Imported here,
  // not at the top: the app's db module reads TURSO_DATABASE_URL when it loads, which is only set
  // once `config()` above has picked the env file.
  if (deleted > 0) {
    const { rebuildEloLedger } = await import('../src/lib/services/eloLedger')
    const { games: rated } = await rebuildEloLedger()
    console.log(`ELO ledger rebuilt from ${rated} rated games.`)
  }

  console.log('')
  console.log(doDelete ? `Done. Deleted ${deleted} user(s), skipped ${skipped}.` : 'Dry run complete — nothing was changed. Add --yes to apply.')
  client.close()
}

main().catch(err => { console.error(err); process.exit(1) })
