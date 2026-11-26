import type { DistrictId } from '../../sim/types';
import type { PlaceDef } from '../../data/places';
import { PLACES } from '../../data/places';
import { DISTRICT_MAP, districtAt } from '../../data/districts';
import { terrainHeight } from '../../sim/world';
import type { WorldData, WorldRoad } from '../../world/types';
import type { Obstacle } from '../worldGeometry';
import type { WorldAdapter, RenderPlace, PedestrianRoute } from './types';
import type { GeoCollisionWorld } from './collision';
import type { RoadIndex } from './roadIndex';

const LEGACY_BOUNDS = { minX: -245, maxX: 255, minZ: -235, maxZ: 185 };

function clampToBounds(x: number, z: number, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): [number, number] {
  return [Math.max(bounds.minX, Math.min(bounds.maxX, x)), Math.max(bounds.minZ, Math.min(bounds.maxZ, z))];
}

function hashSide(x: number, z: number): 1 | -1 {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n) > 0.5 ? 1 : -1;
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
  const districtId = world.manifest.area.id as DistrictId;
  const anchor = world.districts.find((district) => district.id === districtId);
  const anchorX = anchor?.gameX ?? (bounds.minX + bounds.maxX) / 2;
  const anchorZ = anchor?.gameZ ?? (bounds.minZ + bounds.maxZ) / 2;
  const oldCenter = DISTRICT_MAP[districtId]?.center ?? [anchorX, anchorZ];
  const scale = 2.2;
  const clamp = (x: number, z: number): [number, number] => clampToBounds(x, z, {
    minX: bounds.minX + 8,
    maxX: bounds.maxX - 8,
    minZ: bounds.minZ + 8,
    maxZ: bounds.maxZ - 8,
  });
  const pedestrianCache = new Map<string, [number, number]>();

  // Footways, paths and pedestrian streets are walkable across their width,
  // so their users stay near the centreline. Vehicle roads put walkers on the
  // raised pavement outside the carriageway.
  const pathSurface = new Set(['footway', 'path', 'cycleway', 'steps', 'pedestrian', 'track']);
  const majorRoad = new Set(['trunk', 'primary', 'secondary', 'tertiary']);
  const sidewalkOffset = (width: number): number => Math.max(0.85, width / 2 + 0.9);
  const pedestrianOffset = (road: WorldRoad): number =>
    pathSurface.has(road.roadClass)
      ? Math.max(0, Math.min(0.9, road.width / 2 - 0.3))
      : sidewalkOffset(road.width);

  // Roads are drawn a few centimetres above the terrain. Sampling only the
  // heightfield would bury the player's and pedestrians' feet in the asphalt
  // or pavement, so add the matching surface lift while walking on a street.
  const surfaceLift = (road: WorldRoad, distance: number): number => {
    if (road.bridge || road.tunnel) return 0;
    const half = road.width / 2;
    if (pathSurface.has(road.roadClass)) return distance <= half ? 0.075 : 0;
    if (distance <= half) return 0.095;
    if (distance <= half + 0.64) return 0.072;
    const outer = half + (majorRoad.has(road.roadClass) ? 2.05 : 1.78);
    return distance <= outer ? 0.142 : 0;
  };
  const surfaceHeight = (x: number, z: number): number => {
    const base = height(x, z);
    const hit = roads.nearestLocal(x, z, 26);
    return base + (hit ? surfaceLift(hit.road, hit.distance) : 0);
  };

  const safeSidewalkPoint = (x: number, z: number): [number, number] | null => {
    const [rx, rz] = collision.resolve(x, z, 0.45);
    const shift = Math.hypot(rx - x, rz - z);
    if (shift > 0.3 || collision.nearBuilding(x, z, 0.25)) return null;
    return [rx, rz];
  };

  const snapToRoad = (x: number, z: number, sideOffset: number, sideSeed: number): [number, number] => {
    const hit = roads.nearest(x, z, 90);
    if (!hit) return collision.resolve(x, z, 0.45);
    const side = sideSeed % 2 === 0 ? 1 : -1;
    // Places are interaction anchors, not walkers. Keep them inside the
    // established 3.5 m curb distance used by the runtime place contract even
    // when the underlying street is unusually wide.
    const px = hit.x - hit.dirZ * sideOffset * side;
    const pz = hit.z + hit.dirX * sideOffset * side;
    return collision.resolve(px, pz, 0.45);
  };

  const placePedestrian = (x: number, z: number): [number, number] => {
    const [cx, cz] = clamp(x, z);
    const key = `${cx.toFixed(1)}:${cz.toFixed(1)}`;
    const cached = pedestrianCache.get(key);
    if (cached) return cached;
    const hit = roads.nearest(cx, cz, 32);
    let resolved: [number, number] | null = null;
    if (hit) {
      const offset = pedestrianOffset(hit.road);
      const preferred = hashSide(cx, cz);
      for (const side of [preferred, -preferred]) {
        const px = hit.x - hit.dirZ * offset * side;
        const pz = hit.z + hit.dirX * offset * side;
        resolved = safeSidewalkPoint(px, pz);
        if (resolved) break;
      }
    }
    let [px, pz] = resolved ?? collision.resolve(cx, cz, 0.45);
    [px, pz] = clamp(px, pz);
    if (pedestrianCache.size > 4000) pedestrianCache.clear();
    pedestrianCache.set(key, [px, pz]);
    return [px, pz];
  };

  const sidewalkRoute = (x: number, z: number, length: number): PedestrianRoute | null => {
    const hit = roads.nearest(x, z, 36);
    if (!hit) return null;
    const leftX = -hit.dirZ;
    const leftZ = hit.dirX;
    const side = (x - hit.x) * leftX + (z - hit.z) * leftZ >= 0 ? 1 : -1;
    const offset = pedestrianOffset(hit.road);
    const reach = Math.max(0.8, Math.min(4, length));
    // Do not extend the patrol past either end of the nearest OSM segment:
    // that would cut the corner at a bend and put the walker on the verge.
    const back = Math.max(0, Math.min(reach, hit.t * hit.segment.length));
    const forward = Math.max(0, Math.min(reach, (1 - hit.t) * hit.segment.length));
    if (back + forward < 0.7) return null;
    const make = (along: number): [number, number] => [
      hit.x + hit.dirX * along + leftX * offset * side,
      hit.z + hit.dirZ * along + leftZ * offset * side,
    ];
    let ax: number;
    let az: number;
    let bx: number;
    let bz: number;
    [ax, az] = clamp(...make(-back));
    [bx, bz] = clamp(...make(forward));
    let [rax, raz] = collision.resolve(ax, az, 0.4);
    let [rbx, rbz] = collision.resolve(bx, bz, 0.4);
    if (
      collision.nearBuilding(ax, az, 0.18) ||
      collision.nearBuilding(bx, bz, 0.18) ||
      Math.hypot(rax - ax, raz - az) > 0.25 ||
      Math.hypot(rbx - bx, rbz - bz) > 0.25
    ) {
      [ax, az] = clamp(...make(-back * 0.42));
      [bx, bz] = clamp(...make(forward * 0.42));
      [rax, raz] = collision.resolve(ax, az, 0.4);
      [rbx, rbz] = collision.resolve(bx, bz, 0.4);
    }
    if (Math.hypot(rbx - rax, rbz - raz) < 0.7) return null;
    // The patrol is a straight segment between two points sampled from one OSM
    // way. In compound corners that chord can cut a building even when both
    // ends are clear, so reject it when any probe along the middle half is
    // inside or hugging a footprint.
    for (const t of [0.25, 0.5, 0.75]) {
      const probeX = rax + (rbx - rax) * t;
      const probeZ = raz + (rbz - raz) * t;
      const [probeResolvedX, probeResolvedZ] = collision.resolve(probeX, probeZ, 0.38);
      if (
        collision.nearBuilding(probeX, probeZ, 0.2) ||
        Math.hypot(probeResolvedX - probeX, probeResolvedZ - probeZ) > 0.22
      ) {
        return null;
      }
    }
    return { ax: rax, az: raz, bx: rbx, bz: rbz };
  };

  const resolveCamera = (
    from: [number, number, number],
    to: [number, number, number],
  ): [number, number, number] => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const dz = to[2] - from[2];
    const distance = Math.hypot(dx, dz);
    let safeT = 1;
    const steps = Math.max(4, Math.ceil(distance / 0.65));
    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const x = from[0] + dx * t;
      const z = from[2] + dz * t;
      const y = from[1] + dy * t;
      const ground = surfaceHeight(x, z);
      if (!Number.isFinite(ground) || y < ground + 0.55) {
        safeT = Math.max(0.14, (step - 1) / steps);
        break;
      }
    }
    const blocked = collision.cameraBlockFraction(
      from[0],
      from[2],
      from[1],
      to[0],
      to[2],
      to[1],
      surfaceHeight,
      0.32,
    );
    if (blocked !== null) safeT = Math.min(safeT, Math.max(0.14, blocked));
    return [from[0] + dx * safeT, from[1] + dy * safeT, from[2] + dz * safeT];
  };

  const mapLegacy = (pos: [number, number]): [number, number] => {
    const x = anchorX + (pos[0] - oldCenter[0]) * scale;
    const z = anchorZ + (pos[1] - oldCenter[1]) * scale;
    return placePedestrian(x, z);
  };

  const spawn = (() => {
    // Prefer a street whose pavement still lies within the established 5 m
    // spawn-to-centreline contract. Some packs contain an unusually wide
    // carriageway at the district anchor; spawning on its asphalt looked
    // wrong and defeated the sidewalk placement work.
    const hit =
      roads.nearest(anchorX, anchorZ, 160, (road) => road.width <= 8) ??
      roads.nearest(anchorX, anchorZ, 160);
    if (!hit) return collision.resolve(anchorX, anchorZ, 0.5);
    const side = 1;
    const onPath = pathSurface.has(hit.road.roadClass);
    const desired = onPath ? pedestrianOffset(hit.road) : Math.max(2.8, pedestrianOffset(hit.road));
    const offset = onPath ? desired : Math.min(4.6, desired);
    return collision.resolve(hit.x - hit.dirZ * offset * side, hit.z + hit.dirX * offset * side, 0.5);
  })();

  const places: RenderPlace[] = PLACES
    .filter((place) => place.district === districtId)
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
    terrainHeight: surfaceHeight,
    districtAt: () => districtId,
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
      if (district !== districtId) return pos;
      return mapLegacy(pos);
    },
    placePedestrian,
    sidewalkRoute,
    resolveCamera,
  };
}

export function geoWorldAvailable(world: WorldData | null): world is WorldData {
  return Boolean(world);
}
