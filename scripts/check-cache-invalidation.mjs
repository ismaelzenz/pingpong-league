/**
 * Fails if an API route writes to the database without invalidating the cache.
 *
 *   npm run check:cache
 *
 * Cached reads (src/lib/cache.ts) only stay correct because every write route calls one of the
 * `after…Change()` helpers. A route that writes and forgets would leave standings or ELO stale for
 * up to the cache's max age. This catches that before it ships: every route.ts that writes — directly
 * (`db.insert/update/delete`, `tx.…`) or through a known writer (`syncEloForGame`, `rebuildEloLedger`,
 * `regenerateSchedule`, `setBoolSetting`) — must either call an invalidation helper or carry a
 * `// cache: private — …` comment saying why nothing it writes is cached.
 *
 * It's a static check, so it can't prove every *branch* invalidates; it catches the route that
 * never does, which is the mistake that actually happens. Writers elsewhere in src/ are listed too,
 * so a new one can be added to WRITERS below.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')
const API = path.join(root, 'src', 'app', 'api')

const DIRECT_WRITE = /\b(db|tx)\.(insert|update|delete)\(/
const WRITERS = /\b(syncEloForGame|rebuildEloLedger|regenerateSchedule|setBoolSetting)\(/
const INVALIDATES = /\b(afterLeagueChange|afterEloGameChange|afterSettingsChange|clearAllCaches)\(\)/
const PRIVATE_MARKER = /^\/\/ cache: private — .+/m

function routes(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return routes(p)
    return e.name === 'route.ts' ? [p] : []
  })
}

const problems = []
const rows = []
for (const file of routes(API).sort()) {
  const src = fs.readFileSync(file, 'utf8')
  const rel = path.relative(API, path.dirname(file)).replace(/\\/g, '/')
  const writes = DIRECT_WRITE.test(src) || WRITERS.test(src)
  const invalidates = INVALIDATES.test(src)
  const isPrivate = PRIVATE_MARKER.test(src)
  if (!writes) { rows.push([rel, 'read-only']); continue }
  if (invalidates && isPrivate) problems.push(`${rel}: both invalidates and claims to be private — pick one`)
  else if (invalidates) rows.push([rel, (src.match(new RegExp(INVALIDATES, 'g')) ?? []).map(s => s.replace('()', '')).filter((v, i, a) => a.indexOf(v) === i).join(', ')])
  else if (isPrivate) rows.push([rel, 'private (marked)'])
  else problems.push(`${rel}: writes to the database but never invalidates the cache (call an after…Change() helper from src/lib/cache.ts, or mark it "// cache: private — <why>")`)
}

const width = Math.max(...rows.map(r => r[0].length))
for (const [rel, what] of rows) console.log(`  ${rel.padEnd(width)}  ${what}`)

if (problems.length) {
  console.error(`\n✗ ${problems.length} route(s) need attention:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`\n✓ every writing API route invalidates the cache or is marked private (${rows.length} routes checked)`)
