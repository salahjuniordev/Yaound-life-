import type { BuildingClass, BuildingGeometry, BuildingMeta } from './types';

export const BUILDING_CLASSES: BuildingClass[] = [
  'small_house',
  'large_house',
  'apartment',
  'shop',
  'restaurant',
  'office',
  'school',
  'hospital',
  'church',
  'mosque',
  'warehouse',
  'market',
  'public',
  'unknown',
];

export const WALL_PALETTE: [number, number, number][] = [
  [185, 178, 166],
  [201, 111, 74],
  [127, 161, 181],
  [168, 192, 160],
  [216, 210, 198],
  [154, 143, 127],
  [194, 166, 138],
  [222, 205, 176],
  [180, 156, 132],
  [137, 157, 148],
];

export const ROOF_PALETTE: [number, number, number][] = [
  [122, 70, 48],
  [95, 90, 82],
  [140, 63, 44],
  [79, 90, 99],
  [110, 91, 62],
  [86, 96, 88],
  [128, 88, 60],
];

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededUnit(id: string, salt = 0): number {
  let h = hashString(`${id}:${salt}`);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function polygonArea(ring: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i];
    const [x1, z1] = ring[(i + 1) % ring.length];
    area += x0 * z1 - x1 * z0;
  }
  return Math.abs(area) / 2;
}

export function polygonCentroid(ring: [number, number][]): [number, number] {
  let cx = 0;
  let cz = 0;
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, z0] = ring[i];
    const [x1, z1] = ring[(i + 1) % ring.length];
    const cross = x0 * z1 - x1 * z0;
    area += cross;
    cx += (x0 + x1) * cross;
    cz += (z0 + z1) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    const n = Math.max(1, ring.length);
    return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  return [cx / (3 * area), cz / (3 * area)];
}

