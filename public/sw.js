const CACHE_NAME = 'mwa-shell-v1';
const APP_SHELL = ['/', '/home', '/manifest.webmanifest', '/icons/badge-academy.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
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

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const shouldCache =
    isSameOrigin &&
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

        return caches.match(event.request).then((cached) => cached || caches.match('/home'));
      })
  );
});
