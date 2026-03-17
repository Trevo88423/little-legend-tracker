const CACHE_NAME = 'little-legend-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
]

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: network-first for navigation, cache-first for static, skip Supabase
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Skip Supabase API requests
  if (url.hostname.includes('supabase')) return

  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Navigation requests: network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('/')))
    )
    return
  }

  // Static assets: cache-first
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          return response
        })
      })
    )
    return
  }
})

// Push: receive server-sent push notification and display it
self.addEventListener('push', event => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch (e) {
    payload = { title: 'Little Legend', body: event.data.text() }
  }

  const { title, body, tag, data } = payload

  event.waitUntil(
    self.registration.showNotification(title || 'Little Legend', {
      body: body || '',
      tag: tag || 'med-notification',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      requireInteraction: true,
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      data: data || {}
    })
  )
})

// Notification click: open or focus the app
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/app/meds'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Focus existing app window if found
      for (const client of clients) {
        if (client.url.includes('/app/') && 'focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      // Otherwise open the target page
      return self.clients.openWindow(targetUrl)
    })
  )
})

// Subscription change: re-subscribe and notify client
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options).then(newSub => {
      // Notify all clients so they can sync the new subscription to the DB
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: newSub.toJSON()
          })
        })
      })
    })
  )
})
