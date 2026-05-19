const CACHE_NAME = 'mwa-assets-v2';
const PRECACHE_ASSETS = ['/manifest.webmanifest', '/icons/badge-academy.png'];
const CACHEABLE_DESTINATIONS = new Set(['image', 'font', 'manifest']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    return;
  }

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const shouldCache =
    isSameOrigin &&
    CACHEABLE_DESTINATIONS.has(event.request.destination) &&
    !url.pathname.startsWith('/_next/') &&
    !url.pathname.startsWith('/api/');

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (shouldCache && response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        if (!shouldCache) {
          return Response.error();
        }

        return caches.match(event.request).then((cached) => cached || Response.error());
      })
  );
});
