import { unstable_cache, revalidateTag } from 'next/cache'

/**
 * Cross-request caching for the league's shared data — standings, ELO, recaps, the TV board — and
 * the single place that knows which writes invalidate what.
 *
 * The rules that keep it from ever showing stale data:
 *
 *  - **Only shared data is cached.** Everything here reads the same for every viewer. Anything about
 *    "me" (session, my games, my preferences) stays a live query, so one member can never see
 *    another's view.
 *  - **Few, broad tags.** A result touches the league table, the ELO ledger and the TV board at once,
 *    so instead of tracking fine-grained dependencies, a league change expires *all* league and ELO
 *    data. Over-invalidating costs a few queries; under-invalidating shows wrong data — and writes
 *    are a few a day against hundreds of reads, so the trade is easy.
 *  - **Expired immediately, not refreshed in the background.** `{ expire: 0 }` makes the next read
 *    wait for fresh data, so the player who just entered a score sees it on the very next render
 *    (the default would serve the old page once more while refreshing behind the scenes).
 *  - **Every write route calls one of the `after…Change()` helpers** (or is marked as touching only
 *    private data). `scripts/check-cache-invalidation.mjs` fails the build check if one doesn't.
 *  - **A safety net:** every entry expires after `MAX_AGE_SECONDS` regardless, so a write that slips
 *    past invalidation — a manual edit in the Turso dashboard, a migration, a script — is corrected
 *    within minutes. Admins also have a "clear cache" button for an immediate fix.
 *  - **Each deploy starts cold.** The commit is part of every key, so a release never serves data
 *    computed by the previous release's code.
 */

const TAGS = {
  /** Tournaments, matchdays, games, participants, and player names/colours shown with them. */
  league: 'league',
  /** The ELO ledger and casual ELO games. */
  elo: 'elo',
  /** League-wide admin switches (app_settings). */
  settings: 'settings',
} as const

type Tag = keyof typeof TAGS

const MAX_AGE_SECONDS = 300

const DEPLOYMENT = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'

/**
 * Wrap a read so its result is cached across requests under `tags`. Arguments are part of the key,
 * so they must be plain JSON values, and so must the result (it's stored as JSON — no Map/Set/Date).
 */
export function cached<A extends unknown[], R>(name: string, tags: Tag[], fn: (...args: A) => Promise<R>) {
  return unstable_cache(fn, [DEPLOYMENT, name], { tags: tags.map(t => TAGS[t]), revalidate: MAX_AGE_SECONDS })
}

function expire(...tags: Tag[]) {
  for (const t of tags) revalidateTag(TAGS[t], { expire: 0 })
}

/**
 * After any write to tournaments, matchdays, games or participants — or to a player's name or
 * colour, which cached standings and ELO tables display. Expires ELO too: a result moves ratings.
 */
export function afterLeagueChange() {
  expire('league', 'elo')
}

/** After a casual ELO game is recorded, corrected or deleted, or the ledger is rebuilt. */
export function afterEloGameChange() {
  expire('elo')
}

/** After an admin flips a league-wide setting. */
export function afterSettingsChange() {
  expire('settings')
}

/** The admin "clear cache" button: everything, for when data was changed outside the app. */
export function clearAllCaches() {
  expire('league', 'elo', 'settings')
}
