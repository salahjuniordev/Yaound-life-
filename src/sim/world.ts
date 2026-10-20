import { ROADS, HILLS } from '../data/districts';

export function terrainHeight(x: number, z: number): number {
  let h = 0;
  for (const hill of HILLS) {
    const dx = x - hill.x;
    const dz = z - hill.z;
    const d2 = (dx * dx + dz * dz) / (hill.radius * hill.radius);
    h += hill.height * Math.exp(-d2);
  }
  h += Math.sin(x * 0.021) * Math.cos(z * 0.017) * 1.4;
  h += Math.sin(x * 0.05 + z * 0.03) * 0.7;

  let roadFlat = 0;
  let roadWeight = 0;
  for (const road of ROADS) {
    const dist = distanceToPolyline(x, z, road.points);
    if (dist < road.width + 14) {
      const t = road.points[0];
      const roadH = roadHeightNear(x, z, road.points);
      const w = 1 - smoothstep(road.width + 2, road.width + 14, dist);
      roadFlat += roadH * w;
      roadWeight += w;
      void t;
    }
  }
  if (roadWeight > 0.001) {
    const flatH = roadFlat / roadWeight;
    const blend = Math.min(1, roadWeight);
    h = h * (1 - blend) + flatH * blend;
  }
  return h;
}

function roadHeightNear(x: number, z: number, points: [number, number][]): number {
  let bestD = Infinity;
  let bestT = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < bestD) {
      bestD = d;
      bestT = i + t;
    }
  }
  const i0 = Math.floor(bestT);
  const t = bestT - i0;
  const [, az] = points[i0];
  const [, bz] = points[Math.min(i0 + 1, points.length - 1)];
  const elev = (p: [number, number]) => smoothTerrain(p[0], p[1]);
  const ha = elev(points[i0]);
  const hb = elev(points[Math.min(i0 + 1, points.length - 1)]);
  void az;
  void bz;
  return ha * (1 - t) + hb * t;
}

function smoothTerrain(x: number, z: number): number {
  let h = 0;
  for (const hill of HILLS) {
    const dx = x - hill.x;
    const dz = z - hill.z;
    const d2 = (dx * dx + dz * dz) / (hill.radius * hill.radius);
    h += hill.height * Math.exp(-d2);
  }
  return h;
}

export function distanceToPolyline(x: number, z: number, points: [number, number][]): number {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function roadProgress(pos: [number, number]): { road: number; t: number } | null {
  for (let r = 0; r < ROADS.length; r++) {
    const road = ROADS[r];
    if (distanceToPolyline(pos[0], pos[1], road.points) < road.width + 3) {
      return { road: r, t: 0 };
    }
  }
  return null;
}

export function isOnRoad(x: number, z: number): boolean {
  return roadProgress([x, z]) !== null;
}
