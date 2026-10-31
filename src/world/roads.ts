import type { DataStatus, RoadClass, WorldRoad } from './types';

export const ROAD_CLASS_WIDTHS: Record<RoadClass, number> = {
  motorway: 14,
  trunk: 12,
  primary: 11,
  secondary: 9,
  tertiary: 8,
  unclassified: 7,
  residential: 6.5,
  service: 4.5,
  living_street: 6,
  pedestrian: 4,
  footway: 2.2,
  path: 1.8,
  cycleway: 2.4,
  steps: 2,
  track: 3,
  roundabout: 7,
};

export const WALKABLE_CLASSES: ReadonlySet<RoadClass> = new Set<RoadClass>([
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'service',
  'living_street',
  'pedestrian',
  'footway',
  'path',
  'cycleway',
  'steps',
  'track',
  'roundabout',
]);

export function defaultRoadWidth(roadClass: RoadClass): { width: number; status: DataStatus } {
  return { width: ROAD_CLASS_WIDTHS[roadClass] ?? 6, status: 'inferred' };
}

export interface RoadNode {
  id: string;
  x: number;
  z: number;
  edges: string[];
}

export interface RoadEdge {
  id: string;
  roadId: string;
  from: string;
  to: string;
  length: number;
  roadClass: RoadClass;
  oneway: boolean;
  walkable: boolean;
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
  edges: Map<string, RoadEdge>;
  nodeKeyAt: (x: number, z: number, osmId?: number) => string;
}

function coordKey(x: number, z: number): string {
  return `p:${Math.round(x * 10)}:${Math.round(z * 10)}`;
}

export function buildRoadGraph(roads: WorldRoad[], options: { snapTolerance?: number } = {}): RoadGraph {
  const nodes = new Map<string, RoadNode>();
  const edges = new Map<string, RoadEdge>();
  const tolerance = options.snapTolerance ?? 0.25;
  const bucket = new Map<string, string>();
  const bucketKey = (x: number, z: number) => `${Math.round(x / tolerance)}:${Math.round(z / tolerance)}`;

  const ensureNode = (x: number, z: number, osmId?: number): string => {
    if (osmId !== undefined) {
      const key = `osm:${osmId}`;
      if (!nodes.has(key)) nodes.set(key, { id: key, x, z, edges: [] });
      return key;
    }
    const bk = bucketKey(x, z);
    const found = bucket.get(bk);
    if (found) return found;
    const key = coordKey(x, z);
    if (!nodes.has(key)) nodes.set(key, { id: key, x, z, edges: [] });
    bucket.set(bk, key);
    return key;
  };

  for (const road of roads) {
    if (road.points.length < 2) continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[i + 1];
      if (![ax, az, bx, bz].every(Number.isFinite)) continue;
      const length = Math.hypot(bx - ax, bz - az);
      if (length < 0.05) continue;
      const from = ensureNode(ax, az, road.nodeIds?.[i]);
      const to = ensureNode(bx, bz, road.nodeIds?.[i + 1]);
      if (from === to) continue;
      const edgeId = `${road.id}:${i}`;
      const edge: RoadEdge = {
        id: edgeId,
        roadId: road.id,
        from,
        to,
        length,
        roadClass: road.roadClass,
        oneway: road.oneway,
        walkable: road.walkable,
      };
      edges.set(edgeId, edge);
      nodes.get(from)?.edges.push(edgeId);
      nodes.get(to)?.edges.push(edgeId);
    }
  }

  return { nodes, edges, nodeKeyAt: (x, z, osmId) => ensureNode(x, z, osmId) };
}

export function polylineLength(points: [number, number][]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  }
  return total;
}

export function pointToSegmentDistance(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { distance: number; t: number; x: number; z: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
  const x = ax + dx * t;
  const z = az + dz * t;
  return { distance: Math.hypot(px - x, pz - z), t, x, z };
}

export function pointToPolylineDistance(
  px: number,
  pz: number,
  points: [number, number][],
): { distance: number; segment: number; t: number; x: number; z: number } {
  let best = { distance: Infinity, segment: 0, t: 0, x: 0, z: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const hit = pointToSegmentDistance(px, pz, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    if (hit.distance < best.distance) best = { distance: hit.distance, segment: i, t: hit.t, x: hit.x, z: hit.z };
  }
  return best;
}

export function clipPolylineToBounds(
  points: [number, number][],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): [number, number][][] {
  const inside = (x: number, z: number) => x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ;
  const out: [number, number][][] = [];
  let current: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const aIn = inside(a[0], a[1]);
    const bIn = inside(b[0], b[1]);
    if (aIn && bIn) {
      if (current.length === 0) current.push(a);
      current.push(b);
    } else if (aIn && !bIn) {
      if (current.length === 0) current.push(a);
      const hit = segmentBoxExit(a, b, bounds);
      if (hit) current.push(hit);
      if (current.length > 1) out.push(current);
      current = [];
    } else if (!aIn && bIn) {
      const hit = segmentBoxEntry(a, b, bounds);
      current = hit ? [hit, b] : [b];
    } else {
      if (current.length > 1) out.push(current);
      current = [];
    }
  }
  if (current.length > 1) out.push(current);
  return out;
}

function segmentBoxEntry(
  a: [number, number],
  b: [number, number],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): [number, number] | null {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dz, dz];
  const q = [a[0] - bounds.minX, bounds.maxX - a[0], a[1] - bounds.minZ, bounds.maxZ - a[1]];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return null;
    }
  }
  if (t0 < 0 || t0 > 1) return null;
  return [a[0] + dx * t0, a[1] + dz * t0];
}

function segmentBoxExit(
  a: [number, number],
  b: [number, number],
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
): [number, number] | null {
  const entry = segmentBoxEntry(b, a, bounds);
  if (entry) return entry;
  return [b[0], b[1]];
}

export interface RoadValidationIssue {
  roadId: string;
  message: string;
}

export function validateRoad(road: WorldRoad): RoadValidationIssue[] {
  const issues: RoadValidationIssue[] = [];
  if (!road.id) issues.push({ roadId: road.id, message: 'missing id' });
  if (!road.points || road.points.length < 2) {
    issues.push({ roadId: road.id, message: 'polyline must contain at least two points' });
    return issues;
  }
  if (!Number.isFinite(road.width) || road.width <= 0) {
    issues.push({ roadId: road.id, message: 'road width must be positive' });
  }
  for (let i = 0; i < road.points.length; i++) {
    const [x, z] = road.points[i];
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      issues.push({ roadId: road.id, message: `non-finite point at index ${i}` });
      continue;
    }
    if (i > 0) {
      const [px, pz] = road.points[i - 1];
      if (Math.hypot(x - px, z - pz) < 0.01) {
        issues.push({ roadId: road.id, message: `zero-length segment at index ${i - 1}` });
      }
    }
  }
  return issues;
}

export function isRoundaboutTags(tags: Record<string, string> | undefined): boolean {
  return tags?.junction === 'roundabout' || tags?.junction === 'circular';
}

export function classifyRoad(tags: Record<string, string> | undefined): RoadClass {
  if (isRoundaboutTags(tags)) return 'roundabout';
  const highway = tags?.highway;
  const known: RoadClass[] = [
    'motorway',
    'trunk',
    'primary',
    'secondary',
    'tertiary',
    'unclassified',
    'residential',
    'service',
    'living_street',
    'pedestrian',
    'footway',
    'path',
    'cycleway',
    'steps',
    'track',
  ];
  return known.includes(highway as RoadClass) ? (highway as RoadClass) : 'unclassified';
}
