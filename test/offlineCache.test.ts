import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WorldCacheError,
  cachedWorldPaths,
  cleanupOldWorldCaches,
  deleteWorldCache,
  downloadWorldPack,
  loadWorldCatalog,
  worldCacheVersions,
} from '../src/pwa/worldCache';
import {
  WORLD_CATALOG_FORMAT,
  WORLD_CATALOG_VERSION,
  worldCacheName,
  type WorldFileCatalog,
} from '../src/world/offline';
import { FakeCacheStorage, type FetchLike } from './helpers/fakeCaches';

const BASE = 'https://game.test/app/';

function fetchMock(handler: (url: string) => Response | Promise<Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    return handler(url);
  }) as typeof fetch;
}

async function withGlobals<T>(values: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  try {
    return await fn();
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

async function withOfflineEnv<T>(
  fetchImpl: typeof fetch,
  fn: (caches: FakeCacheStorage) => Promise<T>,
): Promise<T> {
  const caches = new FakeCacheStorage(fetchImpl as FetchLike);
  return withGlobals(
    {
      caches,
      fetch: fetchImpl,
      window: { location: { href: BASE } },
    },
    () => fn(caches),
  );
}

function catalog(overrides: Partial<WorldFileCatalog> = {}): WorldFileCatalog {
  const base: WorldFileCatalog = {
    format: WORLD_CATALOG_FORMAT,
    formatVersion: WORLD_CATALOG_VERSION,
    worldVersion: 'nlongkak-test-v1',
    generatedAt: '2026-10-31T00:00:00Z',
    totalBytes: 300,
    files: [
      { path: 'world/v1/manifest.json', bytes: 100 },
      { path: 'world/v1/terrain/a.bin', bytes: 120 },
      { path: 'world/v1/roads/a.json', bytes: 80 },
    ],
    initial: ['world/v1/manifest.json', 'world/v1/terrain/a.bin'],
  };
  return { ...base, ...overrides };
}

test('downloadWorldPack downloads missing files and reports byte progress', async () => {
  const fetchImpl = fetchMock((url) => new Response(`body:${url}`, { status: 200 }));
  await withOfflineEnv(fetchImpl, async (caches) => {
    const data = catalog();
    const progress: number[] = [];
    const result = await downloadWorldPack({
      baseUrl: BASE,
      catalog: data,
      fetchImpl,
      concurrency: 2,
      onProgress: (event) => progress.push(event.fraction),
    });

    assert.equal(result.downloadedFiles, 3);
    assert.equal(result.downloadedBytes, 300);
    assert.equal(result.totalFiles, 3);
    assert.equal(result.totalBytes, 300);
    assert.equal(progress[0], 0);
    assert.equal(progress[progress.length - 1], 1);

    const cacheName = worldCacheName(data.worldVersion);
    const paths = await cachedWorldPaths(cacheName, BASE);
    assert.deepEqual(paths.sort(), data.files.map((file) => file.path).sort());
    assert.equal(caches.get(cacheName)?.size, 3);
  });
});

test('downloadWorldPack resumes an existing cache without refetching files', async () => {
  const data = catalog();
  const cacheName = worldCacheName(data.worldVersion);
  const cachedPath = 'world/v1/manifest.json';
  const calls: string[] = [];
  const fetchImpl = fetchMock((url) => {
    calls.push(url);
    return new Response('ok', { status: 200 });
  });

  await withOfflineEnv(fetchImpl, async (caches) => {
    await caches.create(cacheName).put(`${BASE}${cachedPath}`, new Response('cached', { status: 200 }));
    const progress: number[] = [];
    const result = await downloadWorldPack({
      baseUrl: BASE,
      catalog: data,
      fetchImpl,
      concurrency: 1,
      onProgress: (event) => progress.push(event.completedFiles),
    });

    assert.equal(result.downloadedFiles, 2);
    assert.equal(result.downloadedBytes, 200);
    assert.equal(calls.length, 2);
    assert.equal(calls.some((url) => url.endsWith(cachedPath)), false);
    assert.equal(progress[0], 1);
    assert.equal(progress[progress.length - 1], 3);
  });
});

test('downloadWorldPack rejects before fetching when storage is insufficient', async () => {
  const calls: string[] = [];
  const fetchImpl = fetchMock((url) => {
    calls.push(url);
    return new Response('ok', { status: 200 });
  });

  await withOfflineEnv(fetchImpl, async () => {
    await withGlobals(
      {
        navigator: {
          storage: {
            estimate: async () => ({ usage: 0, quota: 100 }),
          },
        },
      },
      async () => {
        await assert.rejects(
          () => downloadWorldPack({ baseUrl: BASE, catalog: catalog(), fetchImpl }),
          (error: unknown) => error instanceof WorldCacheError && error.code === 'quota',
        );
      },
    );
    assert.equal(calls.length, 0);
  });
});

test('downloadWorldPack wraps HTTP failures and stops the download', async () => {
  const fetchImpl = fetchMock((url) => {
    if (url.endsWith('/world/v1/terrain/a.bin')) return new Response('missing', { status: 404 });
    return new Response('ok', { status: 200 });
  });

  await withOfflineEnv(fetchImpl, async () => {
    await assert.rejects(
      () => downloadWorldPack({ baseUrl: BASE, catalog: catalog(), fetchImpl, concurrency: 1 }),
      (error: unknown) => error instanceof WorldCacheError && error.code === 'http',
    );
  });
});

test('downloadWorldPack honors an already-aborted signal', async () => {
  const calls: string[] = [];
  const fetchImpl = fetchMock((url) => {
    calls.push(url);
    return new Response('ok', { status: 200 });
  });
  const controller = new AbortController();
  controller.abort();

  await withOfflineEnv(fetchImpl, async () => {
    await assert.rejects(
      () => downloadWorldPack({ baseUrl: BASE, catalog: catalog(), fetchImpl, signal: controller.signal }),
      (error: unknown) => error instanceof WorldCacheError && error.code === 'aborted',
    );
    assert.equal(calls.length, 0);
  });
});

test('cleanupOldWorldCaches removes only obsolete world caches', async () => {
  const fetchImpl = fetchMock(() => new Response('ok', { status: 200 }));
  await withOfflineEnv(fetchImpl, async (caches) => {
    caches.create('yaounde-life-v7');
    caches.create('yaounde-world-old-v1');
    caches.create('yaounde-world-current-v2');
    caches.create('unrelated-cache');

    const removed = await cleanupOldWorldCaches('current-v2');

    assert.deepEqual(removed, ['yaounde-world-old-v1']);
    assert.equal(await caches.has('yaounde-world-old-v1'), false);
    assert.equal(await caches.has('yaounde-world-current-v2'), true);
    assert.equal(await caches.has('yaounde-life-v7'), true);
    assert.equal(await caches.has('unrelated-cache'), true);
  });
});

test('world cache versions can be listed and deleted', async () => {
  const fetchImpl = fetchMock(() => new Response('ok', { status: 200 }));
  await withOfflineEnv(fetchImpl, async (caches) => {
    caches.create('yaounde-world-old-v1');
    caches.create('yaounde-world-current-v2');
    caches.create('yaounde-life-v7');

    assert.deepEqual((await worldCacheVersions()).sort(), ['current-v2', 'old-v1']);
    await deleteWorldCache('old-v1');
    assert.equal(await caches.has('yaounde-world-old-v1'), false);
    assert.equal(await caches.has('yaounde-world-current-v2'), true);
  });
});

test('cachedWorldPaths ignores other origins and paths outside the base', async () => {
  const fetchImpl = fetchMock(() => new Response('ok', { status: 200 }));
  await withOfflineEnv(fetchImpl, async (caches) => {
    const cache = caches.create('yaounde-world-test-v1');
    await cache.put(`${BASE}world/v1/a.bin`, new Response('a'));
    await cache.put('https://other.test/app/world/v1/b.bin', new Response('b'));
    await cache.put('https://game.test/elsewhere/c.bin', new Response('c'));

    assert.deepEqual(await cachedWorldPaths('yaounde-world-test-v1', BASE), ['world/v1/a.bin']);
  });
});

test('catalog loading reports HTTP and malformed JSON failures', async () => {
  await assert.rejects(
    () => loadWorldCatalog(BASE, fetchMock(() => new Response('no', { status: 503 }))),
    (error: unknown) => error instanceof WorldCacheError && error.code === 'catalog',
  );
  await assert.rejects(
    () => loadWorldCatalog(BASE, fetchMock(() => new Response('not-json', { status: 200 }))),
    (error: unknown) => error instanceof WorldCacheError && error.code === 'catalog',
  );
});
