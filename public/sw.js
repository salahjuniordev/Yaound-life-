const CACHE = 'yaounde-life-v5';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.allSettled([
          cache.add('/fonts/fredoka-latin.woff2'),
          cache.add('/fonts/plus-jakarta-sans-latin.woff2'),
          cache.add('/new-app-icon.png'),
          cache.add('/icons/icon-192.png'),
          cache.add('/icons/icon-512.png'),
          cache.add('/icons/maskable-512.png'),
          cache.add('/icons/apple-touch-icon.png'),
        ]),
      ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && (url.pathname.startsWith('/assets/') || url.pathname === '/')) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
