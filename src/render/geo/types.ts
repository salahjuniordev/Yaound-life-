import type { DistrictId } from '../../sim/types';
import type { PlaceDef } from '../../data/places';

export type RenderWorldMode = 'legacy' | 'geographic';

export interface RenderPlace extends PlaceDef {
  worldPos: [number, number];
}

export interface PedestrianRoute {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

export interface WorldAdapter {
  mode: RenderWorldMode;
  places: RenderPlace[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Walkable ground, including bridge decks and the rendered road/pavement lift. */
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
  /** A short sidewalk-following patrol between two collision-safe points. */
  sidewalkRoute?: (x: number, z: number, length: number) => PedestrianRoute | null;
  /** Pulls the third-person camera in before terrain or a building blocks it. */
  resolveCamera?: (from: [number, number, number], to: [number, number, number]) => [number, number, number];
}
