// Service worker for the installable web app.
//
// What it does: keeps the app shell and the build's static files so the app
// opens instantly and shows its screens offline. What it deliberately does NOT
// do: touch anything that isn't a same-origin GET — Supabase (auth + data),
// Google Forms and every POST pass straight through, so a member can never be
// shown stale account data or a stale session from this cache.
//
// Bump VERSION to drop every cache from older versions of this file.
const VERSION = 'v1'
const SHELL_CACHE = `elcsa-shell-${VERSION}`
const ASSET_CACHE = `elcsa-assets-${VERSION}`
const MAX_ASSET_ENTRIES = 150

// Files Expo content-hashes into their names, so a cached copy is never stale.
const IMMUTABLE = [/^\/_expo\/static\//, /^\/assets\//]
const OFFLINE_HTML =
  '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>Offline</title><body style="font-family:system-ui,sans-serif;background:#f7f4ee;color:#1c4906;text-align:center;padding:4rem 1.5rem">' +
  '<h1>You are offline</h1><p>Connect to the internet and reopen the app.</p></body>'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  // keys() is insertion-ordered, so the front is the oldest.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - max)).map((k) => cache.delete(k)))
}

// Navigations: always try the network first so a new deploy is picked up on the
// next open; fall back to the cached shell (every route is the same SPA page).
async function handleNavigation(request) {
  try {
    const response = await fetch(request)
    if (response.ok && (response.headers.get('content-type') || '').includes('text/html')) {
      const cache = await caches.open(SHELL_CACHE)
      cache.put('/', response.clone())
    }
    return response
  } catch {
    const cached = await caches.match('/')
    return cached || new Response(OFFLINE_HTML, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
}

async function handleImmutable(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE)
    await cache.put(request, response.clone())
    trim(ASSET_CACHE, MAX_ASSET_ENTRIES)
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request))
  } else if (IMMUTABLE.some((re) => re.test(url.pathname))) {
    event.respondWith(handleImmutable(request))
  }
})
