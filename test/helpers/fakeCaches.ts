export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function cacheKey(input: RequestInfo | URL): string {
  return new Request(requestUrl(input)).url;
}

/**
 * Small in-memory Cache implementation used by the offline tests.
 *
 * It deliberately implements only the subset used by `public/sw.js` and
 * `src/pwa/worldCache.ts`: add, put, match, keys and delete.
 */
export class FakeCache {
  private readonly entries = new Map<string, Response>();
  private readonly fetchImpl: FetchLike;

  constructor(fetchImpl: FetchLike) {
    this.fetchImpl = fetchImpl;
  }

  async add(input: RequestInfo | URL): Promise<void> {
    const response = await this.fetchImpl(input);
    if (!response.ok) throw new TypeError(`Request failed with status ${response.status}`);
    this.entries.set(cacheKey(input), response.clone());
  }

  async put(input: RequestInfo | URL, response: Response): Promise<void> {
    this.entries.set(cacheKey(input), response.clone());
  }

  async match(input: RequestInfo | URL): Promise<Response | undefined> {
    return this.entries.get(cacheKey(input))?.clone();
  }

  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async delete(input: RequestInfo | URL): Promise<boolean> {
    return this.entries.delete(cacheKey(input));
  }

  has(input: RequestInfo | URL): boolean {
    return this.entries.has(cacheKey(input));
  }

  get size(): number {
    return this.entries.size;
  }
}

export class FakeCacheStorage {
  private readonly stores = new Map<string, FakeCache>();
  private readonly fetchImpl: FetchLike;

  constructor(fetchImpl: FetchLike) {
    this.fetchImpl = fetchImpl;
  }

  async open(name: string): Promise<FakeCache> {
    return this.create(name);
  }

  async has(name: string): Promise<boolean> {
    return this.stores.has(name);
  }

  async delete(name: string): Promise<boolean> {
    return this.stores.delete(name);
  }

  async keys(): Promise<string[]> {
    return [...this.stores.keys()];
  }

  create(name: string): FakeCache {
    let cache = this.stores.get(name);
    if (!cache) {
      cache = new FakeCache(this.fetchImpl);
      this.stores.set(name, cache);
    }
    return cache;
  }

  get(name: string): FakeCache | undefined {
    return this.stores.get(name);
  }
}
