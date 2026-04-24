/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { createHandlerBoundToURL } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

// Precache
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA navigation
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// TMDB images — cache first
registerRoute(
  /^https:\/\/image\.tmdb\.org\/.*/i,
  new CacheFirst({
    cacheName: 'tmdb-images',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
)

// TMDB API — network first
registerRoute(
  /^https:\/\/api\.themoviedb\.org\/.*/i,
  new NetworkFirst({
    cacheName: 'tmdb-api',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 })],
  }),
)

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json() as { title: string; body: string; url?: string }
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data: { url: data.url ?? '/' },
      }),
    )
  } catch {
    // Fallback for plain text
    event.waitUntil(
      self.registration.showNotification('Ciné', {
        body: event.data.text(),
        icon: '/icons/icon-192x192.png',
      }),
    )
  }
})

// Click on notification — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
