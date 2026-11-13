import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { FakeCacheStorage, type FetchLike } from './helpers/fakeCaches';

const SCOPE = 'https://game.test/app/';
const APP_CACHE = 'yaounde-life-v8';
const SW_SOURCE = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

type FetchHandler = (url: string) => Response | Promise<Response>;

interface SwEvent {
  request?: Request;
  data?: unknown;
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
}

type SwListener = (event: SwEvent) => void;

class ServiceWorkerHarness {
  readonly caches: FakeCacheStorage;
  readonly fetchCalls: string[] = [];
  skipWaitingCalls = 0;
  claimCalls = 0;
  private readonly listeners = new Map<string, SwListener[]>();
  private handler: FetchHandler = () => new Response('not found', { status: 404 });

  constructor() {
    const fetchImpl: FetchLike = async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      this.fetchCalls.push(url);
      return this.handler(url);
    };
    this.caches = new FakeCacheStorage(fetchImpl);
    const self = {
      registration: { scope: SCOPE },
      addEventListener: (type: string, listener: SwListener) => {
        const existing = this.listeners.get(type) ?? [];
        existing.push(listener);
        this.listeners.set(type, existing);
      },
      skipWaiting: () => {
        this.skipWaitingCalls += 1;
      },
      clients: {
        claim: () => {
          this.claimCalls += 1;
        },
      },
    };
    runInNewContext(
      SW_SOURCE,
      {
        self,
        caches: this.caches,
        fetch: fetchImpl,
        location: new URL(SCOPE),
        URL,
        Request,
        Response,
        Headers,
        console,
      },
      { filename: 'public/sw.js' },
    );
  }

  setFetch(handler: FetchHandler): void {
    this.handler = handler;
  }

  async install(): Promise<void> {
    await this.dispatch('install', {});
  }

  async activate(): Promise<void> {
    await this.dispatch('activate', {});
  }

  async dispatchFetch(request: Request): Promise<Response | undefined> {
    return this.dispatch('fetch', { request });
  }

  async dispatchMessage(data: unknown): Promise<void> {
    await this.dispatch('message', { data });
  }

  async flush(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  private async dispatch(type: string, base: SwEvent): Promise<Response | undefined> {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    const event: SwEvent = {
      ...base,
      waitUntil: (promise) => {
        waits.push(Promise.resolve(promise));
      },
      respondWith: (promise) => {
        response = Promise.resolve(promise);
      },
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
    await Promise.all(waits);
    return response ? await response : undefined;
  }
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function text(body: string): Response {
  return new Response(body, { status: 200 });
}

function pathOf(url: string): string {
  return new URL(url).pathname;
}

test('install precaches the app shell and the initial world files', async () => {
  const sw = new ServiceWorkerHarness();
  const initial = ['world/v1/manifest.json', 'world/v1/files.json', 'world/v1/terrain/c_0_0.bin'];
  sw.setFetch((url) => {
    const path = pathOf(url);
    if (path.endsWith('/world/v1/manifest.json')) return json({ worldVersion: 'nlongkak-test-v2' });
    if (path.endsWith('/world/v1/precache.json')) return json(initial);
    if (path.endsWith('/world/v1/files.json')) return json({ files: [] });
    return text(`asset:${path}`);
  });

  await sw.install();

  assert.equal(sw.skipWaitingCalls, 1);
  assert.equal(await sw.caches.has(APP_CACHE), true);
  assert.equal(await sw.caches.has('yaounde-world-nlongkak-test-v2'), true);
  const app = sw.caches.get(APP_CACHE);
  const world = sw.caches.get('yaounde-world-nlongkak-test-v2');
  assert.ok(app?.has(`${SCOPE}fonts/fredoka-latin.woff2`));
  assert.ok(app?.has(`${SCOPE}icons/icon-192.png`));
  assert.ok(world?.has(`${SCOPE}world/v1/manifest.json`));
  assert.ok(world?.has(`${SCOPE}world/v1/precache.json`));
  assert.ok(world?.has(`${SCOPE}world/v1/files.json`));
  assert.ok(world?.has(`${SCOPE}world/v1/terrain/c_0_0.bin`));
});

test('install precaches the generated app-shell manifest, including hashed assets', async () => {
  const sw = new ServiceWorkerHarness();
  const files = ['', 'index.html', 'assets/index-BUILT.js', 'assets/index-BUILT.css', 'manifest.webmanifest', 'app-shell.json'];
  sw.setFetch((url) => {
    const path = pathOf(url);
    if (path.endsWith('/app-shell.json')) return json({ files });
    if (path.endsWith('/world/v1/manifest.json')) throw new Error('offline');
    return text(`built:${path}`);
  });

  await sw.install();

  const app = sw.caches.get(APP_CACHE);
  for (const file of files) {
    assert.ok(app?.has(`${SCOPE}${file}`), `expected ${file} in the app cache`);
  }
});

test('install ignores unsafe app-shell manifest paths', async () => {
  const sw = new ServiceWorkerHarness();
  sw.setFetch((url) => {
    const path = pathOf(url);
    if (path.endsWith('/app-shell.json')) {
      return json({ files: ['', 'index.html', '../escape.js', 'https://evil.test/payload.js', 'assets/ok.js'] });
    }
    if (path.endsWith('/world/v1/manifest.json')) throw new Error('offline');
    return text('asset');
  });

  await sw.install();

  const app = sw.caches.get(APP_CACHE);
  assert.ok(app?.has(`${SCOPE}assets/ok.js`));
  assert.equal(app?.has(`${SCOPE}escape.js`), false);
  assert.equal(app?.has('https://evil.test/payload.js'), false);
});

test('after install, a first-load navigation and hashed assets boot with the network offline', async () => {
  const sw = new ServiceWorkerHarness();
  const files = ['', 'index.html', 'assets/index-BOOT.js', 'assets/index-BOOT.css', 'manifest.webmanifest'];
  sw.setFetch((url) => {
    const path = pathOf(url);
    if (path.endsWith('/app-shell.json')) return json({ files });
    if (path.endsWith('/world/v1/manifest.json')) throw new Error('offline');
    return text(`cached:${path}`);
  });

  await sw.install();
  sw.setFetch(() => {
    throw new Error('offline');
  });

  const shell = await sw.dispatchFetch(new Request(SCOPE));
  assert.equal(shell?.status, 200);
  assert.match(await shell?.text() ?? '', /^cached:/);
  const index = await sw.dispatchFetch(new Request(`${SCOPE}index.html`));
  assert.equal(index?.status, 200);
  assert.match(await index?.text() ?? '', /index\.html/);
  const js = await sw.dispatchFetch(new Request(`${SCOPE}assets/index-BOOT.js`));
  assert.equal(js?.status, 200);
  assert.match(await js?.text() ?? '', /cached:.*index-BOOT\.js/);
  const css = await sw.dispatchFetch(new Request(`${SCOPE}assets/index-BOOT.css`));
  assert.equal(css?.status, 200);
});

test('install rejects when no app-shell document can be cached', async () => {
  const sw = new ServiceWorkerHarness();
  sw.setFetch(() => {
    throw new Error('offline');
  });

  await assert.rejects(sw.install(), /app shell could not be cached/);
});

test('install survives an offline manifest and failed shell assets', async () => {
  const sw = new ServiceWorkerHarness();
  sw.setFetch((url) => {
    if (pathOf(url).endsWith('/world/v1/manifest.json')) throw new Error('offline');
    if (pathOf(url).endsWith('/fonts/fredoka-latin.woff2')) throw new Error('offline');
    return text('ok');
  });

  await sw.install();

  assert.equal(await sw.caches.has(APP_CACHE), true);
  assert.equal([...await sw.caches.keys()].some((name) => name.startsWith('yaounde-world-')), false);
  assert.equal(sw.caches.get(APP_CACHE)?.has(`${SCOPE}new-app-icon.png`), true);
});

test('a cached world file is served without a network request', async () => {
  const sw = new ServiceWorkerHarness();
  const asset = `${SCOPE}world/v1/terrain/c_0_0.bin`;
  await sw.caches.create('yaounde-world-nlongkak-test-v2').put(asset, text('cached-terrain'));
  sw.setFetch((url) => {
    if (pathOf(url).endsWith('/world/v1/manifest.json')) return json({ worldVersion: 'nlongkak-test-v2' });
    throw new Error(`unexpected network request: ${url}`);
  });

  const response = await sw.dispatchFetch(new Request(asset));

  assert.equal(response?.status, 200);
  assert.equal(await response?.text(), 'cached-terrain');
  assert.equal(sw.fetchCalls.includes(asset), false);
});

test('offline lookup prefers the newest world cache and falls back to older caches', async () => {
  const sw = new ServiceWorkerHarness();
  const asset = `${SCOPE}world/v1/terrain/c_0_0.bin`;
  await sw.caches.create('yaounde-world-test-2026-10-30-v1').put(asset, text('old-terrain'));
  const newestCache = sw.caches.create('yaounde-world-test-2026-10-30-v2');
  await newestCache.put(asset, text('new-terrain'));
  sw.setFetch(() => {
    throw new Error('offline');
  });

  const newest = await sw.dispatchFetch(new Request(asset));
  assert.equal(await newest?.text(), 'new-terrain');

  await newestCache.delete(asset);
  const fallback = await sw.dispatchFetch(new Request(asset));
  assert.equal(await fallback?.text(), 'old-terrain');
});

test('a world-cache-updated message clears the memoized active version', async () => {
  const sw = new ServiceWorkerHarness();
  const asset = `${SCOPE}world/v1/terrain/c_0_0.bin`;
  await sw.caches.create('yaounde-world-test-2026-10-30-v1').put(asset, text('old-terrain'));
  sw.setFetch(() => {
    throw new Error('offline');
  });

  const before = await sw.dispatchFetch(new Request(asset));
  assert.equal(await before?.text(), 'old-terrain');

  await sw.caches.create('yaounde-world-test-2026-10-30-v2').put(asset, text('new-terrain'));
  const stale = await sw.dispatchFetch(new Request(asset));
  assert.equal(await stale?.text(), 'old-terrain');

  await sw.dispatchMessage({ type: 'world-cache-updated' });
  const refreshed = await sw.dispatchFetch(new Request(asset));
  assert.equal(await refreshed?.text(), 'new-terrain');
});

test('a missing world file offline returns a 503 response', async () => {
  const sw = new ServiceWorkerHarness();
  sw.caches.create('yaounde-world-nlongkak-test-v2');
  sw.setFetch(() => {
    throw new Error('offline');
  });

  const response = await sw.dispatchFetch(new Request(`${SCOPE}world/v1/terrain/missing.bin`));

  assert.equal(response?.status, 503);
  assert.match(await response?.text() ?? '', /World asset unavailable offline/);
});

test('an online world file is cached under the manifest version', async () => {
  const sw = new ServiceWorkerHarness();
  const asset = `${SCOPE}world/v1/terrain/c_0_0.bin`;
  sw.setFetch((url) => {
    if (pathOf(url).endsWith('/world/v1/manifest.json')) return json({ worldVersion: 'nlongkak-test-v3' });
    if (url === asset) return text('fresh-terrain');
    return new Response('missing', { status: 404 });
  });

  const response = await sw.dispatchFetch(new Request(asset));

  assert.equal(await response?.text(), 'fresh-terrain');
  await sw.flush();
  assert.ok(sw.caches.get('yaounde-world-nlongkak-test-v3')?.has(asset));
});

test('non-GET and cross-origin requests bypass the service worker', async () => {
  const sw = new ServiceWorkerHarness();
  sw.setFetch(() => text('network'));

  const post = await sw.dispatchFetch(new Request(`${SCOPE}world/v1/terrain/c_0_0.bin`, { method: 'POST' }));
  const crossOrigin = await sw.dispatchFetch(new Request('https://other.test/world/v1/terrain/c_0_0.bin'));

  assert.equal(post, undefined);
  assert.equal(crossOrigin, undefined);
  assert.equal(sw.fetchCalls.length, 0);
});

test('the app shell is served from cache and successful assets are cached', async () => {
  const sw = new ServiceWorkerHarness();
  const shell = new Request(SCOPE);
  const asset = new Request(`${SCOPE}assets/app.js`);
  await sw.caches.create(APP_CACHE).put(shell, text('cached-shell'));
  sw.setFetch((url) => {
    if (url === `${SCOPE}assets/app.js`) return text('network-asset');
    throw new Error('offline');
  });

  const cachedShell = await sw.dispatchFetch(shell);
  assert.equal(await cachedShell?.text(), 'cached-shell');

  const networkAsset = await sw.dispatchFetch(asset);
  assert.equal(await networkAsset?.text(), 'network-asset');
  await sw.flush();
  assert.ok(sw.caches.get(APP_CACHE)?.has(asset));

  const offline = await sw.dispatchFetch(new Request(`${SCOPE}settings`));
  assert.equal(offline?.status, 503);
  assert.equal(await offline?.text(), 'Offline');
});

test('activate removes legacy caches but preserves the app and world caches', async () => {
  const sw = new ServiceWorkerHarness();
  sw.caches.create('yaounde-life-v6');
  sw.caches.create('unrelated-cache');
  sw.caches.create(APP_CACHE);
  sw.caches.create('yaounde-world-old-v1');

  await sw.activate();

  assert.equal(sw.claimCalls, 1);
  assert.equal(await sw.caches.has('yaounde-life-v6'), false);
  assert.equal(await sw.caches.has('unrelated-cache'), false);
  assert.equal(await sw.caches.has(APP_CACHE), true);
  assert.equal(await sw.caches.has('yaounde-world-old-v1'), true);
});

test('an unsafe manifest version cannot create a world cache', async () => {
  const sw = new ServiceWorkerHarness();
  sw.setFetch((url) => {
    if (pathOf(url).endsWith('/world/v1/manifest.json')) return json({ worldVersion: '../escape' });
    if (pathOf(url).endsWith('/world/v1/precache.json')) return json([]);
    return text('ok');
  });

  await sw.install();

  const names = [...await sw.caches.keys()];
  assert.equal(names.some((name) => name.includes('escape')), false);
  assert.equal(names.filter((name) => name.startsWith('yaounde-world-')).length, 0);
});

test('non-string precache entries are ignored without blocking valid files', async () => {
  const sw = new ServiceWorkerHarness();
  const valid = 'world/v1/terrain/valid.bin';
  sw.setFetch((url) => {
    const path = pathOf(url);
    if (path.endsWith('/world/v1/manifest.json')) return json({ worldVersion: 'nlongkak-test-v4' });
    if (path.endsWith('/world/v1/precache.json')) return json([42, null, valid]);
    return text('ok');
  });

  await sw.install();

  const world = sw.caches.get('yaounde-world-nlongkak-test-v4');
  assert.ok(world?.has(`${SCOPE}${valid}`));
  assert.equal(world?.has(`${SCOPE}42`), false);
});
