import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'path'
import fs from 'fs'
import * as schema from './schema'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'pingpong.db')

// Ensure the data directory exists before opening the DB
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Singleton — reuse the same connection across Next.js hot-reloads in dev
const globalForDb = globalThis as unknown as { _db: ReturnType<typeof drizzle> | undefined }

function createDb() {
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle(sqlite, { schema })
}

export const db = globalForDb._db ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalForDb._db = db
}
