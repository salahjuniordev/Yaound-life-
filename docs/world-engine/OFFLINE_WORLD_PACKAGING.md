# Offline World Packaging

The app shell and the initial world area work offline after one successful load.
The full world pack can be downloaded explicitly from Settings.

## What is cached

| Cache | Name | Contents |
| --- | --- | --- |
| App shell | `yaounde-life-v7` | HTML, hashed JS/CSS, fonts, icons |
| World | `yaounde-world-<worldVersion>` | World manifest, catalog, initial chunks, downloaded chunks |

The service worker precaches:

- app shell files listed in `install`;
- `manifest.json` and `files.json`;
- every path in `world/v1/precache.json` (53 files: 8 global files + 3 × 3
  chunks around the spawn chunk).

The initial pack is about 5.1 MB uncompressed. The full catalog is 90 files and
5.39 MB. The service worker also caches world responses fetched at runtime.

## Settings UI

`src/ui/WorldOffline.tsx` shows:

- supported / unsupported;
- storage estimate and persistence state;
- not downloaded / partial / downloading / ready / update available;
- file and byte progress;
- Download, Update, Cancel and Remove actions.

Downloads use `src/pwa/worldCache.ts` with four concurrent requests, abort
support and byte progress. Before downloading, it checks `navigator.storage`
for available space and requests persistent storage when possible. A quota
failure is shown as a distinct error; it is not silently ignored.

## Update flow

1. A new build changes `worldVersion` and regenerates the pack.
2. The app shell updates normally.
3. The Settings UI compares the catalog version with the active cache.
4. Downloading writes into `yaounde-world-<newVersion>`, leaving the old pack
   intact.
5. After success, `cleanupOldWorldCaches` deletes older world caches.
6. If the new pack is incomplete, the service worker can still serve files from
   older world caches.

## Service worker rules

- World requests are cache-first, then network, then an explicit 503.
- New network responses are written to the active world cache.
- App-shell requests are cache-first for same-origin assets; navigation and
  hashed assets are cached on successful fetch.
- Activation deletes only non-app, non-world caches. It does **not** delete a
  working world pack.
- The active world cache name comes from the manifest; offline it falls back to
  the newest existing `yaounde-world-*` cache.

## Failure handling

- Missing catalog → `unavailable`; the UI can still offer a retry.
- Cache API unavailable → `unsupported`.
- Partial download → `partial`; resume skips already cached files.
- Quota exceeded → `quota-error` with a clear message.
- Aborted download → no cleanup of previously cached files.
- Offline chunk miss → 503 and the renderer falls back to the procedural world
  if the manifest cannot load.

## Testing

Pure catalog/status logic is covered by `test/offline.test.ts`. Browser Cache
Storage and quota behavior require a real browser; they are not simulated in
Node tests. A manual offline check is still required before release:

1. Load the app online once.
2. Open Settings and download the world pack.
3. Go offline and reload.
4. Walk through Nlongkak and confirm chunks load from cache.
5. Update the pack and confirm the old cache is removed after success.
