import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORLD_CACHE_PREFIX,
  WORLD_CATALOG_FORMAT,
  WORLD_CATALOG_VERSION,
  assertWorldVersion,
  catalogMatchesManifest,
  downloadProgress,
  formatBytes,
  isWorldCacheName,
  missingWorldFiles,
  obsoleteWorldCaches,
  summarizeWorldOffline,
  validateWorldFileCatalog,
  worldCacheName,
  worldVersionFromCacheName,
  type WorldFileCatalog,
} from '../src/world/offline.ts';
import type { WorldManifest } from '../src/world/types.ts';
import { loadWorldCatalog } from '../src/pwa/worldCache.ts';

function catalog(overrides: Partial<WorldFileCatalog> = {}): WorldFileCatalog {
  const base: WorldFileCatalog = {
    format: WORLD_CATALOG_FORMAT,
    formatVersion: WORLD_CATALOG_VERSION,
    worldVersion: 'nlongkak-test-v1',
    generatedAt: '2026-10-31T00:00:00Z',
    totalBytes: 300,
    files: [
      { path: 'world/v1/manifest.json', bytes: 100 },
      { path: 'world/v1/terrain/c_0_0.bin', bytes: 120 },
      { path: 'world/v1/roads/c_0_0.json', bytes: 80 },
    ],
    initial: ['world/v1/manifest.json', 'world/v1/terrain/c_0_0.bin'],
  };
  return { ...base, ...overrides };
}

test('world cache names are versioned and validated', () => {
  assert.equal(worldCacheName('nlongkak-2026-10-30-v1'), `${WORLD_CACHE_PREFIX}nlongkak-2026-10-30-v1`);
  assert.equal(worldVersionFromCacheName(`${WORLD_CACHE_PREFIX}nlongkak-2026-10-30-v1`), 'nlongkak-2026-10-30-v1');
  assert.equal(worldVersionFromCacheName('yaounde-life-v8'), null);
  assert.equal(isWorldCacheName('yaounde-life-v8'), false);
  assert.throws(() => assertWorldVersion('../escape'));
  assert.throws(() => assertWorldVersion(''));
});

test('obsolete world caches preserve the active version and app caches', () => {
  const names = ['yaounde-life-v8', `${WORLD_CACHE_PREFIX}old-v1`, `${WORLD_CACHE_PREFIX}current-v2`];
  assert.deepEqual(obsoleteWorldCaches(names, 'current-v2'), [`${WORLD_CACHE_PREFIX}old-v1`]);
});

test('catalog validation rejects incompatible, duplicate or dangling entries', () => {
  const valid = catalog();
  assert.deepEqual(validateWorldFileCatalog(valid), valid);
  assert.throws(() => validateWorldFileCatalog({ ...valid, format: 'other' }));
  assert.throws(() => validateWorldFileCatalog({ ...valid, formatVersion: 99 }));
  assert.throws(() => validateWorldFileCatalog({ ...valid, files: [] }));
  assert.throws(() => validateWorldFileCatalog({ ...valid, files: [valid.files[0], valid.files[0]] }));
  assert.throws(() => validateWorldFileCatalog({ ...valid, initial: ['world/v1/missing.json'] }));
  assert.throws(() => validateWorldFileCatalog({ ...valid, files: [{ path: '../outside.json', bytes: 1 }] }));
});

test('missing world files and download progress use catalog byte sizes', () => {
  const data = catalog();
  const missing = missingWorldFiles(data, ['world/v1/manifest.json']);
  assert.deepEqual(missing.map((file) => file.path), ['world/v1/terrain/c_0_0.bin', 'world/v1/roads/c_0_0.json']);
  const progress = downloadProgress(data, ['world/v1/manifest.json']);
  assert.equal(progress.completedFiles, 1);
  assert.equal(progress.totalFiles, 3);
  assert.equal(progress.completedBytes, 100);
  assert.equal(progress.totalBytes, 300);
  assert.ok(Math.abs(progress.fraction - 1 / 3) < 1e-9);
});

test('offline status distinguishes absent, partial, complete and updated packs', () => {
  const data = catalog();
  const paths = data.files.map((file) => file.path);
  assert.equal(summarizeWorldOffline(data, []).status, 'not-downloaded');
  assert.equal(summarizeWorldOffline(data, paths.slice(0, 1)).status, 'partial');
  assert.equal(summarizeWorldOffline(data, paths).status, 'ready');
  assert.equal(
    summarizeWorldOffline(data, [], { cacheNames: [`${WORLD_CACHE_PREFIX}older-v0`] }).status,
    'update-available',
  );
  assert.equal(summarizeWorldOffline(data, paths, { quotaError: true }).status, 'quota-error');
  assert.equal(summarizeWorldOffline(data, paths, { supported: false }).status, 'unsupported');
  assert.equal(summarizeWorldOffline(null, []).status, 'unavailable');
});

test('offline summary reports byte totals and active cache name', () => {
  const data = catalog();
  const summary = summarizeWorldOffline(data, ['world/v1/manifest.json']);
  assert.equal(summary.cacheName, worldCacheName(data.worldVersion));
  assert.equal(summary.cachedBytes, 100);
  assert.equal(summary.totalBytes, 300);
  assert.equal(summary.missingBytes, 200);
  assert.equal(summary.cachedFiles, 1);
});

test('catalog version must match the manifest version', () => {
  const data = catalog();
  const manifest = { worldVersion: data.worldVersion } as WorldManifest;
  assert.equal(catalogMatchesManifest(data, manifest), true);
  assert.equal(catalogMatchesManifest(data, { ...manifest, worldVersion: 'other-v2' }), false);
});

test('byte formatting is stable for storage estimates', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
});

test('catalog loader joins the world base path', async () => {
  const urls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response(JSON.stringify(catalog()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const result = await loadWorldCatalog('/app/world/v1', fetchImpl);
  assert.deepEqual(urls, ['/app/world/v1/files.json']);
  assert.equal(result.worldVersion, 'nlongkak-test-v1');
});
