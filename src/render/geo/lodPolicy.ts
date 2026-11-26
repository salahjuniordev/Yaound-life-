import type { QualityTier } from '../controls';

export interface GeoLodPolicy {
  /** Distance from the player to the chunk bounds for near building detail. */
  building: number;
  /** Distance from the player to the chunk bounds for street furniture. */
  props: number;
  /** Keep near geometry cached beyond the visible threshold to avoid churn. */
  retainNear: number;
  /** Maximum loaded chunks, including one warm chunk beyond the 3 x 3 ring. */
  chunkCap: number;
  /** Building/prop casters beyond this distance cannot reach the shadow camera. */
  shadowCasters: number;
}

export const GEO_LOD_POLICY: Record<QualityTier, GeoLodPolicy> = {
  low: { building: 210, props: 190, retainNear: 210, chunkCap: 5, shadowCasters: 0 },
  mid: { building: 340, props: 330, retainNear: 430, chunkCap: 10, shadowCasters: 0 },
  // High keeps the same streaming footprint as mid, while spending memory on
  // near facades only around the player. The old 4 x 4 working set held near
  // geometry for thousands of buildings that the 300 m fog could never reveal.
  high: { building: 360, props: 420, retainNear: 470, chunkCap: 10, shadowCasters: 210 },
};

/** Low always builds its single detail level; mid/high defer far chunks. */
export function shouldBuildNear(quality: QualityTier, distance: number): boolean {
  return quality === 'low' || distance < GEO_LOD_POLICY[quality].building;
}

export function shouldRetainNear(quality: QualityTier, distance: number): boolean {
  return quality === 'low' || distance <= GEO_LOD_POLICY[quality].retainNear;
}
