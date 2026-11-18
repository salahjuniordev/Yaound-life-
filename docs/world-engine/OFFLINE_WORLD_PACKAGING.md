# Offline World Packaging

The app shell and the initial world area work offline after one successful load.
The full world pack can be downloaded explicitly from Settings.

## What is cached

| Cache | Name | Contents |
| --- | --- | --- |
| App shell | `yaounde-life-v8-<buildId>` | `index.html`, hashed JS/CSS, manifest, fonts, icons |
| World | `yaounde-world-<worldVersion>` | Pack manifest, catalog, registry, initial chunks, downloaded chunks |

The service worker precaches:

- app shell files listed in the build-generated `dist/app-shell.json`;
- the generated shell manifest itself, with a safe fallback to the document,
  web manifest, fonts and icons if the list is missing;
- `world/registry.json`;
- for each registered pack with `precacheOnInstall: true`: its manifest,
  `files.json`, `precache.json` and every path in that pack's `precache.json`
  (currently Nlongkak: 53 files, 8 global files + 3 × 3 chunks around spawn).

The initial pack is about 5.1 MB uncompressed. The full catalog is 90 files and
5.39 MB. The service worker also caches world responses fetched at runtime.

The production build stamps `dist/sw.js` and `app-shell.json` with a
content-derived build ID. Any change to the shell changes the worker bytes and
the app cache name, so the next visit installs the new shell instead of serving
a stale cached `index.html` indefinitely.

## Settings UI

`src/ui/WorldOffline.tsx` shows:

- a pack selector when more than one compatible district pack is registered;
- supported / unsupported;
- storage estimate and persistence state;
- not downloaded / partial / downloading / ready / update available;
- file and byte progress;
- Download, Update, Cancel and Remove actions for the selected pack.

The selected pack is resolved from `world/registry.json` and the player's
current district. Only Nlongkak is registered today, so the selector stays
hidden in the current build. Removing offline data clears all world caches; a
successful download cleanup keeps every version still present in the registry.

Downloads use `src/pwa/worldCache.ts` with four concurrent requests, abort
support and byte progress. Before downloading, it checks `navigator.storage`
for available space and requests persistent storage when possible. A quota
failure is shown as a distinct error; it is not silently ignored.

## Update flow

1. A new build changes `worldVersion`, regenerates that area's pack, and
   upserts its registry entry without deleting other registered packs.
2. The app shell updates normally.
3. The Settings UI compares the selected pack's catalog version with the active
   cache.
4. Downloading writes into `yaounde-world-<newVersion>`, leaving the old pack
   intact.
5. After success, `cleanupOldWorldCaches` deletes obsolete world caches while
   preserving versions still listed in the registry.
6. If the new pack is incomplete, the service worker can still serve files from
   older world caches.

## Service worker rules

- World requests are cache-first, then network, then an explicit 503.
- New network responses are written to the cache for the registry pack that
  owns the request path. If the registry is unavailable, the worker falls back
  to the legacy `world/v1` manifest and the active cache.
- App-shell requests are cache-first. Installation precaches the generated
  `app-shell.json` list and refuses to activate without a cached HTML document;
  successful same-origin assets are also cached at runtime.
- Activation deletes only non-app, non-world caches. It does **not** delete a
  working world pack, and it resets the memoized registry and active version.
- The active world cache name comes from `world/registry.json` (precache-flagged
  pack first), falling back to the `world/v1` manifest for older deployments.
  Lookups are memoized for 60 seconds to avoid a registry request per asset.
  After a download or removal, Settings posts
  `{ type: 'world-cache-updated' }` so the next request resolves new state
  immediately.
- Offline, the active version falls back to the lexicographically newest
  `yaounde-world-*` cache. World versions are date-tagged, so this is normally
  the newest downloaded pack; `matchWorldRequest` still tries older caches if
  the newest pack is incomplete.

## Failure handling

- Missing catalog → `unavailable`; the UI can still offer a retry.
- Cache API unavailable → `unsupported`.
- Partial download → `partial`; resume skips already cached files.
- Quota exceeded → `quota-error` with a clear message.
- Aborted download → no cleanup of previously cached files.
- Offline chunk miss → 503 and the renderer falls back to the procedural world
  if the manifest cannot load.

## Testing

Pure catalog/status logic is covered by `test/offline.test.ts`. The actual
`public/sw.js` lifecycle and the Cache Storage download path are covered by
`test/serviceWorker.test.ts` and `test/offlineCache.test.ts` using an in-memory
Cache Storage implementation. Those tests cover generated app-shell precache,
unsafe manifest paths, install rejection without a document, initial world
precache, registry-driven pack precache, path-aware multi-pack runtime caching,
offline cache fallback, missing-asset 503, version invalidation, corrupt
manifests, legacy cache cleanup, multi-pack cleanup, resume, quota rejection,
HTTP failure and abort behavior. `test/registry.test.ts` covers registry
validation, district selection, version/area compatibility, pack URLs and save
round-trips; `test/geo.test.ts` covers a non-Nlongkak manifest anchor.

This is not a substitute for a real browser pass: service-worker installation
timing, persistent-storage prompts, quota accounting and real network
interruptions still need to be exercised on a device. A manual offline check is
still required before release:

1. Load the app online once.
2. Open Settings and download the world pack.
3. Go offline and reload.
4. Walk through Nlongkak and confirm chunks load from cache.
5. Update the pack and confirm the old cache is removed after success.
