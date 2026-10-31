import type { DistrictId } from '../../sim/types';
import type { PlaceDef } from '../../data/places';
import { PLACES } from '../../data/places';
import { DISTRICT_MAP, districtAt } from '../../data/districts';
import { terrainHeight } from '../../sim/world';
import type { WorldData } from '../../world/types';
import type { Obstacle } from '../worldGeometry';
import type { WorldAdapter, RenderPlace } from './types';
import type { GeoCollisionWorld } from './collision';
import type { RoadIndex } from './roadIndex';

const LEGACY_BOUNDS = { minX: -245, maxX: 255, minZ: -235, maxZ: 185 };

function clampToBounds(x: number, z: number, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): [number, number] {
  return [Math.max(bounds.minX, Math.min(bounds.maxX, x)), Math.max(bounds.minZ, Math.min(bounds.maxZ, z))];
}

function asRenderPlaces(places: PlaceDef[]): RenderPlace[] {
  return places.map((place) => ({ ...place, worldPos: [place.pos[0], place.pos[1]] }));
}

export function createLegacyAdapter(quality: string, obstacles: Obstacle[]): WorldAdapter {
  void quality;
  return {
    mode: 'legacy',
    places: asRenderPlaces(PLACES),
    bounds: LEGACY_BOUNDS,
    terrainHeight,
    districtAt,
    clamp: (x, z) => clampToBounds(x, z, LEGACY_BOUNDS),
    collide: (x, z, radius) => {
      let px = x;
      let pz = z;
      for (const obstacle of obstacles) {
        const dx = px - obstacle.x;
        const dz = pz - obstacle.z;
        const min = obstacle.r + radius;
        const d = Math.hypot(dx, dz);
        if (d < min && d > 0.001) {
          px = obstacle.x + (dx / d) * min;
          pz = obstacle.z + (dz / d) * min;
        }
      }
      return [px, pz];
    },
    spawnForDistrict: (district) => {
      const zone = DISTRICT_MAP[district];
      return [zone.center[0] + 5, zone.center[1] + 5];
    },
    zoneRadius: (district) => DISTRICT_MAP[district].radius,
    crowdCenter: (district) => DISTRICT_MAP[district].center,
    crowdRadius: (district) => DISTRICT_MAP[district].radius,
    toWorldPosition: (_district, pos) => pos,
    placePedestrian: (x, z) => [x, z],
  };
}

interface GeoAdapterOptions {
  world: WorldData;
  collision: GeoCollisionWorld;
  roads: RoadIndex;
  terrainHeight: (x: number, z: number) => number;
}

export function createGeoAdapter(options: GeoAdapterOptions): WorldAdapter {
  const { world, collision, roads, terrainHeight: height } = options;
  const bounds = {
    minX: world.manifest.bounds.minX,
    maxX: world.manifest.bounds.maxX,
    minZ: world.manifest.bounds.minZ,
    maxZ: world.manifest.bounds.maxZ,
  };
  const anchor = world.districts.find((district) => district.id === 'nlongkak');
  const anchorX = anchor?.gameX ?? (bounds.minX + bounds.maxX) / 2;
  const anchorZ = anchor?.gameZ ?? (bounds.minZ + bounds.maxZ) / 2;
  const oldCenter = DISTRICT_MAP.nlongkak.center;
  const scale = 2.2;
  const clamp = (x: number, z: number): [number, number] => clampToBounds(x, z, {
    minX: bounds.minX + 8,
    maxX: bounds.maxX - 8,
    minZ: bounds.minZ + 8,
    maxZ: bounds.maxZ - 8,
  });
  const pedestrianCache = new Map<string, [number, number]>();

  const snapToRoad = (x: number, z: number, sideOffset: number, sideSeed: number): [number, number] => {
    const hit = roads.nearest(x, z, 90);
    if (!hit) return collision.resolve(x, z, 0.45);
    const side = sideSeed % 2 === 0 ? 1 : -1;
    const px = hit.x - hit.dirZ * sideOffset * side;
    const pz = hit.z + hit.dirX * sideOffset * side;
    return collision.resolve(px, pz, 0.45);
  };

  const placePedestrian = (x: number, z: number): [number, number] => {
    const [cx, cz] = clamp(x, z);
    const key = `${cx.toFixed(1)}:${cz.toFixed(1)}`;
    const cached = pedestrianCache.get(key);
    if (cached) return cached;
    let [px, pz] = collision.resolve(cx, cz, 0.45);
    const hit = roads.nearest(px, pz, 28);
    if (hit) {
      const side = Math.round((px + pz) * 0.25) % 2 === 0 ? 1 : -1;
      px = hit.x - hit.dirZ * 1.35 * side;
      pz = hit.z + hit.dirX * 1.35 * side;
      [px, pz] = collision.resolve(px, pz, 0.45);
    }
    [px, pz] = clamp(px, pz);
    if (pedestrianCache.size > 4000) pedestrianCache.clear();
    pedestrianCache.set(key, [px, pz]);
    return [px, pz];
  };

  const mapLegacy = (pos: [number, number]): [number, number] => {
    const x = anchorX + (pos[0] - oldCenter[0]) * scale;
    const z = anchorZ + (pos[1] - oldCenter[1]) * scale;
    return placePedestrian(x, z);
  };

  const spawn = (() => {
    const hit = roads.nearest(anchorX, anchorZ, 160);
    if (!hit) return collision.resolve(anchorX, anchorZ, 0.5);
    const side = 1;
    return collision.resolve(hit.x - hit.dirZ * 2.8 * side, hit.z + hit.dirX * 2.8 * side, 0.5);
  })();

  const places: RenderPlace[] = PLACES
    .filter((place) => place.district === 'nlongkak')
    .map((place, index) => {
      const baseX = anchorX + (place.pos[0] - oldCenter[0]) * scale;
      const baseZ = anchorZ + (place.pos[1] - oldCenter[1]) * scale;
      const worldPos = snapToRoad(baseX, baseZ, 2.4, index);
      return { ...place, worldPos };
    });

  return {
    mode: 'geographic',
    places,
    bounds,
    terrainHeight: height,
    districtAt: () => 'nlongkak',
    clamp,
    collide: (x, z, radius) => {
      const [cx, cz] = clamp(x, z);
      return collision.resolve(cx, cz, radius);
    },
    spawnForDistrict: () => spawn,
    zoneRadius: () => 850,
    crowdCenter: () => [anchorX, anchorZ],
    crowdRadius: () => 220,
    toWorldPosition: (district, pos) => {
      if (district !== 'nlongkak') return pos;
      return mapLegacy(pos);
    },
    placePedestrian,
  };
}

export function geoWorldAvailable(world: WorldData | null): world is WorldData {
  return Boolean(world && world.manifest.area.id === 'nlongkak');
}
