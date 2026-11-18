const APP_CACHE = 'yaounde-life-v8';
const APP_SHELL_MANIFEST = 'app-shell.json';
const APP_SHELL_FALLBACK = [
  '',
  'index.html',
  APP_SHELL_MANIFEST,
  'manifest.webmanifest',
  'new-app-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'fonts/fredoka-latin.woff2',
  'fonts/plus-jakarta-sans-latin.woff2',
];
const WORLD_CACHE_PREFIX = 'yaounde-world-';
const WORLD_REGISTRY = 'world/registry.json';
const WORLD_LEGACY_PACK = Object.freeze({
  id: 'nlongkak',
  districtId: 'nlongkak',
  name: 'Nlongkak',
  basePath: 'world/v1',
  worldVersion: null,
  precacheOnInstall: true,
});
const WORLD_VERSION_PATTERN = /^[A-Za-z0-9._-]+$/;
const WORLD_PACK_PATH_PATTERN = /^world\/[A-Za-z0-9._/-]+$/;

function isWorldCacheName(name) {
  return name.startsWith(WORLD_CACHE_PREFIX) && name.length > WORLD_CACHE_PREFIX.length;
}

function scopeUrl(path) {
  return new URL(path, self.registration.scope);
}

function validRegistryPack(pack) {
  return Boolean(
    pack &&
    typeof pack.id === 'string' &&
    /^[a-z0-9][a-z0-9_-]*$/.test(pack.id) &&
    typeof pack.districtId === 'string' &&
    /^[a-z0-9][a-z0-9_-]*$/.test(pack.districtId) &&
    typeof pack.name === 'string' &&
    pack.name.length > 0 &&
    typeof pack.basePath === 'string' &&
    !pack.basePath.startsWith('/') &&
    !pack.basePath.includes('..') &&
    !pack.basePath.includes('\\') &&
    WORLD_PACK_PATH_PATTERN.test(pack.basePath) &&
    typeof pack.worldVersion === 'string' &&
    WORLD_VERSION_PATTERN.test(pack.worldVersion) &&
    Number.isInteger(pack.manifestFormatVersion)
  );
}

const WORLD_MANIFEST_TTL_MS = 60_000;
let registryPromise = null;
let registryResolvedAt = 0;
let activeWorldCachePromise = null;
let activeWorldCacheResolvedAt = 0;

function invalidateActiveWorldCache() {
  registryPromise = null;
  registryResolvedAt = 0;
  activeWorldCachePromise = null;
  activeWorldCacheResolvedAt = 0;
}

async function loadWorldRegistry() {
  if (
    registryPromise &&
    (registryResolvedAt === 0 || Date.now() - registryResolvedAt < WORLD_MANIFEST_TTL_MS)
  ) {
    return registryPromise;
  }
  const pending = (async () => {
    try {
      const response = await fetch(scopeUrl(WORLD_REGISTRY), { cache: 'no-store' });
      if (!response.ok) return null;
      const registry = await response.json();
      if (!registry || registry.format !== 'yaounde-life-world-registry' || registry.formatVersion !== 1) return null;
      if (!Array.isArray(registry.packs) || registry.packs.length === 0) return null;
      const seenPaths = new Set();
      const packs = registry.packs.filter((pack) => {
        if (!validRegistryPack(pack) || seenPaths.has(pack.basePath)) return false;
        seenPaths.add(pack.basePath);
        return true;
      });
      return packs.length > 0 ? { ...registry, packs } : null;
    } catch {
      return null;
    }
  })();
  registryPromise = pending;
  registryResolvedAt = 0;
  const registry = await pending;
  if (registryPromise === pending) registryResolvedAt = Date.now();
  return registry;
}

