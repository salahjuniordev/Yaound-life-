import type { QualityTier } from './controls';

export type CrowdLod = 'full' | 'simple' | 'impostor';

export interface LodDistances {
  full: number;
  simple: number;
  impostor: number;
}

export const LOD_DISTANCES: Record<QualityTier, LodDistances> = {
  low: { full: 16, simple: 44, impostor: 132 },
  mid: { full: 24, simple: 64, impostor: 176 },
  high: { full: 34, simple: 90, impostor: 231 },
};

export function crowdLodFor(distance: number, quality: QualityTier): CrowdLod {
  const d = LOD_DISTANCES[quality] ?? LOD_DISTANCES.mid;
  if (!Number.isFinite(distance) || distance <= 0) return 'full';
  if (distance <= d.full) return 'full';
  if (distance <= d.simple) return 'simple';
  return 'impostor';
}
