import { WORLD_FORMAT_VERSION } from './manifest';
import type { WorldManifest } from './types';

export const WORLD_REGISTRY_FORMAT = 'yaounde-life-world-registry';
export const WORLD_REGISTRY_VERSION = 1;
export const WORLD_REGISTRY_FILE = 'registry.json';

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const VERSION_PATTERN = /^[A-Za-z0-9._-]+$/;
const PACK_PATH_PATTERN = /^world\/[A-Za-z0-9._/-]+$/;

/** A versioned derived pack, keyed to one existing gameplay district. */
export interface WorldPackEntry {
  id: string;
  districtId: string;
  name: string;
  /** Site-relative path, for example `world/v1`. No leading slash. */
  basePath: string;
  worldVersion: string;
  manifestFormatVersion: number;
  /** Precache the initial chunk ring during service-worker install. */
  precacheOnInstall?: boolean;
}

export interface WorldPackRegistry {
  format: typeof WORLD_REGISTRY_FORMAT;
  formatVersion: typeof WORLD_REGISTRY_VERSION;
  generatedAt: string;
  packs: WorldPackEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function safePackPath(value: unknown): string {
  const raw = nonEmptyString(value, 'basePath').replace(/^\/+/, '').replace(/\/+$/, '');
  if (raw.includes('..') || raw.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    throw new Error(`invalid basePath: ${String(value)}`);
  }
  if (!PACK_PATH_PATTERN.test(raw)) throw new Error(`basePath must be a site-relative path below world/: ${raw}`);
  return raw;
}

/**
 * Validate and normalise a runtime pack registry.
 *
 * Entries with a different manifest format are retained so callers can report
 * an explicit compatibility problem instead of silently loading them.
 */
export function validateWorldPackRegistry(raw: unknown): WorldPackRegistry {
  if (!isRecord(raw)) throw new Error('World registry must be an object');
  if (raw.format !== WORLD_REGISTRY_FORMAT) throw new Error('Unsupported world registry format');
  if (raw.formatVersion !== WORLD_REGISTRY_VERSION) {
    throw new Error(`Unsupported world registry version: ${String(raw.formatVersion)}`);
  }
  const generatedAt = nonEmptyString(raw.generatedAt, 'generatedAt');
  if (!Array.isArray(raw.packs)) throw new Error('World registry packs must be an array');

  const ids = new Set<string>();
  const districts = new Set<string>();
  const basePaths = new Set<string>();
  const packs: WorldPackEntry[] = [];
  for (const value of raw.packs) {
    if (!isRecord(value)) throw new Error('World pack entry must be an object');
    const id = nonEmptyString(value.id, 'pack.id');
    if (!ID_PATTERN.test(id)) throw new Error(`Invalid pack id: ${id}`);
    if (ids.has(id)) throw new Error(`Duplicate pack id: ${id}`);
    ids.add(id);

    const districtId = nonEmptyString(value.districtId, 'pack.districtId');
    if (!ID_PATTERN.test(districtId)) throw new Error(`Invalid district id: ${districtId}`);
    if (districts.has(districtId)) throw new Error(`Duplicate district pack: ${districtId}`);
    districts.add(districtId);

    const name = nonEmptyString(value.name, 'pack.name');
    const basePath = safePackPath(value.basePath);
    if (basePaths.has(basePath)) throw new Error(`Duplicate pack basePath: ${basePath}`);
    basePaths.add(basePath);
    const worldVersion = nonEmptyString(value.worldVersion, 'pack.worldVersion');
    if (!VERSION_PATTERN.test(worldVersion)) throw new Error(`Invalid world version: ${worldVersion}`);
    const manifestFormatVersion = Number(value.manifestFormatVersion);
    if (!Number.isInteger(manifestFormatVersion) || manifestFormatVersion < 1) {
      throw new Error(`Invalid manifest format version for ${id}`);
    }
    if (value.precacheOnInstall !== undefined && typeof value.precacheOnInstall !== 'boolean') {
      throw new Error(`precacheOnInstall must be a boolean for ${id}`);
    }
    packs.push({
      id,
      districtId,
      name,
      basePath,
      worldVersion,
      manifestFormatVersion,
      ...(value.precacheOnInstall === true ? { precacheOnInstall: true } : {}),
    });
  }

  return {
    format: WORLD_REGISTRY_FORMAT,
    formatVersion: WORLD_REGISTRY_VERSION,
    generatedAt,
    packs,
  };
}

export function worldPackCompatibilityError(pack: WorldPackEntry): string | null {
  if (pack.manifestFormatVersion !== WORLD_FORMAT_VERSION) {
    return `World pack ${pack.id} uses manifest format ${pack.manifestFormatVersion}; this build supports ${WORLD_FORMAT_VERSION}`;
  }
  return null;
}

/** Select the pack registered for a gameplay district, or null for legacy fallback. */
export function worldPackForDistrict(registry: WorldPackRegistry, districtId: string): WorldPackEntry | null {
  return registry.packs.find((pack) => pack.districtId === districtId) ?? null;
}

export function compatibleWorldPackForDistrict(
  registry: WorldPackRegistry,
  districtId: string,
): WorldPackEntry | null {
  const pack = worldPackForDistrict(registry, districtId);
  return pack && !worldPackCompatibilityError(pack) ? pack : null;
}

/** Convert `world/v1` into the deployed URL for the current app base. */
export function worldPackBaseUrl(appBaseUrl: string, pack: WorldPackEntry): string {
  const base = appBaseUrl.endsWith('/') ? appBaseUrl : `${appBaseUrl}/`;
  return `${base}${pack.basePath.replace(/^\/+/, '')}`;
}

/**
 * Check that the loaded manifest is exactly the registered pack. Version and
 * district mismatches are fallback errors, not warnings, so a stale registry
 * cannot silently render the wrong neighbourhood.
 */
export function assertWorldPackManifest(manifest: WorldManifest, pack: WorldPackEntry): void {
  if (manifest.worldVersion !== pack.worldVersion) {
    throw new Error(`World version ${manifest.worldVersion} does not match registered ${pack.worldVersion}`);
  }
  if (manifest.area.id !== pack.districtId) {
    throw new Error(`World area ${manifest.area.id} does not match registered district ${pack.districtId}`);
  }
}

/**
 * Built-in compatibility mapping used only when `world/registry.json` is
 * missing. The checked-in registry is authoritative; tests assert these
 * entries still match the generated manifests.
 */
export const BUILTIN_WORLD_REGISTRY: WorldPackRegistry = {
  format: WORLD_REGISTRY_FORMAT,
  formatVersion: WORLD_REGISTRY_VERSION,
  generatedAt: '2026-11-18T00:00:00.000Z',
  packs: [
    {
      id: 'nlongkak',
      districtId: 'nlongkak',
      name: 'Nlongkak',
      basePath: 'world/v1',
      worldVersion: 'nlongkak-2026-10-30-v2',
      manifestFormatVersion: WORLD_FORMAT_VERSION,
      precacheOnInstall: true,
    },
    {
      id: 'mvog_mbi',
      districtId: 'mvog_mbi',
      name: 'Mvog-Mbi',
      basePath: 'world/mvog-mbi/v1',
      worldVersion: 'mvog-mbi-2026-10-30-v1',
      manifestFormatVersion: WORLD_FORMAT_VERSION,
      precacheOnInstall: true,
    },
    {
      id: 'mokolo',
      districtId: 'mokolo',
      name: 'Mokolo',
      basePath: 'world/mokolo/v1',
      worldVersion: 'mokolo-2026-10-30-v1',
      manifestFormatVersion: WORLD_FORMAT_VERSION,
    },
  ],
};
