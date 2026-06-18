import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { tournaments } from '@/lib/db/schema'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session.userId || !session.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const [tournament] = await db.insert(tournaments).values({ name: name.trim() }).returning()
  return NextResponse.json({ tournament })
}
