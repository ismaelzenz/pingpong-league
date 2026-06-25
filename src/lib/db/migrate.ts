import { config } from 'dotenv'
import { createClient } from '@libsql/client'

config({ path: '.env.local' })

async function main() {
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

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Add new columns to existing tables (safe to re-run)
  try { await client.execute('ALTER TABLE users ADD COLUMN avatar_color TEXT') } catch {}
  try { await client.execute('ALTER TABLE games ADD COLUMN is_catch_up INTEGER NOT NULL DEFAULT 0') } catch {}
  try { await client.execute('ALTER TABLE tournaments ADD COLUMN break_weeks TEXT') } catch {}

  console.log('Database initialised:', process.env.TURSO_DATABASE_URL)
  client.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