export function pointInPolygon(px: number, pz: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const intersect = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface ClosestEdge {
  distance: number;
  x: number;
  z: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

export function closestPointOnPolygon(px: number, pz: number, ring: [number, number][]): ClosestEdge {
  let best: ClosestEdge = { distance: Infinity, x: px, z: pz, ax: px, az: pz, bx: px, bz: pz };
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
    const x = ax + dx * t;
    const z = az + dz * t;
    const distance = Math.hypot(px - x, pz - z);
    if (distance < best.distance) best = { distance, x, z, ax, az, bx, bz };
  }
  return best;
}

export function resolveCirclePolygon(
  px: number,
  pz: number,
  radius: number,
  ring: [number, number][],
): { x: number; z: number; collided: boolean } {
  if (ring.length < 3) return { x: px, z: pz, collided: false };
  const inside = pointInPolygon(px, pz, ring);
  const edge = closestPointOnPolygon(px, pz, ring);
  if (!inside && edge.distance >= radius) return { x: px, z: pz, collided: false };
  let nx = px - edge.x;
  let nz = pz - edge.z;
  const len = Math.hypot(nx, nz);
  if (len < 1e-6) {
    const ex = edge.bx - edge.ax;
    const ez = edge.bz - edge.az;
    const elen = Math.hypot(ex, ez) || 1;
    nx = -ez / elen;
    nz = ex / elen;
  } else {
    nx /= len;
    nz /= len;
  }
  const sign = inside ? -1 : 1;
  const target = radius + 0.02;
  return { x: edge.x + nx * target * sign, z: edge.z + nz * target * sign, collided: true };
}

export function classifyBuilding(tags: Record<string, string> | undefined): BuildingClass {
  const t = tags ?? {};
  const building = t.building ?? '';
  const amenity = t.amenity ?? '';
  const shop = t.shop ?? '';
  const tourism = t.tourism ?? '';
  if (building === 'church' || amenity === 'place_of_worship' && t.religion === 'christian') return 'church';
  if (building === 'mosque' || amenity === 'place_of_worship' && t.religion === 'muslim') return 'mosque';
  if (amenity === 'school' || amenity === 'college' || amenity === 'university' || building === 'school') return 'school';
  if (amenity === 'hospital' || amenity === 'clinic' || building === 'hospital') return 'hospital';
  if (amenity === 'marketplace' || building === 'market') return 'market';
  if (shop) return shop === 'restaurant' || shop === 'cafe' || amenity === 'restaurant' ? 'restaurant' : 'shop';
  if (amenity === 'restaurant' || amenity === 'fast_food' || amenity === 'cafe' || amenity === 'bar') return 'restaurant';
  if (building === 'office' || t.office) return 'office';
  if (building === 'warehouse' || building === 'industrial' || building === 'factory') return 'warehouse';
  if (building === 'public' || building === 'government' || amenity === 'townhall' || amenity === 'courthouse') return 'public';
  if (building === 'apartments' || building === 'residential' && Number(t['building:levels'] ?? 0) >= 4) return 'apartment';
  if (building === 'house' || building === 'detached' || building === 'yes') return 'small_house';
  if (tourism) return 'public';
  return 'unknown';
}

export function inferFloors(tags: Record<string, string> | undefined, area: number, id: string): { floors: number; status: 'real' | 'inferred' } {
  const levels = Number(tags?.['building:levels']);
  if (Number.isFinite(levels) && levels >= 1 && levels <= 40) {
    return { floors: Math.round(levels), status: 'real' };
  }
  const height = Number.parseFloat(tags?.height ?? '');
  if (Number.isFinite(height) && height >= 2 && height <= 200) {
    return { floors: Math.max(1, Math.round(height / 3.2)), status: 'real' };
  }
  const jitter = seededUnit(id, 7);
  let floors = 1;
  if (area > 900) floors = 3 + (jitter > 0.55 ? 1 : 0);
  else if (area > 450) floors = 2 + (jitter > 0.7 ? 1 : 0);
  else if (area > 180) floors = 1 + (jitter > 0.6 ? 1 : 0);
  else if (jitter > 0.93) floors = 2;
  return { floors, status: 'inferred' };
}

export function heightForFloors(floors: number): number {
  return Math.max(3, Math.min(40, floors * 3.1 + 0.4));
}

export function deterministicColors(id: string): { wall: [number, number, number]; roof: [number, number, number] } {
  const wall = WALL_PALETTE[hashString(`${id}:wall`) % WALL_PALETTE.length];
  const roof = ROOF_PALETTE[hashString(`${id}:roof`) % ROOF_PALETTE.length];
  return { wall, roof };
}

export const BUILDING_MAGIC = 'YLB1';
export const BUILDING_VERSION = 1;
const BUILDING_HEADER_BYTES = 24;
const BUILDING_FIXED_BYTES = 12;

export interface DecodedBuilding {
  ring: [number, number][];
  classification: BuildingClass;
  flags: number;
  height: number;
  wall: [number, number, number];
  roof: [number, number, number];
}

export function encodeBuildings(originX: number, originZ: number, buildings: BuildingGeometry[]): ArrayBuffer {
  const scale = 0.05;
  let bytes = BUILDING_HEADER_BYTES;
  for (const b of buildings) bytes += BUILDING_FIXED_BYTES + b.ring.length * 4;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  for (let i = 0; i < 4; i++) view.setUint8(i, BUILDING_MAGIC.charCodeAt(i));
  view.setUint16(4, BUILDING_VERSION, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, buildings.length, true);
  view.setFloat32(12, originX, true);
  view.setFloat32(16, originZ, true);
  view.setFloat32(20, scale, true);
  let offset = BUILDING_HEADER_BYTES;
  for (const b of buildings) {
    const colors = deterministicColors(b.meta.id);
    const classIndex = Math.max(0, BUILDING_CLASSES.indexOf(b.meta.classification));
    view.setUint16(offset, b.ring.length, true);
    view.setUint8(offset + 2, classIndex);
    const flags =
      (b.meta.classification === 'shop' || b.meta.classification === 'restaurant' ? 1 : 0) |
      (seededUnit(b.meta.id, 3) > 0.72 ? 2 : 0) |
      (seededUnit(b.meta.id, 4) > 0.8 ? 4 : 0) |
      (seededUnit(b.meta.id, 5) > 0.86 ? 8 : 0);
    view.setUint8(offset + 3, flags);
    view.setUint16(offset + 4, Math.max(0, Math.min(65535, Math.round(b.meta.height * 10))), true);
    view.setUint8(offset + 6, colors.wall[0]);
    view.setUint8(offset + 7, colors.wall[1]);
    view.setUint8(offset + 8, colors.wall[2]);
    view.setUint8(offset + 9, colors.roof[0]);
    view.setUint8(offset + 10, colors.roof[1]);
    view.setUint8(offset + 11, colors.roof[2]);
    offset += BUILDING_FIXED_BYTES;
    for (const [x, z] of b.ring) {
      const qx = Math.max(-32768, Math.min(32767, Math.round((x - originX) / scale)));
      const qz = Math.max(-32768, Math.min(32767, Math.round((z - originZ) / scale)));
      view.setInt16(offset, qx, true);
      view.setInt16(offset + 2, qz, true);
      offset += 4;
    }
  }
  return buffer;
}

export function decodeBuildings(buffer: ArrayBuffer): DecodedBuilding[] {
  if (buffer.byteLength < BUILDING_HEADER_BYTES) throw new Error('Building buffer too small');
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== BUILDING_MAGIC) throw new Error(`Invalid building magic: ${magic}`);
  const version = view.getUint16(4, true);
  if (version !== BUILDING_VERSION) throw new Error(`Unsupported building version: ${version}`);
  const count = view.getUint32(8, true);
  const originX = view.getFloat32(12, true);
  const originZ = view.getFloat32(16, true);
  const scale = view.getFloat32(20, true);
  const out: DecodedBuilding[] = [];
  let offset = BUILDING_HEADER_BYTES;
  for (let i = 0; i < count; i++) {
    if (offset + BUILDING_FIXED_BYTES > buffer.byteLength) throw new Error('Building data truncated');
    const vertexCount = view.getUint16(offset, true);
    const classification = BUILDING_CLASSES[view.getUint8(offset + 2)] ?? 'unknown';
    const flags = view.getUint8(offset + 3);
    const height = view.getUint16(offset + 4, true) / 10;
    const wall: [number, number, number] = [view.getUint8(offset + 6), view.getUint8(offset + 7), view.getUint8(offset + 8)];
    const roof: [number, number, number] = [view.getUint8(offset + 9), view.getUint8(offset + 10), view.getUint8(offset + 11)];
    offset += BUILDING_FIXED_BYTES;
    if (vertexCount < 3 || offset + vertexCount * 4 > buffer.byteLength) throw new Error('Invalid building vertex count');
    const ring: [number, number][] = [];
    for (let v = 0; v < vertexCount; v++) {
      const x = view.getInt16(offset, true) * scale + originX;
      const z = view.getInt16(offset + 2, true) * scale + originZ;
      ring.push([x, z]);
      offset += 4;
    }
    out.push({ ring, classification, flags, height, wall, roof });
  }
  return out;
}

export function buildingFootprintAabb(ring: [number, number][]): { minX: number; minZ: number; maxX: number; maxZ: number } {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, minZ, maxX, maxZ };
}

export function validateBuilding(meta: BuildingMeta, ring: [number, number][]): string[] {
  const errors: string[] = [];
  if (ring.length < 3) errors.push('footprint has fewer than three vertices');
  if (!Number.isFinite(meta.height) || meta.height <= 0) errors.push('invalid height');
  if (!Number.isFinite(meta.area) || meta.area <= 0) errors.push('invalid area');
  for (const [x, z] of ring) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      errors.push('non-finite footprint vertex');
      break;
    }
  }
  if (errors.length === 0 && polygonArea(ring) < 1) errors.push('footprint area below one square metre');
  return errors;
}
