import type { WorldBounds, WorldOrigin } from './types';
import { gameToProjected, projectedToGame } from './transform';

export interface ChunkIndex {
  ix: number;
  iz: number;
}

export interface ChunkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function chunkKey(ix: number, iz: number): string {
  return `c_${ix}_${iz}`;
}

export function chunkIndexFromProjected(
  east: number,
  north: number,
  origin: Pick<WorldOrigin, 'east' | 'north'>,
  chunkSize: number,
): ChunkIndex {
  return {
    ix: Math.floor((east - origin.east) / chunkSize),
    iz: Math.floor((north - origin.north) / chunkSize),
  };
}

export function chunkIndexFromGame(
  x: number,
  z: number,
  origin: Pick<WorldOrigin, 'east' | 'north'>,
  chunkSize: number,
  unitsPerMetre = 1,
): ChunkIndex {
  const projected = gameToProjected({ x, z }, origin, unitsPerMetre);
  return chunkIndexFromProjected(projected.east, projected.north, origin, chunkSize);
}

export function chunkBounds(
  ix: number,
  iz: number,
  origin: Pick<WorldOrigin, 'east' | 'north'>,
  chunkSize: number,
  unitsPerMetre = 1,
): ChunkBounds {
  const size = chunkSize * unitsPerMetre;
  const minX = ix * size;
  const maxX = (ix + 1) * size;
  const minZ = -(iz + 1) * size;
  const maxZ = -iz * size;
  return {
    minX: minX === 0 ? 0 : minX,
    maxX: maxX === 0 ? 0 : maxX,
    minZ: minZ === 0 ? 0 : minZ,
    maxZ: maxZ === 0 ? 0 : maxZ,
  };
}

export function chunkBoundsFromProjected(
  ix: number,
  iz: number,
  origin: Pick<WorldOrigin, 'east' | 'north'>,
  chunkSize: number,
  unitsPerMetre = 1,
): WorldBounds {
  const game = chunkBounds(ix, iz, origin, chunkSize, unitsPerMetre);
  return {
    minX: game.minX,
    maxX: game.maxX,
    minZ: game.minZ,
    maxZ: game.maxZ,
    minEast: origin.east + ix * chunkSize,
    maxEast: origin.east + (ix + 1) * chunkSize,
    minNorth: origin.north + iz * chunkSize,
    maxNorth: origin.north + (iz + 1) * chunkSize,
  };
}

export function worldBoundsFromProjected(
  minEast: number,
  maxEast: number,
  minNorth: number,
  maxNorth: number,
  origin: Pick<WorldOrigin, 'east' | 'north'>,
  unitsPerMetre = 1,
): WorldBounds {
  const sw = projectedToGame({ east: minEast, north: minNorth }, origin, unitsPerMetre);
  const ne = projectedToGame({ east: maxEast, north: maxNorth }, origin, unitsPerMetre);
  return {
    minX: Math.min(sw.x, ne.x),
    maxX: Math.max(sw.x, ne.x),
    minZ: Math.min(sw.z, ne.z),
    maxZ: Math.max(sw.z, ne.z),
    minEast,
    maxEast,
    minNorth,
    maxNorth,
  };
}

export function chunkContains(bounds: ChunkBounds, x: number, z: number): boolean {
  return x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ;
}

export function chunkIdsAround(ix: number, iz: number, radius: number): string[] {
  const out: string[] = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      out.push(chunkKey(ix + dx, iz + dz));
    }
  }
  return out;
}

export function chunkIndexFromKey(id: string): ChunkIndex | null {
  const match = /^c_(-?\d+)_(-?\d+)$/.exec(id);
  if (!match) return null;
  return { ix: Number(match[1]), iz: Number(match[2]) };
}

export function chunkChebyshevDistance(ax: number, az: number, bx: number, bz: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(az - bz));
}
