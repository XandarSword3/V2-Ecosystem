/**
 * V2 Resort Service Worker
 * Powered by Workbox
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log('[SW] Workbox is loaded');

  const { registerRoute, NavigationRoute } = workbox.routing;
  const { StaleWhileRevalidate, NetworkFirst, CacheFirst, NetworkOnly } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;
  const { BackgroundSyncPlugin } = workbox.backgroundSync;

  // Precache basic assets
  const PRECACHE_NAME = 'v2-resort-precache-v1';
  const OFFLINE_URL = '/offline';

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(PRECACHE_NAME).then((cache) => {
        return cache.addAll(['/', '/offline', '/manifest.json', '/favicon.svg']);
      })
    );
  });

  // Background Sync for Offline Actions
  const bgSyncPlugin = new BackgroundSyncPlugin('v2-sync-queue', {
    maxRetentionTime: 24 * 60, // Retry for max 24 Hours
  });

  // API Requests: Network First
  registerRoute(
    ({ url }) => url.pathname.startsWith('/api/v1/'),
    new NetworkFirst({
      cacheName: 'v2-api-cache',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        }),
      ],
    })
  );

  // Mutations (POST/PUT/PATCH/DELETE) with Background Sync
  registerRoute(
    ({ request }) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
    new NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    'POST'
  );

  // Static Assets: Cache First
  registerRoute(
    ({ request }) => 
      request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'worker',
    new StaleWhileRevalidate({
      cacheName: 'v2-static-assets',
    })
  );

  // Images: Cache First
  registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
      cacheName: 'v2-images',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Navigation: Network First with Offline Fallback
  const navigationHandler = async (params) => {
    const { request } = params;
    try {
      return await new NetworkFirst({
        cacheName: 'v2-navigation',
      }).handle(params);
    } catch (error) {
      return caches.match(OFFLINE_URL) || Response.error();
    }
  };

  registerRoute(new NavigationRoute(navigationHandler));

  // Push notifications
  self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json();
    const options = {
      body: data.body || 'V2 Resort Update',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
    };
    event.waitUntil(self.registration.showNotification(data.title || 'V2 Resort', options));
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && 'focus' in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(urlToOpen);
      })
    );
  });

} else {
  console.log('[SW] Workbox failed to load');
}
