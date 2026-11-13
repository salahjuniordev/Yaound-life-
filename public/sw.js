const APP_CACHE = 'yaounde-life-v7';
const WORLD_CACHE_PREFIX = 'yaounde-world-';
const WORLD_ROOT = 'world/v1/';
const WORLD_VERSION_PATTERN = /^[A-Za-z0-9._-]+$/;

function isWorldCacheName(name) {
  return name.startsWith(WORLD_CACHE_PREFIX) && name.length > WORLD_CACHE_PREFIX.length;
}

function scopeUrl(path) {
  return new URL(path, self.registration.scope);
}

const WORLD_MANIFEST_TTL_MS = 60_000;
let activeWorldCachePromise = null;
let activeWorldCacheResolvedAt = 0;

function invalidateActiveWorldCache() {
  activeWorldCachePromise = null;
  activeWorldCacheResolvedAt = 0;
}

async function activeWorldCacheName() {
  if (
    activeWorldCachePromise &&
    (activeWorldCacheResolvedAt === 0 || Date.now() - activeWorldCacheResolvedAt < WORLD_MANIFEST_TTL_MS)
  ) {
    return activeWorldCachePromise;
  }
  const pending = (async () => {
    try {
      const response = await fetch(scopeUrl(`${WORLD_ROOT}manifest.json`), { cache: 'no-store' });
      if (response.ok) {
        const manifest = await response.json();
        if (manifest && typeof manifest.worldVersion === 'string' && WORLD_VERSION_PATTERN.test(manifest.worldVersion)) {
          return `${WORLD_CACHE_PREFIX}${manifest.worldVersion}`;
        }
      }
    } catch {
      // Offline: fall back to the newest complete world cache below.
    }
    // World versions are date-tagged, so the lexicographically greatest name is the newest offline fallback.
    const keys = (await caches.keys()).filter(isWorldCacheName).sort();
    return keys[keys.length - 1] ?? `${WORLD_CACHE_PREFIX}unavailable`;
  })();
  activeWorldCachePromise = pending;
  activeWorldCacheResolvedAt = 0;
  try {
    const name = await pending;
    if (activeWorldCachePromise === pending) activeWorldCacheResolvedAt = Date.now();
    return name;
  } catch (error) {
    if (activeWorldCachePromise === pending) invalidateActiveWorldCache();
    throw error;
  }
}

async function matchWorldRequest(request) {
  const current = await activeWorldCacheName();
  const names = (await caches.keys()).filter(isWorldCacheName);
  const ordered = [current, ...names.filter((name) => name !== current)];
  for (const name of ordered) {
    if (!(await caches.has(name))) continue;
    const cache = await caches.open(name);
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  return null;
}

async function precacheWorld() {
  const manifestResponse = await fetch(scopeUrl(`${WORLD_ROOT}manifest.json`), { cache: 'no-store' }).catch(() => null);
  if (!manifestResponse || !manifestResponse.ok) return;
  const manifest = await manifestResponse.json().catch(() => null);
  if (!manifest || typeof manifest.worldVersion !== 'string' || !WORLD_VERSION_PATTERN.test(manifest.worldVersion)) return;
  const cache = await caches.open(`${WORLD_CACHE_PREFIX}${manifest.worldVersion}`);
  const listResponse = await fetch(scopeUrl(`${WORLD_ROOT}precache.json`), { cache: 'no-store' }).catch(() => null);
  if (!listResponse || !listResponse.ok) return;
  const files = await listResponse.json().catch(() => []);
  if (!Array.isArray(files)) return;
  await Promise.allSettled([
    cache.add(scopeUrl(`${WORLD_ROOT}files.json`)).catch(() => undefined),
    cache.add(scopeUrl(`${WORLD_ROOT}precache.json`)).catch(() => undefined),
  ]);
  await Promise.allSettled(
    files.map((path) => {
      if (typeof path !== 'string') return Promise.resolve();
      return cache.add(scopeUrl(path)).catch(() => undefined);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) =>
        Promise.allSettled([
          cache.add(scopeUrl('fonts/fredoka-latin.woff2')),
          cache.add(scopeUrl('fonts/plus-jakarta-sans-latin.woff2')),
          cache.add(scopeUrl('new-app-icon.png')),
          cache.add(scopeUrl('icons/icon-192.png')),
          cache.add(scopeUrl('icons/icon-512.png')),
          cache.add(scopeUrl('icons/maskable-512.png')),
          cache.add(scopeUrl('icons/apple-touch-icon.png')),
        ]),
      )
      .then(() => precacheWorld())
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  invalidateActiveWorldCache();
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((name) => name !== APP_CACHE && !isWorldCacheName(name))
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'world-cache-updated') {
    invalidateActiveWorldCache();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.includes('/world/')) {
    event.respondWith(
      (async () => {
        const cached = await matchWorldRequest(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(await activeWorldCacheName());
            cache.put(request, response.clone()).catch(() => undefined);
          }
          return response;
        } catch {
          return new Response('World asset unavailable offline', {
            status: 503,
            headers: { 'content-type': 'text/plain; charset=utf-8' },
          });
        }
      })(),
    );
    return;
  }

  const scopePath = new URL(self.registration.scope).pathname;
  const isCacheable = url.pathname.startsWith(`${scopePath}assets/`) || url.pathname === scopePath;
  event.respondWith(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && isCacheable) {
          cache.put(request, response.clone()).catch(() => undefined);
        }
        return response;
      } catch {
        return new Response('Offline', {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
    })(),
  );
});
