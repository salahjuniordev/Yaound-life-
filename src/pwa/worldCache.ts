import {
  WORLD_CACHE_PREFIX,
  WORLD_CATALOG_FILE,
  missingWorldFiles,
  obsoleteWorldCaches,
  validateWorldFileCatalog,
  worldCacheName,
  type WorldFileCatalog,
} from '../world/offline';
import { joinWorldUrl } from '../world/loader';

export type WorldCacheErrorCode = 'unsupported' | 'network' | 'http' | 'quota' | 'aborted' | 'storage' | 'catalog';

export class WorldCacheError extends Error {
  readonly code: WorldCacheErrorCode;

  constructor(code: WorldCacheErrorCode, message: string) {
    super(message);
    this.name = 'WorldCacheError';
    this.code = code;
  }
}

export interface WorldStorageEstimate {
  usage: number;
  quota: number;
  available: number;
  persisted: boolean | null;
}

export interface WorldDownloadProgress {
  completedFiles: number;
  totalFiles: number;
  completedBytes: number;
  totalBytes: number;
  fraction: number;
}

export interface DownloadWorldOptions {
  baseUrl: string;
  catalog: WorldFileCatalog;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  concurrency?: number;
  onProgress?: (progress: WorldDownloadProgress) => void;
}

export interface DownloadWorldResult {
  cacheName: string;
  downloadedFiles: number;
  downloadedBytes: number;
  totalFiles: number;
  totalBytes: number;
}

function baseUrlFor(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function cachePathForRequest(requestUrl: string, baseUrl: string): string | null {
  const url = new URL(requestUrl, window.location.href);
  const base = new URL(baseUrlFor(baseUrl), window.location.href);
  if (url.origin !== base.origin) return null;
  if (!url.pathname.startsWith(base.pathname)) return null;
  return url.pathname.slice(base.pathname.length);
}

function errorCode(error: unknown): WorldCacheErrorCode {
  if (error instanceof WorldCacheError) return error.code;
  if (error instanceof DOMException && error.name === 'QuotaExceededError') return 'quota';
  if (error instanceof DOMException && error.name === 'AbortError') return 'aborted';
  return 'network';
}

export function worldCacheSupported(): boolean {
  return typeof caches !== 'undefined' && typeof fetch === 'function';
}

export async function loadWorldCatalog(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<WorldFileCatalog> {
  const url = joinWorldUrl(baseUrlFor(baseUrl), WORLD_CATALOG_FILE);
  let response: Response;
  try {
    response = await fetchImpl(url, { cache: 'no-cache' });
  } catch (error) {
    throw new WorldCacheError('network', `Could not fetch world catalog: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new WorldCacheError('catalog', `World catalog returned ${response.status}`);
  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new WorldCacheError('catalog', 'World catalog is not valid JSON');
  }
  try {
    return validateWorldFileCatalog(raw);
  } catch (error) {
    throw new WorldCacheError('catalog', error instanceof Error ? error.message : String(error));
  }
}

export async function cachedWorldPaths(cacheName: string, baseUrl: string): Promise<string[]> {
  if (!worldCacheSupported()) return [];
  if (!(await caches.has(cacheName))) return [];
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  const paths: string[] = [];
  for (const request of requests) {
    const path = cachePathForRequest(request.url, baseUrl);
    if (path) paths.push(path);
  }
  return paths;
}

export async function worldCacheVersions(): Promise<string[]> {
  if (!worldCacheSupported()) return [];
  const names = await caches.keys();
  return names.filter((name) => name.startsWith(WORLD_CACHE_PREFIX)).map((name) => name.slice(WORLD_CACHE_PREFIX.length));
}

export async function estimateWorldStorage(): Promise<WorldStorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const estimate = await navigator.storage.estimate();
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  let persisted: boolean | null = null;
  if (navigator.storage.persisted) {
    try {
      persisted = await navigator.storage.persisted();
    } catch {
      persisted = null;
    }
  }
  return { usage, quota, available: Math.max(0, quota - usage), persisted };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function downloadWorldPack(options: DownloadWorldOptions): Promise<DownloadWorldResult> {
  if (!worldCacheSupported()) throw new WorldCacheError('unsupported', 'This browser does not support offline world caching');
  const baseUrl = baseUrlFor(options.baseUrl);
  const cacheName = worldCacheName(options.catalog.worldVersion);
  const cache = await caches.open(cacheName);
  const existing = await cachedWorldPaths(cacheName, baseUrl);
  const missing = missingWorldFiles(options.catalog, existing);
  const totalFiles = options.catalog.files.length;
  const totalBytes = options.catalog.totalBytes;
  let downloadedFiles = 0;
  let downloadedBytes = 0;
  let completedBytes = totalBytes - missing.reduce((sum, file) => sum + file.bytes, 0);
  let completedFiles = totalFiles - missing.length;
  const report = () => {
    options.onProgress?.({
      completedFiles,
      totalFiles,
      completedBytes,
      totalBytes,
      fraction: totalBytes > 0 ? completedBytes / totalBytes : 0,
    });
  };
  report();
  if (missing.length === 0) {
    return { cacheName, downloadedFiles: 0, downloadedBytes: 0, totalFiles, totalBytes };
  }
  const estimate = await estimateWorldStorage();
  const missingBytes = missing.reduce((sum, file) => sum + file.bytes, 0);
  if (estimate && estimate.available > 0 && missingBytes > estimate.available) {
    throw new WorldCacheError('quota', `Not enough storage: need ${missingBytes} bytes, ${estimate.available} available`);
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const concurrency = Math.max(1, Math.min(6, options.concurrency ?? 4));
  let cursor = 0;
  let failure: unknown = null;
  const worker = async () => {
    while (!failure) {
      const index = cursor;
      cursor += 1;
      if (index >= missing.length) return;
      if (options.signal?.aborted) {
        failure = new DOMException('Download aborted', 'AbortError');
        return;
      }
      const file = missing[index];
      const url = joinWorldUrl(baseUrl, file.path);
      try {
        const response = await fetchImpl(url, { signal: options.signal });
        if (!response.ok) throw new WorldCacheError('http', `World file returned ${response.status}: ${file.path}`);
        await cache.put(url, response.clone());
        downloadedFiles += 1;
        downloadedBytes += file.bytes;
        completedFiles += 1;
        completedBytes += file.bytes;
        report();
      } catch (error) {
        if (!failure) failure = error;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, () => worker()));
  } catch (error) {
    failure = failure ?? error;
  }
  if (failure) {
    const code = errorCode(failure);
    const message = failure instanceof Error ? failure.message : String(failure);
    throw new WorldCacheError(code, message);
  }
  return { cacheName, downloadedFiles, downloadedBytes, totalFiles, totalBytes };
}

export async function deleteWorldCache(version: string): Promise<void> {
  if (!worldCacheSupported()) return;
  await caches.delete(worldCacheName(version));
}

export async function cleanupOldWorldCaches(keepVersion: string): Promise<string[]> {
  if (!worldCacheSupported()) return [];
  const names = await caches.keys();
  const obsolete = obsoleteWorldCaches(names, keepVersion);
  await Promise.all(obsolete.map((name) => caches.delete(name)));
  return obsolete;
}
