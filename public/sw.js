// Minimal service worker — its presence (with a fetch handler) makes the app installable.
// The app is highly dynamic and auth-gated, so we stay network-only (no stale caching).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  // Pass through to the network. Required so the app meets installability criteria.
  event.respondWith(fetch(event.request))
})

// ── Push notifications ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || 'Ping Pong League'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/dashboard'
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of clients) {
      if ('focus' in c) { try { await c.navigate(url) } catch { /* cross-origin */ } return c.focus() }
    }
    return self.clients.openWindow(url)
  })())
})
