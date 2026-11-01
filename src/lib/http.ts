import { NextResponse } from 'next/server'

/**
 * Parse a route's JSON body, or produce the 400 to return when it isn't valid JSON.
 *
 *   const json = await readJson(req)
 *   if (json instanceof NextResponse) return json
 *
 * `req.json()` throws on a malformed body, which surfaced as an opaque 500 from whichever line
 * happened to read it. The result is typed like `req.json()` itself — each route still validates
 * the fields it uses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors req.json()'s own `any`
export async function readJson(req: Request): Promise<any> {
  try {
    return await req.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
  }
}