async function activeWorldCacheName() {
  if (
    activeWorldCachePromise &&
    (activeWorldCacheResolvedAt === 0 || Date.now() - activeWorldCacheResolvedAt < WORLD_MANIFEST_TTL_MS)
  ) {
    return activeWorldCachePromise;
  }
  const pending = (async () => {
    const registry = await loadWorldRegistry();
    if (registry) {
      const pack = registry.packs.find((entry) => entry.precacheOnInstall === true) ?? registry.packs[0];
      return `${WORLD_CACHE_PREFIX}${pack.worldVersion}`;
    }
    try {
      const response = await fetch(scopeUrl(`${WORLD_LEGACY_PACK.basePath}/manifest.json`), { cache: 'no-store' });
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

async function worldCacheNameForRequest(request) {
  const registry = await loadWorldRegistry();
  if (registry) {
    const path = new URL(request.url).pathname;
    const pack = registry.packs.find((entry) => path.includes(`/${entry.basePath}/`));
    if (pack) return `${WORLD_CACHE_PREFIX}${pack.worldVersion}`;
  }
  return activeWorldCacheName();
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

function isSafeAppShellPath(path) {
  if (typeof path !== 'string' || path.length > 1024) return false;
  if (path === '') return true;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path)) return false;
  return !path.split('/').includes('..');
}

async function precacheAppShell(cache) {
  const files = new Set(APP_SHELL_FALLBACK);
  try {
    const response = await fetch(scopeUrl(APP_SHELL_MANIFEST), { cache: 'no-store' });
    if (response.ok) {
      const manifest = await response.json();
      if (manifest && Array.isArray(manifest.files)) {
        for (const path of manifest.files) {
          if (isSafeAppShellPath(path)) files.add(path);
        }
      }
    }
  } catch {
    // The fallback list still gets a chance to cache the document.
  }

  await Promise.allSettled([...files].map((path) => cache.add(scopeUrl(path))));

  const shell = (await cache.match(scopeUrl(''))) ?? (await cache.match(scopeUrl('index.html')));
  if (!shell) throw new Error('app shell could not be cached');
}

function isSafeWorldPath(path, basePath) {
  if (typeof path !== 'string' || path.length > 1024) return false;
  if (!path.startsWith(`${basePath}/`)) return false;
  if (path.includes('..') || path.includes('\\')) return false;
  return !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path);
}

async function precachePack(pack) {
  let worldVersion = pack.worldVersion;
  if (!worldVersion) {
    const manifestResponse = await fetch(scopeUrl(`${pack.basePath}/manifest.json`), { cache: 'no-store' }).catch(() => null);
    if (!manifestResponse || !manifestResponse.ok) return;
    const manifest = await manifestResponse.json().catch(() => null);
    if (!manifest || typeof manifest.worldVersion !== 'string' || !WORLD_VERSION_PATTERN.test(manifest.worldVersion)) return;
    worldVersion = manifest.worldVersion;
  }
  const cache = await caches.open(`${WORLD_CACHE_PREFIX}${worldVersion}`);
  const listResponse = await fetch(scopeUrl(`${pack.basePath}/precache.json`), { cache: 'no-store' }).catch(() => null);
  if (!listResponse || !listResponse.ok) return;
  const files = await listResponse.json().catch(() => []);
  if (!Array.isArray(files)) return;
  await Promise.allSettled([
    cache.add(scopeUrl(WORLD_REGISTRY)).catch(() => undefined),
    cache.add(scopeUrl(`${pack.basePath}/files.json`)).catch(() => undefined),
    cache.add(scopeUrl(`${pack.basePath}/precache.json`)).catch(() => undefined),
  ]);
  await Promise.allSettled(
    files.map((path) => {
      if (!isSafeWorldPath(path, pack.basePath)) return Promise.resolve();
      return cache.add(scopeUrl(path)).catch(() => undefined);
    }),
  );
}

async function precacheWorld() {
  const registry = await loadWorldRegistry();
  const packs = registry
    ? registry.packs.filter((pack) => pack.precacheOnInstall === true)
    : [WORLD_LEGACY_PACK];
  await Promise.allSettled(packs.map(precachePack));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      await precacheAppShell(cache);
      await precacheWorld();
    })(),
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
            const cache = await caches.open(await worldCacheNameForRequest(request));
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
