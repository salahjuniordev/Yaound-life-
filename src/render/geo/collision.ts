import { closestPointOnPolygon, pointInPolygon, resolveCirclePolygon } from '../../world/buildings';
import type { BuildingGeometry } from '../../world/types';

export interface CircleObstacle {
  x: number;
  z: number;
  r: number;
}

interface BuildingCollider {
  id: string;
  ring: [number, number][];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface ChunkColliders {
  buildings: BuildingCollider[];
  circles: CircleObstacle[];
}

const CELL = 24;

function cellKey(ix: number, iz: number): string {
  return `${ix}:${iz}`;
}

export class GeoCollisionWorld {
  private buildings = new Map<string, BuildingCollider[]>();
  private circles = new Map<string, CircleObstacle[]>();
  private chunks = new Map<string, ChunkColliders>();

  addChunk(chunkId: string, buildings: BuildingGeometry[], circles: CircleObstacle[] = []): void {
    this.removeChunk(chunkId);
    const colliders: BuildingCollider[] = [];
    for (const building of buildings) {
      const ring = building.ring;
      if (ring.length < 3) continue;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const [x, z] of ring) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
      const collider: BuildingCollider = { id: building.meta.id, ring, minX, maxX, minZ, maxZ };
      colliders.push(collider);
      const minIx = Math.floor(minX / CELL);
      const maxIx = Math.floor(maxX / CELL);
      const minIz = Math.floor(minZ / CELL);
      const maxIz = Math.floor(maxZ / CELL);
      for (let ix = minIx; ix <= maxIx; ix++) {
        for (let iz = minIz; iz <= maxIz; iz++) {
          const key = cellKey(ix, iz);
          const bucket = this.buildings.get(key);
          if (bucket) bucket.push(collider);
          else this.buildings.set(key, [collider]);
        }
      }
    }
    for (const circle of circles) {
      if (!Number.isFinite(circle.x) || !Number.isFinite(circle.z) || !(circle.r > 0)) continue;
      const key = cellKey(Math.floor(circle.x / CELL), Math.floor(circle.z / CELL));
      const bucket = this.circles.get(key);
      if (bucket) bucket.push(circle);
      else this.circles.set(key, [circle]);
    }
    this.chunks.set(chunkId, { buildings: colliders, circles });
  }

  removeChunk(chunkId: string): void {
    const existing = this.chunks.get(chunkId);
    if (!existing) return;
    for (const collider of existing.buildings) {
      const minIx = Math.floor(collider.minX / CELL);
      const maxIx = Math.floor(collider.maxX / CELL);
      const minIz = Math.floor(collider.minZ / CELL);
      const maxIz = Math.floor(collider.maxZ / CELL);
      for (let ix = minIx; ix <= maxIx; ix++) {
        for (let iz = minIz; iz <= maxIz; iz++) {
          const key = cellKey(ix, iz);
          const bucket = this.buildings.get(key);
          if (!bucket) continue;
          const next = bucket.filter((b) => b !== collider);
          if (next.length === 0) this.buildings.delete(key);
          else this.buildings.set(key, next);
        }
      }
    }
    for (const circle of existing.circles) {
      const key = cellKey(Math.floor(circle.x / CELL), Math.floor(circle.z / CELL));
      const bucket = this.circles.get(key);
      if (!bucket) continue;
      const next = bucket.filter((c) => c !== circle);
      if (next.length === 0) this.circles.delete(key);
      else this.circles.set(key, next);
    }
    this.chunks.delete(chunkId);
  }

  resolve(x: number, z: number, radius: number): [number, number] {
    let px = x;
    let pz = z;
    for (let pass = 0; pass < 2; pass++) {
      const ix = Math.floor(px / CELL);
      const iz = Math.floor(pz / CELL);
      const seen = new Set<BuildingCollider>();
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = this.buildings.get(cellKey(ix + dx, iz + dz));
          if (!bucket) continue;
          for (const collider of bucket) {
            if (seen.has(collider)) continue;
            seen.add(collider);
            if (px < collider.minX - radius || px > collider.maxX + radius) continue;
            if (pz < collider.minZ - radius || pz > collider.maxZ + radius) continue;
            const resolved = resolveCirclePolygon(px, pz, radius, collider.ring);
            if (resolved.collided) {
              px = resolved.x;
              pz = resolved.z;
            }
          }
          const circles = this.circles.get(cellKey(ix + dx, iz + dz));
          if (!circles) continue;
          for (const circle of circles) {
            const cx = px - circle.x;
            const cz = pz - circle.z;
            const min = circle.r + radius;
            const d = Math.hypot(cx, cz);
            if (d < min && d > 1e-5) {
              px = circle.x + (cx / d) * min;
              pz = circle.z + (cz / d) * min;
            }
          }
        }
      }
    }
    return [px, pz];
  }

  isInsideBuilding(x: number, z: number, margin = 0): boolean {
    const ix = Math.floor(x / CELL);
    const iz = Math.floor(z / CELL);
    const bucket = this.buildings.get(cellKey(ix, iz));
    if (!bucket) return false;
    for (const collider of bucket) {
      if (pointInPolygon(x, z, collider.ring)) return true;
      if (margin > 0 && closestPointOnPolygon(x, z, collider.ring).distance < margin) return true;
    }
    return false;
  }

  nearBuilding(x: number, z: number, margin: number): boolean {
    const ix = Math.floor(x / CELL);
    const iz = Math.floor(z / CELL);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = this.buildings.get(cellKey(ix + dx, iz + dz));
        if (!bucket) continue;
        for (const collider of bucket) {
          if (x < collider.minX - margin || x > collider.maxX + margin) continue;
          if (z < collider.minZ - margin || z > collider.maxZ + margin) continue;
          if (pointInPolygon(x, z, collider.ring)) return true;
          if (closestPointOnPolygon(x, z, collider.ring).distance < margin) return true;
        }
      }
    }
    return false;
  }

  clear(): void {
    this.buildings.clear();
    this.circles.clear();
    this.chunks.clear();
  }
}
