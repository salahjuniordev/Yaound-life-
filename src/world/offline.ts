import type { WorldManifest } from './types';

export const WORLD_CATALOG_FORMAT = 'yaounde-life-world-catalog';
export const WORLD_CATALOG_VERSION = 1;
export const WORLD_CACHE_PREFIX = 'yaounde-world-';
export const WORLD_CATALOG_FILE = 'files.json';
export const WORLD_PRECACHE_FILE = 'precache.json';

export interface WorldFileEntry {
  path: string;
  bytes: number;
}

export interface WorldFileCatalog {
  format: typeof WORLD_CATALOG_FORMAT;
  formatVersion: typeof WORLD_CATALOG_VERSION;
  worldVersion: string;
  generatedAt: string;
  totalBytes: number;
  files: WorldFileEntry[];
  initial: string[];
}

export type OfflineWorldStatus =
  | 'checking'
  | 'unsupported'
  | 'unavailable'
  | 'not-downloaded'
  | 'partial'
  | 'downloading'
  | 'ready'
  | 'update-available'
  | 'quota-error';

export interface OfflineWorldSnapshot {
  status: OfflineWorldStatus;
  cacheName: string;
  cachedFiles: number;
  totalFiles: number;
  cachedBytes: number;
  totalBytes: number;
  missingBytes: number;
  cachedVersion: string | null;
}

const VERSION_PATTERN = /^[A-Za-z0-9._-]+$/;

export function assertWorldVersion(version: string): string {
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    throw new Error(`Invalid world version: ${String(version)}`);
  }
  return version;
}

export function worldCacheName(version: string): string {
  return `${WORLD_CACHE_PREFIX}${assertWorldVersion(version)}`;
}

export function isWorldCacheName(name: string): boolean {
  return name.startsWith(WORLD_CACHE_PREFIX) && name.length > WORLD_CACHE_PREFIX.length;
}

export function worldVersionFromCacheName(name: string): string | null {
  if (!isWorldCacheName(name)) return null;
  const version = name.slice(WORLD_CACHE_PREFIX.length);
  return VERSION_PATTERN.test(version) ? version : null;
}

export function obsoleteWorldCaches(
  cacheNames: readonly string[],
  keepVersions: string | readonly string[],
): string[] {
  const versions = typeof keepVersions === 'string' ? [keepVersions] : keepVersions;
  const keep = new Set(versions.map(worldCacheName));
  return cacheNames.filter((name) => isWorldCacheName(name) && !keep.has(name));
}

export function validateWorldFileCatalog(raw: unknown): WorldFileCatalog {
  if (!raw || typeof raw !== 'object') throw new Error('World catalog must be an object');
  const value = raw as Record<string, unknown>;
  if (value.format !== WORLD_CATALOG_FORMAT) throw new Error('Unsupported world catalog format');
  if (value.formatVersion !== WORLD_CATALOG_VERSION) throw new Error(`Unsupported world catalog version: ${String(value.formatVersion)}`);
  const worldVersion = assertWorldVersion(String(value.worldVersion ?? ''));
  if (typeof value.generatedAt !== 'string' || value.generatedAt.length === 0) throw new Error('World catalog is missing generatedAt');
  if (!Array.isArray(value.files) || value.files.length === 0) throw new Error('World catalog has no files');
  const seen = new Set<string>();
  const files: WorldFileEntry[] = [];
  let totalBytes = 0;
  for (const entry of value.files) {
    if (!entry || typeof entry !== 'object') throw new Error('World catalog file entry must be an object');
    const record = entry as Record<string, unknown>;
    const path = typeof record.path === 'string' ? record.path.replace(/^\/+/, '') : '';
    if (!path || path.includes('..') || path.startsWith('http://') || path.startsWith('https://')) {
      throw new Error(`Invalid world catalog path: ${String(record.path)}`);
    }
    if (seen.has(path)) throw new Error(`Duplicate world catalog path: ${path}`);
    seen.add(path);
    const bytes = Number(record.bytes);
    if (!Number.isFinite(bytes) || bytes < 0) throw new Error(`Invalid byte size for ${path}`);
    files.push({ path, bytes });
    totalBytes += bytes;
  }
  const initial = Array.isArray(value.initial) ? value.initial : [];
  const initialPaths: string[] = [];
  for (const item of initial) {
    if (typeof item !== 'string') throw new Error('World catalog initial list must contain paths');
    const path = item.replace(/^\/+/, '');
    if (!seen.has(path)) throw new Error(`Initial world file is not in the catalog: ${path}`);
    initialPaths.push(path);
  }
  return {
    format: WORLD_CATALOG_FORMAT,
    formatVersion: WORLD_CATALOG_VERSION,
    worldVersion,
    generatedAt: value.generatedAt,
    totalBytes,
    files,
    initial: initialPaths,
  };
}

