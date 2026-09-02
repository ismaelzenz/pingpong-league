/**
 * One-time backfill: confirm EVERY game currently "awaiting confirmation" in the live tournament,
 * so switching on auto-confirm-when-a-matchday-starts doesn't leave a pile of already-forgotten
 * ones hanging. Unlike the ongoing cron (which only touches ended matchdays), this confirms all
 * awaiting results immediately — including the current matchday's.
 *
 *   npm run db:confirm-awaiting                # DRY RUN against prod (shows what would happen)
 *   npm run db:confirm-awaiting -- --yes       # actually confirm them (prod)
 *   npm run db:confirm-awaiting -- --yes --local   # target .env.local instead of prod
 */
import { config } from 'dotenv'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { and, eq, inArray } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

const { tournaments, games } = schema

async function main() {
  const args = process.argv.slice(2)
  const doConfirm = args.includes('--yes')
  const local = args.includes('--local')

  const envFile = local ? '.env.local' : '.env.production.local'
  config({ path: envFile })

  const url = process.env.TURSO_DATABASE_URL ?? ''
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) { console.error(`No TURSO_DATABASE_URL found in ${envFile}.`); process.exit(1) }

  const masked = url.startsWith('file:') ? url : url.replace(/(libsql:\/\/)[^.]*/, '$1***')
  console.log(`Env file:  ${envFile}`)
  console.log(`Target DB: ${masked}  ${url.startsWith('file:') ? '(LOCAL file)' : '(REMOTE — likely PRODUCTION)'}`)
  console.log(doConfirm ? 'MODE: CONFIRM' : 'MODE: DRY RUN (no changes)')
  console.log('')

  const db = drizzle(createClient({ url, authToken }), { schema })

  // The live season only (an admin's test copy is left alone).
  const live = await db.select().from(tournaments)
    .where(and(eq(tournaments.isLive, true), inArray(tournaments.status, ['registration', 'active'])))
    .limit(1)
    .then(r => r[0] ?? null)
  if (!live) { console.error('No live tournament found — nothing to do.'); process.exit(1) }

  const awaiting = await db.select({ id: games.id, homePlayerId: games.homePlayerId, awayPlayerId: games.awayPlayerId })
    .from(games)
    .where(and(eq(games.tournamentId, live.id), eq(games.status, 'result_entered')))

  console.log(`Live tournament: "${live.name}" (id ${live.id})`)
  console.log(`Games awaiting confirmation: ${awaiting.length}`)
  if (awaiting.length === 0) { console.log('Nothing to confirm.'); return }

  if (!doConfirm) {
    console.log('\nDRY RUN — re-run with --yes to confirm these games.')
    return
  }

  const now = new Date().toISOString()
  const updated = await db.update(games).set({ status: 'confirmed', confirmedAt: now, updatedAt: now })
    .where(and(eq(games.tournamentId, live.id), eq(games.status, 'result_entered')))
    .returning({ id: games.id })

  console.log(`\n✅ Confirmed ${updated.length} game(s).`)
}

main().catch(err => { console.error(err); process.exit(1) })
