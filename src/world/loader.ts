import type {
  BuildingGeometry,
  BuildingMeta,
  ChunkRef,
  Heightfield,
  Poi,
  WaterFeature,
  WorldData,
  WorldDistrictAnchor,
  WorldManifest,
  WorldRoad,
} from './types';
import { assertValidManifest } from './manifest';
import { decodeHeightfield } from './terrain';
import { decodeBuildings, type DecodedBuilding } from './buildings';

export type WorldLoadErrorCode = 'network' | 'http' | 'parse' | 'version' | 'missing' | 'unsupported';

export class WorldLoadError extends Error {
  readonly code: WorldLoadErrorCode;
  readonly url?: string;

  constructor(code: WorldLoadErrorCode, message: string, url?: string) {
    super(message);
    this.name = 'WorldLoadError';
    this.code = code;
    this.url = url;
  }
}

export interface WorldLoadOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface LoadedChunk {
  ref: ChunkRef;
  terrain: Heightfield;
  roads: WorldRoad[];
  buildings: BuildingGeometry[];
  decodedBuildings: DecodedBuilding[];
  pois: Poi[];
}

export function joinWorldUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${path.replace(/^\/+/, '')}`;
}

async function fetchBuffer(url: string, options: WorldLoadOptions = {}): Promise<ArrayBuffer> {
  const impl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await impl(url, { signal: options.signal });
  } catch (error) {
    throw new WorldLoadError('network', `World asset request failed: ${error instanceof Error ? error.message : String(error)}`, url);
  }
  if (response.status === 404) throw new WorldLoadError('missing', `World asset not found: ${url}`, url);
  if (!response.ok) throw new WorldLoadError('http', `World asset returned ${response.status}: ${url}`, url);
  try {
    return await response.arrayBuffer();
  } catch (error) {
    throw new WorldLoadError('network', `Could not read world asset: ${url}`, url);
  }
}

async function fetchJson<T>(url: string, options: WorldLoadOptions = {}): Promise<T> {
  const buffer = await fetchBuffer(url, options);
  try {
    return JSON.parse(new TextDecoder().decode(buffer)) as T;
  } catch {
    throw new WorldLoadError('parse', `Invalid JSON world asset: ${url}`, url);
  }
}

export async function loadManifest(baseUrl: string, options: WorldLoadOptions = {}): Promise<WorldManifest> {
  const url = joinWorldUrl(baseUrl, 'manifest.json');
  const raw = await fetchJson<unknown>(url, options);
  try {
    return assertValidManifest(raw);
  } catch (error) {
    throw new WorldLoadError('version', error instanceof Error ? error.message : String(error), url);
  }
}

export async function loadWorldData(
  baseUrl: string,
  manifest: WorldManifest,
  options: WorldLoadOptions = {},
): Promise<WorldData> {
  const [roads, pois, water, districts, terrainBuffer] = await Promise.all([
    fetchJson<WorldRoad[]>(joinWorldUrl(baseUrl, 'roads/network.json'), options),
    fetchJson<Poi[]>(joinWorldUrl(baseUrl, 'pois/pois.json'), options),
    fetchJson<WaterFeature[]>(joinWorldUrl(baseUrl, 'water/water.json'), options),
    fetchJson<WorldDistrictAnchor[]>(joinWorldUrl(baseUrl, 'districts/districts.json'), options),
    fetchBuffer(joinWorldUrl(baseUrl, 'terrain/heightfield.bin'), options),
  ]);
  let coarseTerrain: Heightfield;
  try {
    coarseTerrain = decodeHeightfield(terrainBuffer);
  } catch (error) {
    throw new WorldLoadError('parse', `Invalid coarse terrain: ${error instanceof Error ? error.message : String(error)}`);
  }
  return { manifest, roads, pois, water, districts, coarseTerrain };
}

export async function loadChunk(
  baseUrl: string,
  manifest: WorldManifest,
  ref: ChunkRef,
  options: WorldLoadOptions = {},
): Promise<LoadedChunk> {
  const [terrainBuffer, roads, buildingBuffer, meta, pois] = await Promise.all([
    fetchBuffer(joinWorldUrl(baseUrl, ref.terrainFile), options),
    fetchJson<WorldRoad[]>(joinWorldUrl(baseUrl, ref.roadsFile), options),
    fetchBuffer(joinWorldUrl(baseUrl, ref.buildingsFile), options),
    fetchJson<BuildingMeta[]>(joinWorldUrl(baseUrl, ref.buildingsMetaFile), options),
    fetchJson<Poi[]>(joinWorldUrl(baseUrl, ref.poisFile), options),
  ]);
  let terrain: Heightfield;
  try {
    terrain = decodeHeightfield(terrainBuffer);
  } catch (error) {
    throw new WorldLoadError('parse', `Invalid terrain for ${ref.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
  let decoded;
  try {
    decoded = decodeBuildings(buildingBuffer);
  } catch (error) {
    throw new WorldLoadError('parse', `Invalid buildings for ${ref.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (decoded.length !== meta.length) {
    throw new WorldLoadError('parse', `Building metadata mismatch for ${ref.id}: ${decoded.length} geometries, ${meta.length} records`);
  }
  const buildings: BuildingGeometry[] = decoded.map((geometry, index) => ({ meta: meta[index], ring: geometry.ring }));
  return { ref, terrain, roads, buildings, decodedBuildings: decoded, pois };
}

export function findChunkRef(manifest: WorldManifest, chunkId: string): ChunkRef | null {
  return manifest.chunks.find((c) => c.id === chunkId) ?? null;
}
