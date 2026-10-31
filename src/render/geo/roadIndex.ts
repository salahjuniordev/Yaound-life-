import type { WorldRoad } from '../../world/types';

const CELL = 40;

export interface RoadSegment {
  road: WorldRoad;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  length: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface NearestRoadPoint {
  x: number;
  z: number;
  distance: number;
  dirX: number;
  dirZ: number;
  road: WorldRoad;
  segment: RoadSegment;
  t: number;
}

function key(ix: number, iz: number): string {
  return `${ix}:${iz}`;
}

export class RoadIndex {
  private segments: RoadSegment[] = [];
  private cells = new Map<string, RoadSegment[]>();
  private cell = CELL;

  constructor(roads: WorldRoad[]) {
    for (const road of roads) {
      if (!road.walkable || road.points.length < 2) continue;
      for (let i = 0; i < road.points.length - 1; i++) {
        const [ax, az] = road.points[i];
        const [bx, bz] = road.points[i + 1];
        const length = Math.hypot(bx - ax, bz - az);
        if (length < 0.1) continue;
        const segment: RoadSegment = {
          road,
          ax,
          az,
          bx,
          bz,
          length,
          minX: Math.min(ax, bx),
          maxX: Math.max(ax, bx),
          minZ: Math.min(az, bz),
          maxZ: Math.max(az, bz),
        };
        this.segments.push(segment);
        const minIx = Math.floor(segment.minX / CELL);
        const maxIx = Math.floor(segment.maxX / CELL);
        const minIz = Math.floor(segment.minZ / CELL);
        const maxIz = Math.floor(segment.maxZ / CELL);
        for (let ix = minIx; ix <= maxIx; ix++) {
          for (let iz = minIz; iz <= maxIz; iz++) {
            const bucket = this.cells.get(key(ix, iz));
            if (bucket) bucket.push(segment);
            else this.cells.set(key(ix, iz), [segment]);
          }
        }
      }
    }
  }

  nearest(x: number, z: number, maxDistance = Infinity): NearestRoadPoint | null {
    let best: NearestRoadPoint | null = null;
    const seen = new Set<RoadSegment>();
    const ix = Math.floor(x / CELL);
    const iz = Math.floor(z / CELL);
    const cellRadius = Number.isFinite(maxDistance) ? Math.ceil(maxDistance / CELL) + 1 : 1;
    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const bucket = this.cells.get(key(ix + dx, iz + dz));
        if (!bucket) continue;
        for (const segment of bucket) {
          if (seen.has(segment)) continue;
          seen.add(segment);
          const hit = this.closestOnSegment(x, z, segment);
          if (hit.distance > maxDistance) continue;
          if (!best || hit.distance < best.distance) best = hit;
        }
      }
    }
    if (best) return best;
    if (!Number.isFinite(maxDistance)) return null;
    for (const segment of this.segments) {
      const hit = this.closestOnSegment(x, z, segment);
      if (hit.distance > maxDistance) continue;
      if (!best || hit.distance < best.distance) best = hit;
    }
    return best;
  }

  private closestOnSegment(x: number, z: number, segment: RoadSegment): NearestRoadPoint {
    const dx = segment.bx - segment.ax;
    const dz = segment.bz - segment.az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((x - segment.ax) * dx + (z - segment.az) * dz) / len2)) : 0;
    const px = segment.ax + dx * t;
    const pz = segment.az + dz * t;
    const len = Math.sqrt(len2) || 1;
    return {
      x: px,
      z: pz,
      distance: Math.hypot(x - px, z - pz),
      dirX: dx / len,
      dirZ: dz / len,
      road: segment.road,
      segment,
      t,
    };
  }
}
