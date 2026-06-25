// Minimal service worker — its presence (with a fetch handler) makes the app installable.
// The app is highly dynamic and auth-gated, so we stay network-only (no stale caching).
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  // Pass through to the network. Required so the app meets installability criteria.
  event.respondWith(fetch(event.request))
})
