import type { ChunkRef, WorldBounds, WorldManifest } from './types';

export const WORLD_FORMAT = 'yaounde-life-world';
export const WORLD_FORMAT_VERSION = 1;
export const WORLD_GENERATOR_VERSION = '1.0.0';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function validateBounds(bounds: WorldBounds | undefined): string[] {
  if (!bounds) return ['missing bounds'];
  const errors: string[] = [];
  for (const key of ['minX', 'maxX', 'minZ', 'maxZ', 'minEast', 'maxEast', 'minNorth', 'maxNorth'] as const) {
    if (!isFiniteNumber(bounds[key])) errors.push(`bounds.${key} is not finite`);
  }
  if (isFiniteNumber(bounds.minX) && isFiniteNumber(bounds.maxX) && bounds.minX >= bounds.maxX) errors.push('bounds.minX must be less than maxX');
  if (isFiniteNumber(bounds.minZ) && isFiniteNumber(bounds.maxZ) && bounds.minZ >= bounds.maxZ) errors.push('bounds.minZ must be less than maxZ');
  if (isFiniteNumber(bounds.minEast) && isFiniteNumber(bounds.maxEast) && bounds.minEast >= bounds.maxEast) errors.push('bounds.minEast must be less than maxEast');
  if (isFiniteNumber(bounds.minNorth) && isFiniteNumber(bounds.maxNorth) && bounds.minNorth >= bounds.maxNorth) errors.push('bounds.minNorth must be less than maxNorth');
  return errors;
}

export function validateChunkRef(ref: ChunkRef): string[] {
  const errors: string[] = [];
  if (!ref.id || !/^c_-?\d+_-?\d+$/.test(ref.id)) errors.push('invalid chunk id');
  if (!Number.isInteger(ref.ix) || !Number.isInteger(ref.iz)) errors.push('chunk indices must be integers');
  if (!ref.terrainFile) errors.push('missing terrain file');
  if (!ref.roadsFile) errors.push('missing roads file');
  if (!ref.buildingsFile) errors.push('missing buildings file');
  if (!ref.buildingsMetaFile) errors.push('missing buildings metadata file');
  if (!ref.poisFile) errors.push('missing pois file');
  if (!Number.isFinite(ref.buildingCount) || ref.buildingCount < 0) errors.push('invalid building count');
  if (!Number.isFinite(ref.roadCount) || ref.roadCount < 0) errors.push('invalid road count');
  if (ref.bounds) {
    if (!isFiniteNumber(ref.bounds.minX) || !isFiniteNumber(ref.bounds.maxX) || !isFiniteNumber(ref.bounds.minZ) || !isFiniteNumber(ref.bounds.maxZ)) {
      errors.push('invalid chunk bounds');
    }
  }
  return errors;
}

export function validateManifest(value: unknown): string[] {
  if (!isRecord(value)) return ['manifest is not an object'];
  const errors: string[] = [];
  if (value.format !== WORLD_FORMAT) errors.push(`unexpected format: ${String(value.format)}`);
  if (value.formatVersion !== WORLD_FORMAT_VERSION) errors.push(`unsupported format version: ${String(value.formatVersion)}`);
  if (typeof value.worldVersion !== 'string' || value.worldVersion.length === 0) errors.push('missing worldVersion');
  if (typeof value.generatorVersion !== 'string') errors.push('missing generatorVersion');
  if (typeof value.generatedAt !== 'string') errors.push('missing generatedAt');
  if (!isRecord(value.projection) || value.projection.id !== 'EPSG:32632') errors.push('projection must be EPSG:32632');
  if (!isRecord(value.origin)) {
    errors.push('missing origin');
  } else {
    for (const key of ['lon', 'lat', 'east', 'north'] as const) {
      if (!isFiniteNumber(value.origin[key])) errors.push(`origin.${key} is not finite`);
    }
  }
  if (!isFiniteNumber(value.unitsPerMetre) || value.unitsPerMetre <= 0) errors.push('unitsPerMetre must be positive');
  if (!isFiniteNumber(value.verticalScale) || value.verticalScale <= 0) errors.push('verticalScale must be positive');
  if (!isFiniteNumber(value.verticalOffset)) errors.push('verticalOffset must be finite');
  if (typeof value.elevationDatum !== 'string' || value.elevationDatum.length === 0) errors.push('missing elevationDatum');
  if (!isFiniteNumber(value.terrainCellSize) || value.terrainCellSize <= 0) errors.push('terrainCellSize must be positive');
  if (!isFiniteNumber(value.coarseTerrainCellSize) || value.coarseTerrainCellSize <= 0) errors.push('coarseTerrainCellSize must be positive');
  if (!isFiniteNumber(value.chunkSize) || value.chunkSize <= 0) errors.push('chunkSize must be positive');
  errors.push(...validateBounds(value.bounds as WorldBounds | undefined));
  if (!Array.isArray(value.sources) || value.sources.length === 0) errors.push('at least one source is required');
  if (!Array.isArray(value.chunks) || value.chunks.length === 0) errors.push('at least one chunk is required');
  if (Array.isArray(value.chunks)) {
    const ids = new Set<string>();
    for (const chunk of value.chunks) {
      if (!isRecord(chunk)) {
        errors.push('chunk reference is not an object');
        continue;
      }
      const chunkErrors = validateChunkRef(chunk as unknown as ChunkRef);
      errors.push(...chunkErrors.map((e) => `chunk ${String(chunk.id)}: ${e}`));
      if (typeof chunk.id === 'string') {
        if (ids.has(chunk.id)) errors.push(`duplicate chunk id ${chunk.id}`);
        ids.add(chunk.id);
      }
    }
  }
  if (!isRecord(value.featureCounts)) errors.push('missing featureCounts');
  if (typeof value.contentHash !== 'string') errors.push('missing contentHash');
  return errors;
}

export function assertValidManifest(value: unknown): WorldManifest {
  const errors = validateManifest(value);
  if (errors.length > 0) throw new Error(`Invalid world manifest: ${errors.join('; ')}`);
  return value as unknown as WorldManifest;
}

export function assertCompatibleWorld(manifest: WorldManifest, expectedWorldVersion?: string): void {
  if (manifest.format !== WORLD_FORMAT) throw new Error('Incompatible world format');
  if (manifest.formatVersion !== WORLD_FORMAT_VERSION) {
    throw new Error(`World format ${manifest.formatVersion} is not supported by this build`);
  }
  if (expectedWorldVersion && manifest.worldVersion !== expectedWorldVersion) {
    throw new Error(`World version ${manifest.worldVersion} does not match expected ${expectedWorldVersion}`);
  }
}
