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

// L'app est servie sous une base ('/cine/' sur GitHub Pages) : les chemins
// absolus type '/profile' ou '/icons/…' sortiraient du scope → 404
const BASE = import.meta.env.BASE_URL

/** Résout un chemin app ('/profile') en URL absolue sous la base ('/cine/profile') */
function withBase(path: string): string {
  return BASE.replace(/\/$/, '') + (path.startsWith('/') ? path : '/' + path)
}

const ICON = withBase('/icons/icon-192x192.png')

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const data = event.data.json() as { title: string; body: string; url?: string }
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: ICON,
        badge: ICON,
        data: { url: withBase(data.url ?? '/') },
      }),
    )
  } catch {
    // Fallback for plain text
    event.waitUntil(
      self.registration.showNotification('Ciné', {
        body: event.data.text(),
        icon: ICON,
      }),
    )
  }
})

// Click on notification — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? withBase('/')

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      // Ne naviguer que dans un client de notre app (même origine, sous la base)
      const appClient = clients.find(
        c => 'focus' in c && new URL(c.url).origin === self.location.origin,
      )
      if (appClient) {
        await appClient.focus()
        try {
          await appClient.navigate(url)
        } catch {
          // navigate() peut échouer sur un client non contrôlé
          await self.clients.openWindow(url)
        }
        return
      }
      return self.clients.openWindow(url)
    }),
  )
})
