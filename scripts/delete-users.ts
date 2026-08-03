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
 */
import { config } from 'dotenv'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { eq, or } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

const { users, participants, games, pushSubscriptions, notificationPrefs, passwordResetTokens } = schema

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

    console.log(`• ${user.name} <${user.email}> (id ${user.id})`)
    console.log(`    participants: ${parts.length} · games: ${gameRows.length} · pushSubs: ${subRows.length} · prefs: ${prefRows.length} · resetTokens: ${tokenRows.length}`)

    if (gameRows.length > 0 && !force) {
      console.log(`    ⚠️  SKIPPED — has ${gameRows.length} game(s); deleting would corrupt a tournament.`)
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
    await db.update(games).set({ submittedBy: null }).where(eq(games.submittedBy, user.id))
    await db.update(games).set({ confirmedBy: null }).where(eq(games.confirmedBy, user.id))
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id))
    await db.delete(notificationPrefs).where(eq(notificationPrefs.userId, user.id))
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))
    await db.delete(participants).where(eq(participants.userId, user.id))
    await db.delete(users).where(eq(users.id, user.id))
    console.log('    ✓ deleted')
    deleted++
  }

  console.log('')
  console.log(doDelete ? `Done. Deleted ${deleted} user(s), skipped ${skipped}.` : 'Dry run complete — nothing was changed. Add --yes to apply.')
  client.close()
}

main().catch(err => { console.error(err); process.exit(1) })
