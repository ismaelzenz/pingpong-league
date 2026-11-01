import { config } from 'dotenv'
import { createClient, type Client } from '@libsql/client'
import { buildLedger, type RatableGame } from '../domain/elo'

// Which env file to load. Defaults to local dev; pass a file as the first arg to target another
// environment — the `db:init:prod` script passes `.env.production.local` (see package.json).
const envFile = process.argv[2] || '.env.local'
config({ path: envFile })

async function main() {
  console.log(`Running DB migrations using ${envFile} → ${process.env.TURSO_DATABASE_URL}`)

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  })

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'registration' CHECK(status IN ('registration','active','finished')),
      break_weeks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      started_at TEXT,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tournament_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS matchdays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      number INTEGER NOT NULL,
      week_start TEXT,
      week_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tournament_id, number)
    );

    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matchday_id INTEGER NOT NULL REFERENCES matchdays(id),
      tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
      home_player_id INTEGER NOT NULL REFERENCES users(id),
      away_player_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','result_entered','confirmed','postponed','forfeited')),
      home_sets INTEGER,
      away_sets INTEGER,
      is_catch_up INTEGER NOT NULL DEFAULT 0,
      submitted_by INTEGER REFERENCES users(id),
      confirmed_by INTEGER REFERENCES users(id),
      submitted_at TEXT,
      confirmed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notification_prefs (
      user_id INTEGER PRIMARY KEY REFERENCES users(id),
      result_to_confirm INTEGER NOT NULL DEFAULT 1,
      result_confirmed INTEGER NOT NULL DEFAULT 1,
      result_disputed INTEGER NOT NULL DEFAULT 1,
      game_postponed INTEGER NOT NULL DEFAULT 1,
      weekly_reminder INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS elo_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      home_sets INTEGER NOT NULL,
      away_sets INTEGER NOT NULL,
      submitted_by INTEGER NOT NULL REFERENCES users(id),
      corrected_by INTEGER REFERENCES users(id),
      corrected_at TEXT,
      played_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS elo_game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elo_game_id INTEGER NOT NULL REFERENCES elo_games(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      side TEXT NOT NULL CHECK(side IN ('home','away')),
      UNIQUE(elo_game_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS elo_game_players_game ON elo_game_players(elo_game_id);

    CREATE TABLE IF NOT EXISTS elo_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      opponent_id INTEGER REFERENCES users(id),
      source TEXT NOT NULL CHECK(source IN ('league','elo')),
      ref_id INTEGER NOT NULL,
      won INTEGER NOT NULL,
      my_sets INTEGER NOT NULL,
      opp_sets INTEGER NOT NULL,
      rating_before REAL NOT NULL,
      delta REAL NOT NULL,
      rating_after REAL NOT NULL,
      played_at TEXT NOT NULL,
      seq INTEGER NOT NULL,
      UNIQUE(source, ref_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS elo_history_user_seq ON elo_history(user_id, seq);
    CREATE INDEX IF NOT EXISTS elo_history_ref ON elo_history(source, ref_id);

    -- Nearly every page filters games by season, matchday or player. Without these each of those
    -- reads scans every game of every season (and Turso bills per row read).
    CREATE INDEX IF NOT EXISTS games_tournament_status ON games(tournament_id, status);
    CREATE INDEX IF NOT EXISTS games_matchday ON games(matchday_id);
    CREATE INDEX IF NOT EXISTS games_home_player ON games(home_player_id);
    CREATE INDEX IF NOT EXISTS games_away_player ON games(away_player_id);
    CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
  `)

  // Add new columns to existing tables (safe to re-run)
  try { await client.execute('ALTER TABLE users ADD COLUMN avatar_color TEXT') } catch {}
  try { await client.execute('ALTER TABLE users ADD COLUMN archived_at TEXT') } catch {}
  // Left NULL for existing members on purpose — a null means "hasn't seen the current note", which
  // is exactly right for everyone already using the app when a release lands.
  try { await client.execute('ALTER TABLE users ADD COLUMN whats_new_seen TEXT') } catch {}
  try { await client.execute('ALTER TABLE games ADD COLUMN is_catch_up INTEGER NOT NULL DEFAULT 0') } catch {}
  try { await client.execute('ALTER TABLE tournaments ADD COLUMN break_weeks TEXT') } catch {}
  try { await client.execute('ALTER TABLE tournaments ADD COLUMN is_live INTEGER NOT NULL DEFAULT 0') } catch {}
  try { await client.execute('ALTER TABLE tournaments ADD COLUMN start_date TEXT') } catch {}
  try { await client.execute('ALTER TABLE notification_prefs ADD COLUMN game_postponed INTEGER NOT NULL DEFAULT 1') } catch {}
  try { await client.execute('ALTER TABLE notification_prefs ADD COLUMN result_recorded INTEGER NOT NULL DEFAULT 1') } catch {}
  try { await client.execute('ALTER TABLE notification_prefs ADD COLUMN result_corrected INTEGER NOT NULL DEFAULT 1') } catch {}
  try { await client.execute('ALTER TABLE games ADD COLUMN corrected_by INTEGER REFERENCES users(id)') } catch {}
  try { await client.execute('ALTER TABLE games ADD COLUMN corrected_at TEXT') } catch {}

  // Whether a season feeds ELO is now an explicit flag rather than something inferred. Existing
  // rows default to counting, which is right for every real season — but a tournament that is
  // neither finished nor live is an admin's test/bug-repro copy (see getLiveTournament), and its
  // results must not move real ratings. Seed those to 0 once, here, so the first ELO backfill
  // doesn't bake test games into everyone's rating. Only ever touches rows added before the
  // column existed, so re-running is safe.
  try { await client.execute('ALTER TABLE tournaments ADD COLUMN elo_counts_from TEXT') } catch {}
  const addedEloFlag = await (async () => {
    try { await client.execute('ALTER TABLE tournaments ADD COLUMN counts_for_elo INTEGER NOT NULL DEFAULT 1'); return true }
    catch { return false }
  })()
  if (addedEloFlag) {
    const { rowsAffected } = await client.execute(
      "UPDATE tournaments SET counts_for_elo = 0 WHERE status != 'finished' AND is_live = 0"
    )
    console.log(`counts_for_elo added; ${rowsAffected} test tournament(s) excluded from ELO`)
  }

  // Results are auto-approved from now on — nothing waits on an opponent's confirmation. Any row
  // still stuck in the old `result_entered` limbo is simply the result its players agreed to play,
  // so promote it rather than leaving it out of the standings (and out of ELO) forever.
  await client.execute(
    "UPDATE games SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, submitted_at, datetime('now')) " +
    "WHERE status = 'result_entered'"
  )

  // Backfill: if no tournament is marked live yet, promote the current one players would
  // have been seeing (the oldest non-finished) so existing installs keep working seamlessly.
  const { rows } = await client.execute("SELECT COUNT(*) AS n FROM tournaments WHERE is_live = 1")
  if (Number(rows[0]?.n ?? 0) === 0) {
    await client.execute(
      "UPDATE tournaments SET is_live = 1 WHERE id = (" +
      "SELECT id FROM tournaments WHERE status != 'finished' ORDER BY created_at LIMIT 1)"
    )
  }

  await widenEloGamesToTeams(client)
  await widenEloHistoryOpponent(client)

  const rated = await backfillElo(client)
  console.log(`ELO ledger rebuilt from ${rated} rated games`)

  console.log('Database initialised:', process.env.TURSO_DATABASE_URL)
  client.close()
}

/**
 * Move `elo_games` from its original fixed 1v1 shape (home_player_id / away_player_id columns) to
 * the team shape, where the sides live in `elo_game_players`.
 *
 * SQLite can't drop a NOT NULL column in place, so this is the standard rebuild: copy the rows we
 * keep into a new table, move the old home/away players into the join table, then swap. Guarded on
 * the old columns actually being present, so it runs exactly once and is a no-op everywhere else.
 */
async function widenEloGamesToTeams(client: Client): Promise<void> {
  const cols = (await client.execute('PRAGMA table_info(elo_games)')).rows.map(r => String(r.name))
  if (!cols.includes('home_player_id')) return

  console.log('Migrating elo_games to team sides…')
  await client.executeMultiple(`
    CREATE TABLE elo_games_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      home_sets INTEGER NOT NULL,
      away_sets INTEGER NOT NULL,
      submitted_by INTEGER NOT NULL REFERENCES users(id),
      corrected_by INTEGER REFERENCES users(id),
      corrected_at TEXT,
      played_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO elo_games_new (id, home_sets, away_sets, submitted_by, corrected_by, corrected_at,
                               played_at, created_at, updated_at)
      SELECT id, home_sets, away_sets, submitted_by, corrected_by, corrected_at,
             played_at, created_at, updated_at FROM elo_games;

    INSERT OR IGNORE INTO elo_game_players (elo_game_id, user_id, side)
      SELECT id, home_player_id, 'home' FROM elo_games;
    INSERT OR IGNORE INTO elo_game_players (elo_game_id, user_id, side)
      SELECT id, away_player_id, 'away' FROM elo_games;

    DROP TABLE elo_games;
    ALTER TABLE elo_games_new RENAME TO elo_games;
  `)
}

/**
 * Widen `elo_history.opponent_id` to allow NULL — a team game has no single opponent. Same rebuild
 * dance, and skipped once the column is already nullable.
 */
async function widenEloHistoryOpponent(client: Client): Promise<void> {
  const info = (await client.execute('PRAGMA table_info(elo_history)')).rows
  const opp = info.find(r => String(r.name) === 'opponent_id')
  const delta = info.find(r => String(r.name) === 'delta')
  const needsNullableOpponent = !!opp && Number(opp.notnull) === 1
  const needsRealRatings = !!delta && String(delta.type).toUpperCase() !== 'REAL'
  if (!needsNullableOpponent && !needsRealRatings) return

  console.log('Rebuilding elo_history (nullable opponent, fractional ratings)…')
  // The ledger is derived and about to be replayed from scratch, so there is nothing to preserve.
  await client.executeMultiple(`
    DROP TABLE elo_history;
    CREATE TABLE elo_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      opponent_id INTEGER REFERENCES users(id),
      source TEXT NOT NULL CHECK(source IN ('league','elo')),
      ref_id INTEGER NOT NULL,
      won INTEGER NOT NULL,
      my_sets INTEGER NOT NULL,
      opp_sets INTEGER NOT NULL,
      rating_before REAL NOT NULL,
      delta REAL NOT NULL,
      rating_after REAL NOT NULL,
      played_at TEXT NOT NULL,
      seq INTEGER NOT NULL,
      UNIQUE(source, ref_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS elo_history_user_seq ON elo_history(user_id, seq);
    CREATE INDEX IF NOT EXISTS elo_history_ref ON elo_history(source, ref_id);
  `)
}

/**
 * Replay every game the league has ever played into `elo_history`, seasons that predate ELO
 * included — that backfill is the whole point of running this on an existing database. Safe to
 * re-run: the ledger is derived, so it's wiped and rebuilt each time.
 *
 * Mirrors `collectRatableGames()` / `rebuildEloLedger()` in eloLedger.ts, but hand-rolled on the
 * raw libSQL client because migrations run before (and independently of) the app's drizzle setup.
 */
async function backfillElo(client: Client): Promise<number> {
  const normalise = (ts: string) => (ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z')

  // Only seasons flagged to count. A test/bug-repro copy is excluded, so its results never move
  // real ratings.
  const league = await client.execute(
    "SELECT id, home_player_id, away_player_id, home_sets, away_sets, " +
    "COALESCE(submitted_at, confirmed_at, created_at) AS played_at " +
    "FROM games WHERE status = 'confirmed' AND home_sets IS NOT NULL AND away_sets IS NOT NULL " +
    "AND home_sets != away_sets " +
    "AND tournament_id IN (SELECT id FROM tournaments WHERE counts_for_elo = 1) " +
    // A season switched on midway only counts from the moment the admin chose. The whole
    // null-or-after test has to sit inside its own parentheses: AND binds tighter than OR, so
    // without them a bare trailing OR would let games from every other tournament back in.
    "AND ((SELECT elo_counts_from FROM tournaments t WHERE t.id = games.tournament_id) IS NULL " +
    "     OR COALESCE(submitted_at, confirmed_at, created_at) >= " +
    "        (SELECT elo_counts_from FROM tournaments t WHERE t.id = games.tournament_id))"
  )
  const casual = await client.execute(
    'SELECT id, home_sets, away_sets, played_at FROM elo_games WHERE home_sets != away_sets'
  )
  const sides = await client.execute('SELECT elo_game_id, user_id, side FROM elo_game_players')
  const bySide = new Map<number, { home: number[]; away: number[] }>()
  for (const r of sides.rows) {
    const gid = Number(r.elo_game_id)
    if (!bySide.has(gid)) bySide.set(gid, { home: [], away: [] })
    bySide.get(gid)![String(r.side) === 'home' ? 'home' : 'away'].push(Number(r.user_id))
  }

  const rated: RatableGame[] = [
    // League games are always one-on-one, so each side is a single-player list.
    ...league.rows.map(r => ({
      source: 'league' as const,
      refId: Number(r.id),
      homePlayerIds: [Number(r.home_player_id)],
      awayPlayerIds: [Number(r.away_player_id)],
      homeSets: Number(r.home_sets),
      awaySets: Number(r.away_sets),
      playedAt: normalise(String(r.played_at)),
    })),
    ...casual.rows.map(r => ({
      source: 'elo' as const,
      refId: Number(r.id),
      homePlayerIds: bySide.get(Number(r.id))?.home ?? [],
      awayPlayerIds: bySide.get(Number(r.id))?.away ?? [],
      homeSets: Number(r.home_sets),
      awaySets: Number(r.away_sets),
      playedAt: normalise(String(r.played_at)),
    })),
  ]

  const entries = buildLedger(rated)
  await client.execute('DELETE FROM elo_history')
  for (const e of entries) {
    await client.execute({
      sql: 'INSERT INTO elo_history (user_id, opponent_id, source, ref_id, won, my_sets, opp_sets, ' +
           'rating_before, delta, rating_after, played_at, seq) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      args: [e.userId, e.opponentId, e.source, e.refId, e.won ? 1 : 0, e.mySets, e.oppSets,
             e.ratingBefore, e.delta, e.ratingAfter, e.playedAt, e.seq],
    })
  }
  return rated.length
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
