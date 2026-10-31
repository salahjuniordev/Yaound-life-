const CACHE = 'yaounde-life-v6';

async function precacheWorld() {
  const cache = await caches.open(CACHE);
  const listUrl = new URL('world/v1/precache.json', self.location.href);
  const response = await fetch(listUrl).catch(() => null);
  if (!response || !response.ok) return;
  const files = await response.json().catch(() => []);
  await Promise.allSettled(
    files.map((path) => {
      const url = new URL(path, self.location.href);
      return cache.add(url).catch(() => undefined);
    }),
  );
}

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
      )
      .then(() => precacheWorld()),
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
  const isWorld = url.pathname.includes('/world/');
  const isCacheable = url.pathname.startsWith('/assets/') || url.pathname === '/' || isWorld;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached && isWorld) return cached;
      const network = fetch(request)
        .then((response) => {
          if (response.ok && isCacheable) {
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
