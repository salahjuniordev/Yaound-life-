import type { DistrictId } from '../../sim/types';
import type { PlaceDef } from '../../data/places';

export type RenderWorldMode = 'legacy' | 'geographic';

export interface RenderPlace extends PlaceDef {
  worldPos: [number, number];
}

export interface WorldAdapter {
  mode: RenderWorldMode;
  places: RenderPlace[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  terrainHeight: (x: number, z: number) => number;
  districtAt: (x: number, z: number) => DistrictId;
  clamp: (x: number, z: number) => [number, number];
  collide: (x: number, z: number, radius: number) => [number, number];
  spawnForDistrict: (district: DistrictId) => [number, number];
  zoneRadius: (district: DistrictId) => number;
  crowdCenter: (district: DistrictId) => [number, number];
  crowdRadius: (district: DistrictId) => number;
  toWorldPosition: (district: DistrictId, pos: [number, number]) => [number, number];
  placePedestrian: (x: number, z: number) => [number, number];
}
