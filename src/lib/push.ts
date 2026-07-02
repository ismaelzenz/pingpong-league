import webpush from 'web-push'
import { db } from '@/lib/db'
import { pushSubscriptions } from '@/lib/db/schema'
import { eq, inArray } from 'drizzle-orm'

let configured: boolean | null = null

function ready(): boolean {
  if (configured !== null) return configured
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) { configured = false; return false }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  url?: string
}

/**
 * Send a web-push notification to every device a user has subscribed. Best-effort: failures
 * are swallowed, and subscriptions the push service reports as gone (404/410) are pruned.
 */
export async function sendPush(userId: number, payload: PushPayload): Promise<void> {
  if (!ready()) return
  let subs
  try {
    subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  } catch {
    return
  }
  if (!subs.length) return

  const data = JSON.stringify(payload)
  const dead: number[] = []
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        data,
      )
    } catch (e) {
      const code = (e as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) dead.push(s.id)
    }
  }))
  if (dead.length) {
    try { await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead)) } catch {}
  }
}