export function catalogPaths(catalog: WorldFileCatalog): string[] {
  return catalog.files.map((file) => file.path);
}

export function initialCatalogPaths(catalog: WorldFileCatalog): string[] {
  return [...catalog.initial];
}

export function missingWorldFiles(catalog: WorldFileCatalog, cachedPaths: Iterable<string>): WorldFileEntry[] {
  const cached = new Set([...cachedPaths].map((path) => path.replace(/^\/+/, '')));
  return catalog.files.filter((file) => !cached.has(file.path));
}

export interface OfflineSummaryOptions {
  activeVersion?: string | null;
  cacheNames?: readonly string[];
  downloading?: boolean;
  quotaError?: boolean;
  supported?: boolean;
}

export function summarizeWorldOffline(
  catalog: WorldFileCatalog | null,
  cachedPaths: Iterable<string>,
  options: OfflineSummaryOptions = {},
): OfflineWorldSnapshot {
  const supported = options.supported ?? true;
  const cacheName = catalog ? worldCacheName(catalog.worldVersion) : '';
  const cached = new Set([...cachedPaths].map((path) => path.replace(/^\/+/, '')));
  const files = catalog?.files ?? [];
  const cachedFiles = files.filter((file) => cached.has(file.path));
  const cachedBytes = cachedFiles.reduce((sum, file) => sum + file.bytes, 0);
  const totalBytes = catalog?.totalBytes ?? 0;
  const missingBytes = Math.max(0, totalBytes - cachedBytes);
  const cachedVersion =
    options.cacheNames?.map(worldVersionFromCacheName).find((version): version is string => Boolean(version)) ?? null;
  let status: OfflineWorldStatus;
  if (!supported) status = 'unsupported';
  else if (!catalog) status = 'unavailable';
  else if (options.quotaError) status = 'quota-error';
  else if (options.downloading) status = 'downloading';
  else if (cachedFiles.length === files.length) status = 'ready';
  else if (cachedFiles.length === 0) {
    status = options.cacheNames?.some(isWorldCacheName) ? 'update-available' : 'not-downloaded';
  } else if (options.activeVersion && options.activeVersion !== catalog.worldVersion) status = 'update-available';
  else status = 'partial';
  return {
    status,
    cacheName,
    cachedFiles: cachedFiles.length,
    totalFiles: files.length,
    cachedBytes,
    totalBytes,
    missingBytes,
    cachedVersion,
  };
}

export function downloadProgress(catalog: WorldFileCatalog, cachedPaths: Iterable<string>): {
  completedFiles: number;
  totalFiles: number;
  completedBytes: number;
  totalBytes: number;
  fraction: number;
} {
  const cached = new Set([...cachedPaths].map((path) => path.replace(/^\/+/, '')));
  const done = catalog.files.filter((file) => cached.has(file.path));
  const completedBytes = done.reduce((sum, file) => sum + file.bytes, 0);
  return {
    completedFiles: done.length,
    totalFiles: catalog.files.length,
    completedBytes,
    totalBytes: catalog.totalBytes,
    fraction: catalog.totalBytes > 0 ? completedBytes / catalog.totalBytes : 0,
  };
}

export function catalogMatchesManifest(catalog: WorldFileCatalog, manifest: WorldManifest): boolean {
  return catalog.worldVersion === manifest.worldVersion;
}

export function formatBytes(bytes: number): string {
  const value = Math.max(0, Math.round(bytes));
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
