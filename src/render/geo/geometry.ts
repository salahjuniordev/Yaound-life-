import * as THREE from 'three';
import type { DecodedBuilding } from '../../world/buildings';
import { hashString, polygonArea, polygonCentroid, seededUnit } from '../../world/buildings';
import type { BuildingGeometry, Heightfield, Poi, WaterFeature, WaterwayFeature, WorldRoad } from '../../world/types';
import { heightAt } from '../../world/terrain';
import type { QualityTier } from '../controls';
import type { CircleObstacle } from './collision';
import { BRIDGE_DECK_LIFT, BRIDGE_RAMP_LENGTH, bridgeDeckHalfWidth } from './bridges';

type RGB = [number, number, number];
type Point2 = [number, number];

/**
 * Per-chunk caps for detail that is added to the near building/prop meshes.
 * These are deliberately small: they are accents, not a second city layer.
 */
export const BALCONY_LIMITS: Record<QualityTier, number> = { low: 0, mid: 5, high: 10 };
export const COMPOUND_WALL_LIMITS: Record<QualityTier, number> = { low: 0, mid: 4, high: 8 };
export const PARKING_BAY_LIMITS: Record<QualityTier, number> = { low: 0, mid: 1, high: 2 };
export const VENDOR_STANDS_PER_MARKET = 2;

const colorCache = new Map<string, RGB>();

function rgb(hex: string): RGB {
  const cached = colorCache.get(hex);
  if (cached) return cached;
  const c = new THREE.Color(hex);
  const out: RGB = [c.r, c.g, c.b];
  colorCache.set(hex, out);
  return out;
}

function rgb255(r: number, g: number, b: number): RGB {
  const c = new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  return [c.r, c.g, c.b];
}

function hash2(x: number, z: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

class MeshBuilder {
  private positions: number[] = [];
  private colors: number[] = [];

  get empty(): boolean {
    return this.positions.length === 0;
  }

  triangle(a: [number, number, number], b: [number, number, number], c: [number, number, number], color: RGB): void {
    this.positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.colors.push(color[0], color[1], color[2], color[0], color[1], color[2], color[0], color[1], color[2]);
  }

  quad(
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    d: [number, number, number],
    color: RGB,
  ): void {
    this.triangle(a, b, c, color);
    this.triangle(a, c, d, color);
  }

  box(cx: number, baseY: number, cz: number, width: number, height: number, depth: number, color: RGB, rotY = 0): void {
    const hw = width / 2;
    const hd = depth / 2;
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const corner = (lx: number, ly: number, lz: number): [number, number, number] => [
      cx + lx * cos + lz * sin,
      baseY + ly,
      cz - lx * sin + lz * cos,
    ];
    const a = corner(-hw, 0, -hd);
    const b = corner(hw, 0, -hd);
    const c = corner(hw, 0, hd);
    const d = corner(-hw, 0, hd);
    const e = corner(-hw, height, -hd);
    const f = corner(hw, height, -hd);
    const g = corner(hw, height, hd);
    const h = corner(-hw, height, hd);
    this.quad(e, h, g, f, color);
    this.quad(a, b, c, d, color);
    this.quad(a, e, f, b, color);
    this.quad(d, c, g, h, color);
    this.quad(b, f, g, c, color);
    this.quad(a, d, h, e, color);
  }

  cylinder(cx: number, baseY: number, cz: number, radius: number, height: number, color: RGB, segments = 7): void {
    const topY = baseY + height;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * radius;
      const z0 = cz + Math.sin(a0) * radius;
      const x1 = cx + Math.cos(a1) * radius;
      const z1 = cz + Math.sin(a1) * radius;
      this.quad([x0, baseY, z0], [x0, topY, z0], [x1, topY, z1], [x1, baseY, z1], color);
      this.triangle([cx, topY, cz], [x1, topY, z1], [x0, topY, z0], color);
    }
  }

  cone(cx: number, baseY: number, cz: number, radius: number, height: number, color: RGB, segments = 7): void {
    const apex: [number, number, number] = [cx, baseY + height, cz];
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const p0: [number, number, number] = [cx + Math.cos(a0) * radius, baseY, cz + Math.sin(a0) * radius];
      const p1: [number, number, number] = [cx + Math.cos(a1) * radius, baseY, cz + Math.sin(a1) * radius];
      this.triangle(p0, apex, p1, color);
    }
  }

  disk(cx: number, y: number, cz: number, radius: number, color: RGB, segments = 10): void {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      this.triangle(
        [cx, y, cz],
        [cx + Math.cos(a1) * radius, y, cz + Math.sin(a1) * radius],
        [cx + Math.cos(a0) * radius, y, cz + Math.sin(a0) * radius],
        color,
      );
    }
  }

  ring(cx: number, y: number, cz: number, inner: number, outer: number, color: RGB, segments = 10): void {
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      const i0 = [cx + Math.cos(a0) * inner, y, cz + Math.sin(a0) * inner] as [number, number, number];
      const i1 = [cx + Math.cos(a1) * inner, y, cz + Math.sin(a1) * inner] as [number, number, number];
      const o0 = [cx + Math.cos(a0) * outer, y, cz + Math.sin(a0) * outer] as [number, number, number];
      const o1 = [cx + Math.cos(a1) * outer, y, cz + Math.sin(a1) * outer] as [number, number, number];
      this.quad(i0, i1, o1, o0, color);
    }
  }

  build(): THREE.BufferGeometry | null {
    if (this.empty) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}

function gridStep(quality: QualityTier): number {
  return quality === 'low' ? 16 : quality === 'mid' ? 8 : 4;
}

export function buildTerrainGeometry(hf: Heightfield, quality: QualityTier): THREE.BufferGeometry {
  const step = gridStep(quality);
  const width = hf.width;
  const height = hf.height;
  const positions = new Float32Array(width * height * 3);
  const colors = new Float32Array(width * height * 3);
  const green = rgb('#728052');
  const dry = rgb('#95875a');
  const rock = rgb('#857b6c');
  const soil = rgb('#7f7358');
  const c = new THREE.Color();
  const base = new THREE.Color();
  const target = new THREE.Color();
  for (let iz = 0; iz < height; iz++) {
    for (let ix = 0; ix < width; ix++) {
      const i = iz * width + ix;
      const x = hf.originX + ix * hf.cellSize;
      const z = hf.originZ + iz * hf.cellSize;
      const y = heightAt(hf, x, z);
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const slope = Math.hypot(heightAt(hf, x + 3, z) - heightAt(hf, x - 3, z), heightAt(hf, x, z + 3) - heightAt(hf, x, z - 3)) / 6;
      const variation = hash2(x * 0.13, z * 0.17);
      base.setRGB(green[0], green[1], green[2]);
      target.setRGB(dry[0], dry[1], dry[2]);
      c.copy(base).lerp(target, variation * 0.5);
      if (slope > 0.22) {
        target.setRGB(rock[0], rock[1], rock[2]);
        c.lerp(target, Math.min(0.8, (slope - 0.18) * 2.2));
      } else if (variation > 0.82) {
        target.setRGB(soil[0], soil[1], soil[2]);
        c.lerp(target, 0.35);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
  }
  const indices: number[] = [];
  for (let iz = 0; iz < height - 1; iz++) {
    for (let ix = 0; ix < width - 1; ix++) {
      const i0 = iz * width + ix;
      const i1 = i0 + 1;
      const i2 = i0 + width;
      const i3 = i2 + 1;
      indices.push(i0, i2, i1, i1, i2, i3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

const ROAD_COLORS: Record<string, string> = {
  trunk: '#4b4a4d',
  primary: '#4b4a4d',
  secondary: '#505054',
  tertiary: '#55545a',
  residential: '#5a585b',
  service: '#625f5e',
  unclassified: '#5d5a5a',
  living_street: '#5b5a56',
  pedestrian: '#9a8e7c',
  footway: '#a79a85',
  path: '#94866f',
  cycleway: '#8b7f6b',
  steps: '#8f877b',
  track: '#88795f',
  roundabout: '#505054',
};

// Hand-painted shop-board palettes: bright backgrounds with contrasting
// lettering blocks, matching the plywood signage common along Nlongkak.
const SIGN_STYLES: [string, string][] = [
  ['#f1e4c8', '#4a2f1d'],
  ['#1f4f5c', '#f4ecd8'],
  ['#8a2f2c', '#f7e9cf'],
  ['#d9a12f', '#2c2418'],
  ['#2d3c2c', '#f0e4c4'],
  ['#e8e3d6', '#8a2f2c'],
];

function isVehicleRoad(road: WorldRoad): boolean {
  return !['footway', 'path', 'cycleway', 'steps', 'pedestrian', 'track'].includes(road.roadClass);
}

function addRoadQuad(
  builder: MeshBuilder,
  hf: Heightfield,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  halfWidth: number,
  yOffset: number,
  color: RGB,
  lateralSegments = 1,
): void {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const segments = Math.max(1, Math.floor(lateralSegments));
  for (let i = 0; i < segments; i++) {
    const offsetA = halfWidth - (i * 2 * halfWidth) / segments;
    const offsetB = halfWidth - ((i + 1) * 2 * halfWidth) / segments;
    const a0: [number, number, number] = [
      ax + nx * offsetA,
      heightAt(hf, ax + nx * offsetA, az + nz * offsetA) + yOffset,
      az + nz * offsetA,
    ];
    const b0: [number, number, number] = [
      bx + nx * offsetA,
      heightAt(hf, bx + nx * offsetA, bz + nz * offsetA) + yOffset,
      bz + nz * offsetA,
    ];
    const b1: [number, number, number] = [
      bx + nx * offsetB,
      heightAt(hf, bx + nx * offsetB, bz + nz * offsetB) + yOffset,
      bz + nz * offsetB,
    ];
    const a1: [number, number, number] = [
      ax + nx * offsetB,
      heightAt(hf, ax + nx * offsetB, az + nz * offsetB) + yOffset,
      az + nz * offsetB,
    ];
    builder.quad(a0, b0, b1, a1, color);
  }
}

/**
 * Adds a narrow ribbon offset from a road centreline. Signed offsets keep the
 * quad facing up on both sides of the road (gutter, pavement, curb strips).
 */
function addRoadStrip(
  builder: MeshBuilder,
  hf: Heightfield,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  offA: number,
  offB: number,
  yOffset: number,
  color: RGB,
): void {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const point = (x: number, z: number, off: number): [number, number, number] => [
    x + nx * off,
    heightAt(hf, x + nx * off, z + nz * off) + yOffset,
    z + nz * off,
  ];
  const pa = point(ax, az, offA);
  const pb = point(bx, bz, offA);
  const pc = point(bx, bz, offB);
  const pd = point(ax, az, offB);
  if (offB > offA) builder.quad(pd, pc, pb, pa, color);
  else builder.quad(pa, pb, pc, pd, color);
}

function addBridgeRamp(
  builder: MeshBuilder,
  hf: Heightfield,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  half: number,
  innerY: number,
  direction: -1 | 1,
  color: RGB,
  concrete: RGB,
): void {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  if (length < 0.1) return;
  const ux = dx / length;
  const uz = dz / length;
  const innerX = direction < 0 ? ax : bx;
  const innerZ = direction < 0 ? az : bz;
  const outerX = innerX + ux * BRIDGE_RAMP_LENGTH * direction;
  const outerZ = innerZ + uz * BRIDGE_RAMP_LENGTH * direction;
  const nx = -uz;
  const nz = ux;
  const outerY = heightAt(hf, outerX, outerZ) + 0.1;

  const oL: [number, number, number] = [outerX + nx * half, outerY, outerZ + nz * half];
  const iL: [number, number, number] = [innerX + nx * half, innerY, innerZ + nz * half];
  const iR: [number, number, number] = [innerX - nx * half, innerY, innerZ - nz * half];
  const oR: [number, number, number] = [outerX - nx * half, outerY, outerZ - nz * half];
  if (direction < 0) builder.quad(oL, iL, iR, oR, color);
  else builder.quad(oR, iR, iL, oL, color);

  const midX = (innerX + outerX) / 2;
  const midZ = (innerZ + outerZ) / 2;
  const midY = (innerY + outerY) / 2;
  const rotY = Math.atan2(-uz, ux);
  for (const side of [1, -1]) {
    builder.box(
      midX + nx * (half - 0.12) * side,
      midY - 0.26,
      midZ + nz * (half - 0.12) * side,
      BRIDGE_RAMP_LENGTH,
      0.26,
      0.22,
      concrete,
      rotY,
    );
  }
}

function addBridgeDeck(
  builder: MeshBuilder,
  hf: Heightfield,
  road: WorldRoad,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  topColor: RGB,
  major: boolean,
): void {
  const dx = bx - ax;
  const dz = bz - az;
  const length = Math.hypot(dx, dz);
  if (length < 0.1) return;
  const ux = dx / length;
  const uz = dz / length;
  const nx = -uz;
  const nz = ux;
  const half = bridgeDeckHalfWidth(road);
  const yA = heightAt(hf, ax, az) + BRIDGE_DECK_LIFT;
  const yB = heightAt(hf, bx, bz) + BRIDGE_DECK_LIFT;

  const aL: [number, number, number] = [ax + nx * half, yA, az + nz * half];
  const bL: [number, number, number] = [bx + nx * half, yB, bz + nz * half];
  const bR: [number, number, number] = [bx - nx * half, yB, bz - nz * half];
  const aR: [number, number, number] = [ax - nx * half, yA, az - nz * half];
  builder.quad(aL, bL, bR, aR, topColor);

  const concrete = rgb('#a9a092');
  const parapet = rgb('#c4bcad');
  const cap = rgb('#d8d1c3');
  const marker = rgb('#e8c34a');
  const midX = (ax + bx) / 2;
  const midZ = (az + bz) / 2;
  const midY = (yA + yB) / 2;
  const rotY = Math.atan2(-uz, ux);

  // Deck fascia and concrete parapets. The cap gives the bridge a readable
  // silhouette from the sidewalk without adding many triangles.
  for (const side of [1, -1]) {
    const ox = nx * (half - 0.14) * side;
    const oz = nz * (half - 0.14) * side;
    builder.box(midX + ox, midY - 0.38, midZ + oz, length, 0.38, 0.26, concrete, rotY);
    builder.box(midX + ox, midY, midZ + oz, length, 0.86, 0.22, parapet, rotY);
    builder.box(midX + ox, midY + 0.86, midZ + oz, length, 0.08, 0.32, cap, rotY);
  }

  // Abutments hide the step where the raised deck meets the approach ramp.
  for (const [ex, ez, ey] of [
    [ax, az, yA],
    [bx, bz, yB],
  ] as Array<[number, number, number]>) {
    builder.box(ex, ey - 0.95, ez, half * 2, 0.95, 0.62, concrete, rotY);
  }

  addBridgeRamp(builder, hf, ax, az, bx, bz, half, yA, -1, topColor, concrete);
  addBridgeRamp(builder, hf, ax, az, bx, bz, half, yB, 1, topColor, concrete);

  if (major && length >= 4) {
    const t0 = 0.12;
    const t1 = 0.88;
    const p0x = ax + dx * t0;
    const p0z = az + dz * t0;
    const p1x = ax + dx * t1;
    const p1z = az + dz * t1;
    const y0 = yA + (yB - yA) * t0 + 0.012;
    const y1 = yA + (yB - yA) * t1 + 0.012;
    const lineHalf = 0.075;
    builder.quad(
      [p0x + nx * lineHalf, y0, p0z + nz * lineHalf],
      [p1x + nx * lineHalf, y1, p1z + nz * lineHalf],
      [p1x - nx * lineHalf, y1, p1z - nz * lineHalf],
      [p0x - nx * lineHalf, y0, p0z - nz * lineHalf],
      marker,
    );
  }
}

export function buildRoadGeometry(roads: WorldRoad[], hf: Heightfield, quality: QualityTier): THREE.BufferGeometry | null {
  const builder = new MeshBuilder();
  const asphalt = rgb('#4d4c50');
  const shoulder = rgb('#8d8677');
  const pavement = rgb('#a59c8c');
  const pavementAlt = rgb('#9b9282');
  const gutter = rgb('#3f403d');
  const curb = rgb('#b6ad9d');
  const path = rgb('#a99a80');
  const marking = rgb('#e8c34a');
  const white = rgb('#e9e5d9');
  for (const road of roads) {
    if (road.tunnel) continue;
    const baseColor = rgb(ROAD_COLORS[road.roadClass] ?? '#55545a');
    const walk = !isVehicleRoad(road);
    const major = ['trunk', 'primary', 'secondary', 'tertiary'].includes(road.roadClass);
    const half = road.width / 2;
    const surfaceSegments = quality === 'low' ? 1 : Math.max(1, Math.ceil(road.width / 4));
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      if (road.bridge) addBridgeDeck(builder, hf, road, ax, az, bx, bz, baseColor, major);
      const step = quality === 'low' ? 24 : quality === 'mid' ? 16 : 10;
      const pieces = road.bridge ? 1 : len > step * 1.5 ? Math.ceil(len / step) : 1;
      const surface = hashString(road.id) % 2 === 0 ? pavement : pavementAlt;
      for (let piece = 0; piece < pieces; piece++) {
        const t0 = piece / pieces;
        const t1 = (piece + 1) / pieces;
        const sax = ax + dx * t0;
        const saz = az + dz * t0;
        const sbx = ax + dx * t1;
        const sbz = az + dz * t1;
        if (walk) {
          addRoadQuad(builder, hf, sax, saz, sbx, sbz, half, 0.075, path);
          continue;
        }
        addRoadQuad(builder, hf, sax, saz, sbx, sbz, half + 2.05, 0.045, shoulder, surfaceSegments);
        addRoadQuad(builder, hf, sax, saz, sbx, sbz, half, 0.095, baseColor, surfaceSegments);
        for (const side of [1, -1]) {
          // Open concrete drainage channel along the carriageway.
          addRoadStrip(builder, hf, sax, saz, sbx, sbz, side * (half + 0.26), side * (half + 0.64), 0.072, gutter);
          if (major) {
            addRoadStrip(builder, hf, sax, saz, sbx, sbz, side * (half + 0.66), side * (half + 0.8), 0.085, curb);
            addRoadStrip(builder, hf, sax, saz, sbx, sbz, side * (half + 0.82), side * (half + 1.98), 0.058, surface);
          }
        }
      }
      if (walk) continue;
      if (major && len > 16) {
        const mx = ax + dx * 0.5;
        const mz = az + dz * 0.5;
        const ux = dx / len;
        const uz = dz / len;
        for (const side of [1, -1]) {
          addRoadStrip(builder, hf, mx - ux * 0.32, mz - uz * 0.32, mx + ux * 0.32, mz + uz * 0.32, side * (half + 0.24), side * (half + 0.68), 0.078, curb);
        }
      }
      if (major && len > 5) {
        const nx = -dz / len;
        const nz = dx / len;
        const dash = 3.2;
        const gap = 5.8;
        const count = Math.floor(len / (dash + gap));
        for (let d = 0; d < count; d++) {
          const t0 = (d * (dash + gap) + 1.2) / len;
          const t1 = Math.min(1, t0 + dash / len);
          if (t1 <= t0) continue;
          const p0x = ax + dx * t0;
          const p0z = az + dz * t0;
          const p1x = ax + dx * t1;
          const p1z = az + dz * t1;
          const color = road.oneway ? white : marking;
          addRoadQuad(builder, hf, p0x, p0z, p1x, p1z, 0.09, 0.125, color);
          addRoadQuad(builder, hf, p0x + nx * 0.02, p0z + nz * 0.02, p1x + nx * 0.02, p1z + nz * 0.02, 0.09, 0.126, color);
        }
      }
      for (const t of [0, 1]) {
        const px = ax + dx * t;
        const pz = az + dz * t;
        if (i === 0 && t === 0) continue;
        if (i === road.points.length - 2 && t === 1) continue;
        const y = heightAt(hf, px, pz) + 0.1;
        builder.disk(px, y, pz, half, baseColor, quality === 'low' ? 6 : 10);
      }
    }
    if (road.roadClass === 'roundabout' && road.points.length > 3) {
      const centroid = polygonCentroid(road.points);
      let radius = 0;
      for (const [x, z] of road.points) radius += Math.hypot(x - centroid[0], z - centroid[1]);
      radius /= road.points.length;
      const island = Math.max(1.2, radius - road.width * 0.62);
      const y = heightAt(hf, centroid[0], centroid[1]) + 0.13;
      builder.disk(centroid[0], y, centroid[1], island, rgb('#778452'), quality === 'low' ? 8 : 14);
      builder.ring(centroid[0], y + 0.01, centroid[1], island * 0.82, island, rgb('#8f8878'), quality === 'low' ? 8 : 14);
    }
  }
  return builder.build();
}

function triangulateRing(ring: Point2[]): Point2[] {
  if (ring.length < 3) return [];
  const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
  if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
  const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
  const out: Point2[] = [];
  for (const tri of triangles) {
    for (const index of tri) out.push([contour[index].x, contour[index].y]);
  }
  return out;
}

function offsetRing(ring: Point2[], amount: number): Point2[] {
  const [cx, cz] = polygonCentroid(ring);
  return ring.map(([x, z]) => {
    const dx = x - cx;
    const dz = z - cz;
    const len = Math.hypot(dx, dz) || 1;
    return [x + (dx / len) * amount, z + (dz / len) * amount];
  });
}

function outwardNormal(a: Point2, b: Point2, cx: number, cz: number): Point2 {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const mx = (a[0] + b[0]) / 2 - cx;
  const mz = (a[1] + b[1]) / 2 - cz;
  return nx * mx + nz * mz >= 0 ? [nx, nz] : [-nx, -nz];
}

/**
 * One upper-floor balcony on a building frontage. The slab sits just outside
 * the wall and the open metal rail is made from a fixed set of boxes, so the
 * result reads at street level without adding a separate draw call.
 */
function addBalcony(
  builder: MeshBuilder,
  a: Point2,
  b: Point2,
  nx: number,
  nz: number,
  edgeLength: number,
  baseY: number,
  topY: number,
  floors: number,
  id: string,
): void {
  if (floors < 2 || edgeLength < 4) return;
  const width = Math.max(1.8, Math.min(2.8, edgeLength * 0.34));
  const maxStart = edgeLength - width - 0.4;
  if (maxStart < 0.4) return;
  const t = 0.5 + (seededUnit(id, 311) - 0.5) * 0.24;
  const start = Math.max(0.4, Math.min(maxStart, t * edgeLength - width / 2));
  const maxFloor = Math.max(1, Math.min(floors - 1, 3));
  const floor = maxFloor > 1 && seededUnit(id, 313) > 0.65 ? 2 : 1;
  const slabBase = baseY + 1.25 + floor * 3.05;
  if (slabBase + 2.0 > topY - 0.25) return;

  const dx = (b[0] - a[0]) / edgeLength;
  const dz = (b[1] - a[1]) / edgeLength;
  const mx = a[0] + dx * (start + width / 2);
  const mz = a[1] + dz * (start + width / 2);
  const rotY = Math.atan2(-dz, dx);
  const slab = rgb('#b7ad9d');
  const rail = rgb(['#3f4f47', '#4c5a4f', '#5a4a3f'][hashString(id) % 3]);
  const opening = rgb('#2d3a3c');
  const frame = rgb('#d8d0c2');
  const railBase = slabBase + 0.14;

  builder.box(mx + nx * 0.55, slabBase, mz + nz * 0.55, width, 0.14, 1.1, slab, rotY);
  // A framed opening behind the slab connects the balcony to a room instead
  // of leaving it on a blank wall. The light surround keeps the dark panel
  // from reading as a hole at a distance.
  const doorWidth = Math.min(1.3, Math.max(0.9, width * 0.48));
  builder.box(
    mx + nx * 0.02,
    slabBase + 1.08,
    mz + nz * 0.02,
    doorWidth + 0.2,
    2.16,
    0.04,
    frame,
    rotY,
  );
  builder.box(
    mx + nx * 0.05,
    slabBase + 1.03,
    mz + nz * 0.05,
    doorWidth,
    1.96,
    0.04,
    opening,
    rotY,
  );

  // Open metal rail: two horizontal rails and seven vertical bars. A solid
  // panel reads as an air-conditioner box at street level.
  builder.box(mx + nx * 1.04, railBase + 0.72, mz + nz * 1.04, width, 0.06, 0.07, rail, rotY);
  builder.box(mx + nx * 1.04, railBase + 0.06, mz + nz * 1.04, width, 0.05, 0.05, rail, rotY);
  for (let bar = 0; bar < 7; bar++) {
    const along = ((bar + 0.5) / 7 - 0.5) * width;
    builder.box(
      mx + nx * 1.04 + dx * along,
      railBase + 0.39,
      mz + nz * 1.04 + dz * along,
      0.06,
      0.72,
      0.06,
      rail,
      rotY,
    );
  }
  for (const edgeT of [start + 0.04, start + width - 0.04]) {
    const sideX = a[0] + dx * edgeT + nx * 0.55;
    const sideZ = a[1] + dz * edgeT + nz * 0.55;
    builder.box(sideX, railBase + 0.72, sideZ, 1.0, 0.06, 0.06, rail, rotY + Math.PI / 2);
    builder.box(
      sideX + nx * 0.48,
      railBase + 0.39,
      sideZ + nz * 0.48,
      0.06,
      0.72,
      0.06,
      rail,
      rotY,
    );
  }

  // A pair of short brackets makes the slab look supported without a full
  // column or an extra material.
  const bracket = rgb('#857b6d');
  for (const edgeT of [start + 0.28, start + width - 0.28]) {
    const bracketX = a[0] + dx * edgeT + nx * 0.38;
    const bracketZ = a[1] + dz * edgeT + nz * 0.38;
    builder.box(bracketX, slabBase - 0.4, bracketZ, 0.12, 0.42, 0.62, bracket, rotY);
  }
}

export function buildBuildingGeometry(
  buildings: BuildingGeometry[],
  decoded: DecodedBuilding[],
  hf: Heightfield,
  quality: QualityTier,
): THREE.BufferGeometry | null {
  const builder = new MeshBuilder();
  const near = quality !== 'low';
  const balconyLimit = BALCONY_LIMITS[quality];
  const balconyIndices = new Set<number>();
  if (near && balconyLimit > 0) {
    const candidates: Array<{ index: number; score: number }> = [];
    for (let index = 0; index < buildings.length; index++) {
      const building = buildings[index];
      if (building.ring.length < 4) continue;
      if (!['small_house', 'large_house', 'apartment', 'office', 'shop', 'restaurant', 'public'].includes(building.meta.classification)) continue;
      const area = polygonArea(building.ring);
      if (area < 60 || area > 900) continue;
      const floors = Math.max(1, Math.min(12, Math.round(building.meta.height / 3.1)));
      if (floors < 2 || building.meta.height < 5.4) continue;
      candidates.push({ index, score: seededUnit(building.meta.id, 309) });
    }
    candidates.sort((a, b) => a.score - b.score || a.index - b.index);
    for (const candidate of candidates.slice(0, balconyLimit)) balconyIndices.add(candidate.index);
  }
  for (let index = 0; index < buildings.length; index++) {
    const building = buildings[index];
    const visual = decoded[index];
    if (!visual || building.ring.length < 3) continue;
    const addBalconyHere = balconyIndices.has(index);
    const ring = building.ring;
    const [cx, cz] = polygonCentroid(ring);
    let minY = Infinity;
    for (const [x, z] of ring) {
      const y = heightAt(hf, x, z);
      if (y < minY) minY = y;
    }
    const baseY = minY - 0.35;
    const height = Math.max(2.8, building.meta.height);
    const topY = baseY + height;
    const wall = rgb255(visual.wall[0], visual.wall[1], visual.wall[2]);
    const roof = rgb255(visual.roof[0], visual.roof[1], visual.roof[2]);
    const darkWall = rgb255(
      Math.max(0, visual.wall[0] - 24),
      Math.max(0, visual.wall[1] - 24),
      Math.max(0, visual.wall[2] - 24),
    );
    // Shop boards and awnings belong on one frontage, not every wall.
    let shopEdge = 0;
    let shopEdgeLength = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const edgeLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (edgeLength > shopEdgeLength) {
        shopEdgeLength = edgeLength;
        shopEdge = i;
      }
    }
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const [nx, nz] = outwardNormal(a, b, cx, cz);
      const aBase: [number, number, number] = [a[0], baseY, a[1]];
      const bBase: [number, number, number] = [b[0], baseY, b[1]];
      const aTop: [number, number, number] = [a[0], topY, a[1]];
      const bTop: [number, number, number] = [b[0], topY, b[1]];
      builder.quad(aBase, aTop, bTop, bBase, wall);
      const plinthTop: [number, number, number] = [a[0] + nx * 0.04, baseY + 0.55, a[1] + nz * 0.04];
      const plinthTopB: [number, number, number] = [b[0] + nx * 0.04, baseY + 0.55, b[1] + nz * 0.04];
      builder.quad([a[0] + nx * 0.04, baseY, a[1] + nz * 0.04], plinthTop, plinthTopB, [b[0] + nx * 0.04, baseY, b[1] + nz * 0.04], darkWall);
      if (!near) continue;
      const edgeLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (edgeLength < 3) continue;
      const dx = (b[0] - a[0]) / edgeLength;
      const dz = (b[1] - a[1]) / edgeLength;
      const floors = Math.max(1, Math.min(12, Math.round(height / 3.1)));
      const windowsPerFloor = Math.max(1, Math.min(4, Math.floor(edgeLength / 3.2)));
      for (let floor = 0; floor < floors; floor++) {
        const wy = baseY + 1.35 + floor * 3.05;
        if (wy + 1.1 > topY - 0.4) break;
        for (let w = 0; w < windowsPerFloor; w++) {
          const frac = (w + 1) / (windowsPerFloor + 1);
          if (seededUnit(building.meta.id, floor * 13 + w) < 0.22) continue;
          const start = frac * edgeLength - 0.45;
          if (start < 0.4 || start + 0.9 > edgeLength - 0.4) continue;
          const x0 = a[0] + dx * start + nx * 0.035;
          const z0 = a[1] + dz * start + nz * 0.035;
          const p0: [number, number, number] = [x0, wy, z0];
          const p1: [number, number, number] = [x0, wy + 1.15, z0];
          const p2: [number, number, number] = [x0 + dx * 0.9, wy + 1.15, z0 + dz * 0.9];
          const p3: [number, number, number] = [x0 + dx * 0.9, wy, z0 + dz * 0.9];
          builder.quad(p0, p1, p2, p3, rgb('#33414c'));
        }
      }
      if (edgeLength > 5 && seededUnit(building.meta.id, 21) > 0.35) {
        const frac = 0.5;
        const start = frac * edgeLength - 0.65;
        const x0 = a[0] + dx * start + nx * 0.05;
        const z0 = a[1] + dz * start + nz * 0.05;
        builder.quad(
          [x0, baseY, z0],
          [x0, baseY + 2.15, z0],
          [x0 + dx * 1.3, baseY + 2.15, z0 + dz * 1.3],
          [x0 + dx * 1.3, baseY, z0 + dz * 1.3],
          rgb('#3b3029'),
        );
      }
      if (i === shopEdge && (building.meta.classification === 'shop' || building.meta.classification === 'restaurant' || building.meta.classification === 'market')) {
        const style = SIGN_STYLES[hashString(building.meta.id) % SIGN_STYLES.length];
        const signBg = rgb(style[0]);
        const signInk = rgb(style[1]);
        const signStart = edgeLength * 0.2;
        const rotY = Math.atan2(-dz, dx);
        const signBottom = Math.max(baseY + 1.9, Math.min(baseY + 2.72, topY - 0.72));
        const sx = a[0] + dx * (signStart + 1.15) + nx * 0.12;
        const sz = a[1] + dz * (signStart + 1.15) + nz * 0.12;
        builder.box(sx, signBottom, sz, 2.35, 0.6, 0.1, signBg, rotY);
        const letters = 2 + (hashString(building.meta.id) % 3);
        for (let l = 0; l < letters; l++) {
          const offset = (l - (letters - 1) / 2) * 0.62;
          builder.box(
            sx + dx * offset + nx * 0.055,
            signBottom + 0.18,
            sz + dz * offset + nz * 0.055,
            0.4,
            0.25,
            0.03,
            signInk,
            rotY,
          );
        }
        if (height > 3.6 && seededUnit(building.meta.id, 91) > 0.58 && edgeLength > 6) {
          const bx = a[0] + dx * signStart + nx * 0.6;
          const bz = a[1] + dz * signStart + nz * 0.6;
          builder.box(bx, topY - 0.85, bz, 0.1, 0.72, 1.05, signBg, rotY);
        }
        if (height >= 3.2 && seededUnit(building.meta.id, 31) > 0.45) {
          const start = edgeLength * 0.2;
          const awningColor = rgb(['#c94f4f', '#2f7f5f', '#d99a32', '#3d6fa8'][hashString(building.meta.id) % 4]);
          const awx = a[0] + dx * start + nx * 0.85;
          const awz = a[1] + dz * start + nz * 0.85;
          builder.box(awx, signBottom - 0.4, awz, 2.4, 0.12, 1.4, awningColor, rotY);
        }
      }
      if (addBalconyHere && i === shopEdge) {
        addBalcony(builder, a, b, nx, nz, edgeLength, baseY, topY, floors, building.meta.id);
      }
    }
    const isHouse = building.meta.classification === 'small_house' || building.meta.classification === 'large_house';
    const useGable = isHouse && polygonArea(ring) < 420 && seededUnit(building.meta.id, 41) > 0.35;
    if (useGable) {
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
      const spanX = maxX - minX;
      const spanZ = maxZ - minZ;
      const roofH = Math.min(3.2, Math.max(1.1, Math.min(spanX, spanZ) * 0.26));
      const ridgeY = topY + roofH;
      if (spanX >= spanZ) {
        const midZ = (minZ + maxZ) / 2;
        const ridgeA: [number, number, number] = [minX - 0.35, ridgeY, midZ];
        const ridgeB: [number, number, number] = [maxX + 0.35, ridgeY, midZ];
        builder.quad([minX - 0.35, topY, minZ - 0.35], [maxX + 0.35, topY, minZ - 0.35], ridgeB, ridgeA, roof);
        builder.quad([maxX + 0.35, topY, maxZ + 0.35], [minX - 0.35, topY, maxZ + 0.35], ridgeA, ridgeB, roof);
        builder.triangle([minX, topY, minZ], [minX, topY, maxZ], [minX, ridgeY, midZ], wall);
        builder.triangle([maxX, topY, maxZ], [maxX, topY, minZ], [maxX, ridgeY, midZ], wall);
      } else {
        const midX = (minX + maxX) / 2;
        const ridgeA: [number, number, number] = [midX, ridgeY, minZ - 0.35];
        const ridgeB: [number, number, number] = [midX, ridgeY, maxZ + 0.35];
        builder.quad([minX - 0.35, topY, maxZ + 0.35], [minX - 0.35, topY, minZ - 0.35], ridgeA, ridgeB, roof);
        builder.quad([maxX + 0.35, topY, minZ - 0.35], [maxX + 0.35, topY, maxZ + 0.35], ridgeB, ridgeA, roof);
        builder.triangle([minX, topY, minZ], [maxX, topY, minZ], [midX, ridgeY, minZ], wall);
        builder.triangle([maxX, topY, maxZ], [minX, topY, maxZ], [midX, ridgeY, maxZ], wall);
      }
    } else {
      const roofRing = offsetRing(ring, 0.35);
      const tris = triangulateRing(roofRing);
      for (let i = 0; i < tris.length; i += 3) {
        builder.triangle([tris[i][0], topY + 0.18, tris[i][1]], [tris[i + 2][0], topY + 0.18, tris[i + 2][1]], [tris[i + 1][0], topY + 0.18, tris[i + 1][1]], roof);
      }
      if (seededUnit(building.meta.id, 51) > 0.55) {
        for (let i = 0; i < roofRing.length; i += Math.max(1, Math.floor(roofRing.length / 4))) {
          const a = roofRing[i];
          const b = roofRing[(i + 1) % roofRing.length];
          const [nx, nz] = outwardNormal(a, b, cx, cz);
          builder.box((a[0] + b[0]) / 2, topY + 0.18, (a[1] + b[1]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1]), 0.55, 0.2, darkWall, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
        }
      }
    }
    if (near && seededUnit(building.meta.id, 61) > 0.58 && height > 5) {
      const tankR = 0.7;
      const tankY = topY + (useGable ? 2.4 : 0.4);
      builder.cylinder(cx + 1.1, tankY, cz - 0.9, tankR, 1.2, rgb('#d8d2c4'), 8);
      builder.cylinder(cx + 1.1, tankY + 1.2, cz - 0.9, tankR * 0.55, 0.15, rgb('#4b4a45'), 8);
    }
    if (near && (building.meta.classification === 'office' || building.meta.classification === 'apartment') && seededUnit(building.meta.id, 71) > 0.62) {
      builder.box(cx - 1.4, topY + 0.2, cz + 1.0, 2.4, 0.12, 1.4, rgb('#2e3f52'), 0.3);
      builder.box(cx - 1.4, topY + 0.32, cz + 1.0, 2.3, 0.04, 1.3, rgb('#5d7b96'), 0.3);
    }
  }
  return builder.build();
}

function isBlocked(x: number, z: number, rings: Point2[][], margin: number): boolean {
  for (const ring of rings) {
    if (ring.length < 3) continue;
    if (pointInRing(x, z, ring)) return true;
    if (closestOnRing(x, z, ring) < margin) return true;
  }
  return false;
}

function pointInRing(px: number, pz: number, ring: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i];
    const [xj, zj] = ring[j];
    const intersect = zi > pz !== zj > pz && px < ((xj - xi) * (pz - zi)) / (zj - zi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function closestOnRing(px: number, pz: number, ring: Point2[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz;
    const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0;
    const d = Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
    if (d < best) best = d;
  }
  return best;
}

function rngFrom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PropBuild {
  geometry: THREE.BufferGeometry | null;
  obstacles: CircleObstacle[];
  counts: {
    utilityPoles: number;
    utilityWires: number;
    streetSigns: number;
    bushes: number;
    compoundWalls: number;
    compoundGates: number;
    vendorUmbrellas: number;
    displayTables: number;
    parkingBays: number;
    parkedVehicles: number;
  };
}

export type VehicleKind = 'taxi' | 'private' | 'moto' | 'bus' | 'truck';

export function chooseVehicle(road: WorldRoad, roll: number): VehicleKind {
  const major = ['trunk', 'primary', 'secondary', 'tertiary'].includes(road.roadClass);
  if (major) {
    if (roll < 0.34) return 'taxi';
    if (roll < 0.62) return 'private';
    if (roll < 0.84) return 'bus';
    if (roll < 0.94) return 'truck';
    return 'moto';
  }
  if (roll < 0.34) return 'moto';
  if (roll < 0.68) return 'taxi';
  return 'private';
}

export function buildPropsGeometry(
  chunkId: string,
  roads: WorldRoad[],
  buildings: BuildingGeometry[],
  hf: Heightfield,
  quality: QualityTier,
  pois: Poi[] = [],
): PropBuild {
  const builder = new MeshBuilder();
  const obstacles: CircleObstacle[] = [];
  const counts = {
    utilityPoles: 0,
    utilityWires: 0,
    streetSigns: 0,
    bushes: 0,
    compoundWalls: 0,
    compoundGates: 0,
    vendorUmbrellas: 0,
    displayTables: 0,
    parkingBays: 0,
    parkedVehicles: 0,
  };
  const rings = buildings.map((b) => b.ring);
  const rng = rngFrom(hashString(chunkId));
  const limit = quality === 'low' ? 24 : quality === 'mid' ? 46 : 76;
  let count = 0;
  const step = quality === 'low' ? 30 : quality === 'mid' ? 19 : 14;
  const trunk = rgb('#5b4430');
  const leaves = ['#4f6b38', '#5f7b42', '#6b8548', '#456034'];
  const pole = rgb('#5d5d59');
  const lamp = rgb('#f2d18a');
  const glass = rgb('#3c4a55');
  const tyre = rgb('#262522');
  const fabric = ['#c94f4f', '#2f7f5f', '#d99a32', '#3d6fa8', '#8f4f9c'];
  const paints = ['#d8d2c4', '#345f8a', '#8a3a34', '#e8e3d6', '#4c5c4a', '#b0b4b8'];
  const wire = rgb('#252623');
  const signGreen = rgb('#245a45');
  const signWhite = rgb('#f1e4c8');
  const nearRoad = (x: number, z: number, clearance: number): boolean => {
    for (const road of roads) {
      if (road.tunnel || road.points.length < 2) continue;
      const limit = road.width / 2 + clearance;
      for (let i = 0; i < road.points.length - 1; i++) {
        const [ax, az] = road.points[i];
        const [bx, bz] = road.points[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const len2 = dx * dx + dz * dz;
        const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
        if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < limit) return true;
      }
    }
    return false;
  };
  const addTree = (x: number, z: number, palm: boolean) => {
    if (count >= limit) return;
    if (isBlocked(x, z, rings, 1.3)) return;
    const y = heightAt(hf, x, z);
    const leaf = rgb(leaves[Math.floor(rng() * leaves.length)]);
    if (palm) {
      builder.cylinder(x, y, z, 0.22, 4.6, trunk, 5);
      builder.cone(x, y + 4.1, z, 2.1, 0.9, leaf, 7);
      builder.cone(x, y + 4.5, z, 1.5, 0.7, leaf, 7);
    } else {
      builder.cylinder(x, y, z, 0.24, 2.5, trunk, 5);
      builder.cone(x, y + 2.2, z, 1.6, 3.1, leaf, 7);
      builder.cone(x, y + 3.5, z, 1.1, 1.8, leaf, 6);
    }
    obstacles.push({ x, z, r: 0.45 });
    count++;
  };
  const addLamp = (x: number, z: number) => {
    if (count >= limit) return;
    if (isBlocked(x, z, rings, 0.6)) return;
    const y = heightAt(hf, x, z);
    builder.box(x, y, z, 0.16, 5.6, 0.16, pole);
    builder.box(x + 0.55, y + 5.5, z, 1.3, 0.12, 0.16, pole);
    builder.box(x + 1.1, y + 5.35, z, 0.45, 0.16, 0.28, lamp);
    obstacles.push({ x, z, r: 0.25 });
    count++;
  };
  const addStall = (x: number, z: number, rotY = 0, clothColor?: RGB): boolean => {
    if (count >= limit) return false;
    if (isBlocked(x, z, rings, 1.15) || nearRoad(x, z, 0.8)) return false;
    const y = heightAt(hf, x, z);
    const cloth = clothColor ?? rgb(fabric[Math.floor(rng() * fabric.length)]);
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const at = (lx: number, lz: number): Point2 => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];
    builder.box(x, y + 0.75, z, 2.1, 0.12, 1.2, rgb('#8a6b48'), rotY);
    builder.box(x, y + 2.25, z, 2.5, 0.1, 1.7, cloth, rotY);
    for (const [ox, oz] of [[-1.05, -0.65], [1.05, -0.65], [-1.05, 0.65], [1.05, 0.65]] as Point2[]) {
      const [px, pz] = at(ox, oz);
      builder.box(px, y, pz, 0.09, 2.25, 0.09, pole);
    }
    const [crateX, crateZ] = at(-0.5, 0);
    builder.box(crateX, y + 0.92, crateZ, 0.5, 0.28, 0.5, rgb('#b88a45'), rotY);
    const [basketX, basketZ] = at(0.45, 0.1);
    builder.box(basketX, y + 0.92, basketZ, 0.45, 0.24, 0.4, rgb('#7d9a55'), rotY);
    obstacles.push({ x, z, r: 1.0 });
    count++;
    return true;
  };
  const addVendorStand = (x: number, z: number, rotY = 0, clothColor?: RGB): boolean => {
    if (count >= limit) return false;
    if (isBlocked(x, z, rings, 0.9) || nearRoad(x, z, 0.7)) return false;
    const y = heightAt(hf, x, z);
    const cloth = clothColor ?? rgb(fabric[Math.floor(rng() * fabric.length)]);
    const wood = rgb('#8a6b48');
    const produce = [rgb('#c9a24a'), rgb('#8aa25c'), rgb('#b2543f')];
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const at = (lx: number, lz: number): Point2 => [x + lx * cos + lz * sin, z - lx * sin + lz * cos];

    builder.box(x, y + 0.78, z, 1.5, 0.1, 0.85, wood, rotY);
    for (const [ox, oz] of [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]] as Point2[]) {
      const [px, pz] = at(ox, oz);
      builder.box(px, y, pz, 0.08, 0.78, 0.08, pole);
    }
    builder.cylinder(x, y, z, 0.05, 2.05, pole, 5);
    builder.cone(x, y + 2.0, z, 1.35, 0.5, cloth, 8);
    builder.ring(x, y + 2.0, z, 1.27, 1.38, cloth, 8);
    for (const [lx, lz] of [[-0.4, 0.05], [0.15, -0.1], [0.48, 0.18]] as Point2[]) {
      const [px, pz] = at(lx, lz);
      builder.box(px, y + 0.88, pz, 0.28, 0.22, 0.3, produce[Math.floor(rng() * produce.length)], rotY);
    }
    obstacles.push({ x, z, r: 0.8 });
    count++;
    counts.vendorUmbrellas++;
    counts.displayTables++;
    return true;
  };
  const addVehicle = (x: number, z: number, rotY: number, kind: VehicleKind, consumeBudget = true): boolean => {
    if (consumeBudget && count >= limit) return false;
    const clearance = kind === 'bus' || kind === 'truck' ? 1.6 : kind === 'moto' ? 0.55 : 1.1;
    if (isBlocked(x, z, rings, clearance)) return false;
    const y = heightAt(hf, x, z);
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const ax = cos;
    const az = -sin;
    const bx = sin;
    const bz = cos;
    const at = (along: number, across: number): Point2 => [x + ax * along + bx * across, z + az * along + bz * across];
    const wheel = (along: number, across: number) => {
      const [wx, wz] = at(along, across);
      builder.box(wx, y + 0.06, wz, 0.5, 0.5, 0.16, tyre, rotY);
    };
    const paint = kind === 'taxi' ? rgb('#e8b02c') : rgb(paints[Math.floor(rng() * paints.length)]);
    if (kind === 'moto') {
      wheel(-0.62, 0);
      wheel(0.62, 0);
      builder.box(x, y + 0.36, z, 1.45, 0.34, 0.38, paint, rotY);
      const [seatX, seatZ] = at(-0.08, 0);
      builder.box(seatX, y + 0.68, seatZ, 0.62, 0.1, 0.32, rgb('#2c2c2a'), rotY);
      const [barX, barZ] = at(0.62, 0);
      builder.box(barX, y + 0.86, barZ, 0.08, 0.08, 0.62, pole, rotY);
      const [riderX, riderZ] = at(-0.08, 0);
      builder.box(riderX, y + 0.7, riderZ, 0.36, 0.62, 0.42, rgb(fabric[Math.floor(rng() * fabric.length)]), rotY);
      builder.cylinder(riderX, y + 1.32, riderZ, 0.17, 0.28, rgb('#c99a6a'), 6);
      builder.box(riderX, y + 1.44, riderZ, 0.38, 0.12, 0.4, rgb(['#d94f3d', '#2f6fb0', '#e8d9b0'][Math.floor(rng() * 3)]), rotY);
      obstacles.push({ x, z, r: 0.7 });
    } else if (kind === 'bus') {
      wheel(-1.75, -0.92);
      wheel(-1.75, 0.92);
      wheel(1.75, -0.92);
      wheel(1.75, 0.92);
      builder.box(x, y + 0.36, z, 5.5, 1.78, 2.02, rgb('#e9e3d3'), rotY);
      builder.box(x, y + 0.72, z, 5.3, 0.22, 2.05, rgb('#2f6fb0'), rotY);
      builder.box(x, y + 1.02, z, 4.7, 0.5, 2.06, glass, rotY);
      builder.box(x, y + 2.14, z, 5.5, 0.08, 2.02, rgb('#d9d2c0'), rotY);
      obstacles.push({ x, z, r: 2.1 });
    } else if (kind === 'truck') {
      wheel(-1.55, -0.86);
      wheel(-1.55, 0.86);
      wheel(1.35, -0.86);
      wheel(1.35, 0.86);
      builder.box(x + ax * -1.35, y + 0.4, z + az * -1.35, 1.7, 1.35, 1.9, paint, rotY);
      builder.box(x + ax * -1.35, y + 1.18, z + az * -1.35, 1.5, 0.42, 1.92, glass, rotY);
      builder.box(x + ax * 1.05, y + 0.4, z + az * 1.05, 2.9, 0.9, 1.95, rgb('#6d5a44'), rotY);
      builder.box(x + ax * 1.05, y + 1.3, z + az * 1.05, 2.9, 0.5, 1.95, rgb('#3d6b55'), rotY);
      obstacles.push({ x, z, r: 2.2 });
    } else {
      wheel(-1.24, -0.82);
      wheel(-1.24, 0.82);
      wheel(1.24, -0.82);
      wheel(1.24, 0.82);
      builder.box(x, y + 0.34, z, 3.95, 0.52, 1.76, paint, rotY);
      builder.box(x, y + 0.86, z, 2.05, 0.56, 1.52, paint, rotY);
      builder.box(x, y + 0.92, z, 1.9, 0.34, 1.58, glass, rotY);
      if (kind === 'taxi') {
        builder.box(x, y + 1.42, z, 0.66, 0.12, 0.28, rgb('#efe7cc'), rotY);
      } else {
        builder.box(x - ax * 0.2, y + 1.42, z - az * 0.2, 1.65, 0.07, 0.08, rgb('#5a5a56'), rotY);
      }
      obstacles.push({ x, z, r: 1.3 });
    }
    if (consumeBudget) count++;
    return true;
  };
  const addMarketCluster = (poi: Poi, stalls: number) => {
    const seed = rngFrom(hashString(poi.id));
    const [px, pz] = poi.pos;
    const cloths = fabric.map((color) => rgb(color));
    for (let i = 0; i < stalls; i++) {
      const baseAngle = (i / stalls) * Math.PI * 2;
      for (let attempt = 0; attempt < 6; attempt++) {
        const angle = baseAngle + (seed() - 0.5) * (0.7 + attempt * 0.55);
        const radius = 5.6 + seed() * (3 + attempt * 1.5);
        const x = px + Math.cos(angle) * radius;
        const z = pz + Math.sin(angle) * radius;
        if (addStall(x, z, angle + Math.PI / 2, cloths[Math.floor(seed() * cloths.length)])) break;
      }
    }
    for (let i = 0; i < VENDOR_STANDS_PER_MARKET; i++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const angle = seed() * Math.PI * 2;
        const radius = 3.8 + seed() * 2.4;
        const x = px + Math.cos(angle) * radius;
        const z = pz + Math.sin(angle) * radius;
        if (addVendorStand(x, z, angle + Math.PI / 2, cloths[Math.floor(seed() * cloths.length)])) break;
      }
    }
    // A central produce mat and a market board anchor the cluster.
    const y = heightAt(hf, px, pz);
    if (!isBlocked(px, pz, rings, 0.9)) {
      builder.box(px, y + 0.02, pz, 3.4, 0.06, 2.4, rgb('#9a865c'));
      builder.box(px - 0.8, y + 0.1, pz - 0.4, 0.55, 0.3, 0.45, rgb('#c9a24a'));
      builder.box(px + 0.2, y + 0.1, pz + 0.35, 0.5, 0.26, 0.4, rgb('#8aa25c'));
      builder.box(px + 1.1, y + 0.1, pz - 0.15, 0.45, 0.24, 0.4, rgb('#b2543f'));
    }
    const sx = px + Math.cos(seed() * Math.PI * 2) * 2.6;
    const sz = pz + Math.sin(seed() * Math.PI * 2) * 2.6;
    const sy = heightAt(hf, sx, sz);
    if (!isBlocked(sx, sz, rings, 0.7)) {
      builder.box(sx, sy, sz, 0.12, 3.2, 0.12, pole);
      builder.box(sx, sy + 3.05, sz, 1.9, 0.66, 0.1, rgb('#2f4f45'), 0.4);
      for (let i = 0; i < 3; i++) {
        builder.box(sx + (i - 1) * 0.48, sy + 3.24, sz + 0.08, 0.3, 0.24, 0.03, rgb('#f1e4c8'), 0.4);
      }
    }
  };
  const addBench = (x: number, z: number) => {
    if (count >= limit) return;
    if (isBlocked(x, z, rings, 0.7)) return;
    const y = heightAt(hf, x, z);
    builder.box(x, y + 0.42, z, 1.6, 0.12, 0.5, rgb('#8a6b48'));
    builder.box(x, y + 0.72, z - 0.22, 1.6, 0.5, 0.1, rgb('#8a6b48'));
    builder.box(x - 0.65, y, z, 0.1, 0.42, 0.42, pole);
    builder.box(x + 0.65, y, z, 0.1, 0.42, 0.42, pole);
    obstacles.push({ x, z, r: 0.6 });
    count++;
  };
  const addBush = (x: number, z: number) => {
    if (count >= limit) return;
    if (isBlocked(x, z, rings, 0.45)) return;
    const y = heightAt(hf, x, z);
    const leaf = rgb(leaves[Math.floor(rng() * leaves.length)]);
    builder.cone(x, y, z, 0.85, 1.25, leaf, 6);
    builder.cone(x + 0.55, y, z + 0.2, 0.55, 0.82, leaf, 5);
    builder.cone(x - 0.45, y, z - 0.18, 0.48, 0.68, leaf, 5);
    obstacles.push({ x, z, r: 0.45 });
    count++;
    counts.bushes++;
  };
  const nearestRoadInfo = (
    x: number,
    z: number,
    maxDistance = Infinity,
    vehicleOnly = false,
  ): { x: number; z: number; dirX: number; dirZ: number; width: number; distance: number } | null => {
    let best: { x: number; z: number; dirX: number; dirZ: number; width: number; distance: number } | null = null;
    for (const road of roads) {
      if (road.tunnel || road.points.length < 2) continue;
      if (vehicleOnly && !isVehicleRoad(road)) continue;
      for (let i = 0; i < road.points.length - 1; i++) {
        const [ax, az] = road.points[i];
        const [bx, bz] = road.points[i + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const len2 = dx * dx + dz * dz;
        if (len2 < 1e-9) continue;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
        const px = ax + dx * t;
        const pz = az + dz * t;
        const distance = Math.hypot(x - px, z - pz);
        if (distance > maxDistance) continue;
        if (best && distance >= best.distance) continue;
        const len = Math.sqrt(len2);
        best = { x: px, z: pz, dirX: dx / len, dirZ: dz / len, width: road.width, distance };
      }
    }
    return best;
  };
  const nearestRoadDistance = (x: number, z: number): number => nearestRoadInfo(x, z)?.distance ?? Infinity;
  const parkingPoiKinds = new Set([
    'marketplace',
    'mall',
    'restaurant',
    'fast_food',
    'cafe',
    'shop',
    'supermarket',
    'convenience',
    'fuel',
    'bus_station',
    'taxi',
    'hospital',
    'clinic',
    'school',
    'university',
    'public',
    'townhall',
    'bank',
  ]);
  const addParkingBay = (poi: Poi): boolean => {
    const info = nearestRoadInfo(poi.pos[0], poi.pos[1], 90, true);
    if (!info) return false;
    const seed = rngFrom(hashString(`${poi.id}:parking`));
    const side = hashString(poi.id) % 2 === 0 ? 1 : -1;
    const alongShift = (seed() - 0.5) * 5;
    const bayLength = 10.6;
    const bayDepth = 4.6;
    const offset = info.width / 2 + 0.9 + bayDepth / 2;
    const normalX = -info.dirZ;
    const normalZ = info.dirX;
    const cx = info.x + normalX * side * offset + info.dirX * alongShift;
    const cz = info.z + normalZ * side * offset + info.dirZ * alongShift;
    const rotY = Math.atan2(-info.dirZ, info.dirX);
    const at = (along: number, across: number): Point2 => [
      cx + info.dirX * along + normalX * across,
      cz + info.dirZ * along + normalZ * across,
    ];
    const clearOfProps = (x: number, z: number, margin: number): boolean =>
      obstacles.every((obstacle) => Math.hypot(obstacle.x - x, obstacle.z - z) >= obstacle.r + margin);

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const [x, z] = at((i * bayLength) / 2, (j * bayDepth) / 2);
        if (isBlocked(x, z, rings, 0.25) || nearRoad(x, z, 0.2) || !clearOfProps(x, z, 0.35)) return false;
      }
    }

    const y = heightAt(hf, cx, cz) + 0.03;
    const asphalt = rgb('#4b4b47');
    const bayLine = rgb('#d7d0bd');
    builder.box(cx, y, cz, bayLength, 0.05, bayDepth, asphalt, rotY);
    for (let i = 0; i < 3; i++) {
      const [lx, lz] = at(-bayLength / 2 + (i * bayLength) / 2, 0);
      builder.box(lx, y + 0.04, lz, 0.1, 0.012, bayDepth - 0.5, bayLine, rotY);
    }
    counts.parkingBays++;
    for (let i = 0; i < 2; i++) {
      const [px, pz] = at(i === 0 ? -2.55 : 2.55, 0);
      if (addVehicle(px, pz, rotY, i === 0 ? 'taxi' : 'private', false)) counts.parkedVehicles++;
    }
    return true;
  };
  const isCompoundCandidate = (building: BuildingGeometry): boolean => {
    if (building.meta.classification !== 'small_house' && building.meta.classification !== 'large_house') return false;
    if (building.ring.length < 4 || building.ring.length > 8) return false;
    const area = polygonArea(building.ring);
    return area >= 70 && area <= 420 && building.meta.height >= 2.8;
  };
  const addCompoundWalls = (building: BuildingGeometry): boolean => {
    const ring = building.ring;
    if (!isCompoundCandidate(building)) return false;
    const [cx, cz] = polygonCentroid(ring);
    const offsetPoints = offsetRing(ring, 1.05);
    if (offsetPoints.length < 4) return false;

    let gateEdge = 0;
    let gateDistance = Infinity;
    for (let i = 0; i < offsetPoints.length; i++) {
      const a = offsetPoints[i];
      const b = offsetPoints[(i + 1) % offsetPoints.length];
      const distance = nearestRoadDistance((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      if (distance < gateDistance) {
        gateDistance = distance;
        gateEdge = i;
      }
    }

    const gateA = offsetPoints[gateEdge];
    const gateB = offsetPoints[(gateEdge + 1) % offsetPoints.length];
    const gateLength = Math.hypot(gateB[0] - gateA[0], gateB[1] - gateA[1]);
    if (gateLength < 2.8) return false;
    const gateWidth = Math.max(1.7, Math.min(2.4, gateLength * 0.3));
    if (gateLength < gateWidth + 0.8) return false;
    const gapCenter = 0.5 + (seededUnit(building.meta.id, 403) - 0.5) * 0.16;
    const gapStart = Math.max(
      0.4,
      Math.min(gateLength - gateWidth - 0.4, gapCenter * gateLength - gateWidth / 2),
    );
    const edgeDx = (gateB[0] - gateA[0]) / gateLength;
    const edgeDz = (gateB[1] - gateA[1]) / gateLength;
    const gapA: Point2 = [gateA[0] + edgeDx * gapStart, gateA[1] + edgeDz * gapStart];
    const gapB: Point2 = [
      gateA[0] + edgeDx * (gapStart + gateWidth),
      gateA[1] + edgeDz * (gapStart + gateWidth),
    ];

    const segments: Array<[Point2, Point2]> = [];
    for (let i = 0; i < offsetPoints.length; i++) {
      const a = offsetPoints[i];
      const b = offsetPoints[(i + 1) % offsetPoints.length];
      if (i === gateEdge) {
        if (gapStart > 0.35) segments.push([a, gapA]);
        if (gateLength - (gapStart + gateWidth) > 0.35) segments.push([gapB, b]);
      } else {
        segments.push([a, b]);
      }
    }
    if (segments.length < 3) return false;

    const blockedByProp = (x: number, z: number): boolean =>
      obstacles.some((obstacle) => Math.hypot(obstacle.x - x, obstacle.z - z) < obstacle.r + 0.3);
    for (const [a, b] of segments) {
      for (const t of [0.25, 0.5, 0.75]) {
        const mx = a[0] + (b[0] - a[0]) * t;
        const mz = a[1] + (b[1] - a[1]) * t;
        if (isBlocked(mx, mz, rings, 0.3) || nearRoad(mx, mz, 0.12) || blockedByProp(mx, mz)) return false;
      }
    }
    for (const [px, pz] of [gapA, gapB]) {
      if (isBlocked(px, pz, rings, 0.35) || nearRoad(px, pz, 0.12) || blockedByProp(px, pz)) return false;
    }

    const wall = rgb(['#b7ad9d', '#c2b9a8', '#aaa08f'][hashString(building.meta.id) % 3]);
    const cap = rgb('#d8d0c2');
    const concrete = rgb('#9e9586');
    const gateColor = rgb('#3f4c45');
    const gateTrim = rgb('#c8bfae');
    const edgeRotY = Math.atan2(-edgeDz, edgeDx);

    for (const [a, b] of segments) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.2) continue;
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[1] + b[1]) / 2;
      const rotY = Math.atan2(-(b[1] - a[1]), b[0] - a[0]);
      const y = Math.min(heightAt(hf, a[0], a[1]), heightAt(hf, b[0], b[1]), heightAt(hf, mx, mz)) + 0.03;
      builder.box(mx, y, mz, len + 0.06, 1.35, 0.18, wall, rotY);
      builder.box(mx, y + 1.35, mz, len + 0.08, 0.08, 0.26, cap, rotY);
    }
    for (const [px, pz] of [gapA, gapB]) {
      const y = heightAt(hf, px, pz) + 0.02;
      builder.box(px, y, pz, 0.42, 1.7, 0.42, concrete, edgeRotY);
      builder.box(px, y + 1.7, pz, 0.52, 0.1, 0.52, cap, edgeRotY);
    }

    const [nx, nz] = outwardNormal(gateA, gateB, cx, cz);
    const openAngle = 0.55;
    let gateDx = edgeDx * Math.cos(openAngle) - nx * Math.sin(openAngle);
    let gateDz = edgeDz * Math.cos(openAngle) - nz * Math.sin(openAngle);
    const gateDirLength = Math.hypot(gateDx, gateDz) || 1;
    gateDx /= gateDirLength;
    gateDz /= gateDirLength;
    const leafLength = gateWidth * 0.86;
    const gateY = Math.min(heightAt(hf, gapA[0], gapA[1]), heightAt(hf, gapB[0], gapB[1])) + 0.05;
    const gateX = gapA[0] + gateDx * leafLength / 2;
    const gateZ = gapA[1] + gateDz * leafLength / 2;
    const gateRotY = Math.atan2(-gateDz, gateDx);
    builder.box(gateX, gateY, gateZ, leafLength, 1.12, 0.06, gateColor, gateRotY);
    for (const railY of [0.28, 0.82]) {
      builder.box(gateX, gateY + railY, gateZ, leafLength, 0.05, 0.09, gateTrim, gateRotY);
    }

    counts.compoundWalls++;
    counts.compoundGates++;
    return true;
  };
  const sampleRoadPoint = (r: WorldRoad, t: number): { x: number; z: number; nx: number; nz: number; rotY: number } | null => {
    let total = 0;
    for (let i = 0; i < r.points.length - 1; i++) {
      total += Math.hypot(r.points[i + 1][0] - r.points[i][0], r.points[i + 1][1] - r.points[i][1]);
    }
    if (total < 1) return null;
    let target = Math.max(0, Math.min(1, t)) * total;
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, az] = r.points[i];
      const [bx, bz] = r.points[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      if (target <= len || i === r.points.length - 2) {
        const f = Math.max(0, Math.min(1, target / len));
        return {
          x: ax + dx * f,
          z: az + dz * f,
          nx: -dz / len,
          nz: dx / len,
          rotY: Math.atan2(-dz, dx),
        };
      }
      target -= len;
    }
    return null;
  };
  const addUtilityPole = (x: number, z: number, rotY: number, sign: boolean): boolean => {
    if (count >= limit) return false;
    if (isBlocked(x, z, rings, 0.55)) return false;
    const y = heightAt(hf, x, z);
    const nx = -Math.sin(rotY);
    const nz = Math.cos(rotY);
    builder.box(x, y, z, 0.2, 7.2, 0.2, pole);
    builder.box(x, y + 6.5, z, 1.55, 0.12, 0.14, pole, rotY + Math.PI / 2);
    for (const offset of [-0.5, 0, 0.5]) {
      builder.box(x + nx * offset, y + 6.62, z + nz * offset, 0.1, 0.16, 0.1, glass);
    }
    if (sign) {
      const rx = Math.cos(rotY);
      const rz = -Math.sin(rotY);
      builder.box(x, y + 4.15, z, 1.35, 0.5, 0.08, signGreen, rotY + Math.PI / 2);
      builder.box(x + rx * 0.06, y + 4.4, z + rz * 0.06, 0.95, 0.08, 0.03, signWhite, rotY + Math.PI / 2);
      builder.box(x + rx * 0.06, y + 4.25, z + rz * 0.06, 0.95, 0.08, 0.03, signWhite, rotY + Math.PI / 2);
      counts.streetSigns++;
    }
    obstacles.push({ x, z, r: 0.3 });
    count++;
    counts.utilityPoles++;
    return true;
  };
  const addWireSpan = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
  ) => {
    const midX = (ax + bx) / 2;
    const midZ = (az + bz) / 2;
    const midY = (ay + by) / 2 - 0.42;
    const spans: Array<[number, number, number, number, number, number]> = [
      [ax, ay, az, midX, midY, midZ],
      [midX, midY, midZ, bx, by, bz],
    ];
    for (const [x1, y1, z1, x2, y2, z2] of spans) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      builder.box(
        (x1 + x2) / 2,
        (y1 + y2) / 2 - 0.03,
        (z1 + z2) / 2,
        len,
        0.06,
        0.06,
        wire,
        Math.atan2(-dz, dx),
      );
      counts.utilityWires++;
    }
  };

  // Real market POIs get their stall clusters before roadside decoration, so
  // the market fabric of the district is never starved by the prop budget.
  for (const poi of pois) {
    if (count >= limit) break;
    if (poi.kind === 'marketplace') addMarketCluster(poi, 6);
    else if (poi.kind === 'mall') addMarketCluster(poi, 3);
  }

  // Utility poles follow the longest vehicle roads in pairs, with a short
  // cable run and a street-name board. They consume the same prop budget as
  // trees/stalls, so dense markets still win.
  const utilityPairs = quality === 'low' ? 1 : quality === 'mid' ? 2 : 3;
  const utilityRoads = roads
    .filter((r) => !r.tunnel && r.points.length > 1 && isVehicleRoad(r))
    .map((road) => {
      let length = 0;
      for (let i = 0; i < road.points.length - 1; i++) {
        length += Math.hypot(road.points[i + 1][0] - road.points[i][0], road.points[i + 1][1] - road.points[i][1]);
      }
      return { road, length };
    })
    .sort((a, b) => b.length - a.length);
  let utilityPairsAdded = 0;
  for (const { road } of utilityRoads) {
    if (utilityPairsAdded >= utilityPairs || count + 2 > limit) break;
    const seed = rngFrom(hashString(`${chunkId}:${road.id}:utility`));
    const side = seed() > 0.5 ? 1 : -1;
    const a = sampleRoadPoint(road, 0.28 + seed() * 0.12);
    const b = sampleRoadPoint(road, 0.62 + seed() * 0.16);
    if (!a || !b) continue;
    const offset = road.width / 2 + 0.9;
    const ax = a.x + a.nx * side * offset;
    const az = a.z + a.nz * side * offset;
    const bx = b.x + b.nx * side * offset;
    const bz = b.z + b.nz * side * offset;
    if (isBlocked(ax, az, rings, 0.55) || isBlocked(bx, bz, rings, 0.55)) continue;
    const first = addUtilityPole(ax, az, a.rotY, false);
    const second = addUtilityPole(bx, bz, b.rotY, true);
    if (!first || !second) continue;
    const ay = heightAt(hf, ax, az) + 6.55;
    const by = heightAt(hf, bx, bz) + 6.55;
    for (const cable of [-0.45, 0, 0.45]) {
      addWireSpan(
        ax + a.nx * cable,
        ay,
        az + a.nz * cable,
        bx + b.nx * cable,
        by,
        bz + b.nz * cable,
      );
    }
    utilityPairsAdded++;
  }

  for (const road of roads) {
    if (road.tunnel || road.points.length < 2) continue;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 3) continue;
      const nx = -dz / len;
      const nz = dx / len;
      const half = road.width / 2;
      const samples = Math.max(1, Math.floor(len / step));
      for (let s = 0; s < samples; s++) {
        const t = (s + 0.35 + rng() * 0.35) / samples;
        const x = ax + dx * t;
        const z = az + dz * t;
        const side = rng() > 0.5 ? 1 : -1;
        const roll = rng();
        if (roll < 0.33) {
          addTree(x + nx * side * (half + 2.5 + rng() * 2.5), z + nz * side * (half + 2.5 + rng() * 2.5), rng() > 0.75);
        } else if (roll < 0.47) {
          addLamp(x + nx * side * (half + 0.9), z + nz * side * (half + 0.9));
        } else if (roll < 0.54 && isVehicleRoad(road)) {
          addStall(x + nx * side * (half + 2.2), z + nz * side * (half + 2.2));
        } else if (roll < 0.60 && isVehicleRoad(road)) {
          addVendorStand(
            x + nx * side * (half + 1.7),
            z + nz * side * (half + 1.7),
            Math.atan2(-dz, dx),
          );
        } else if (roll < 0.69 && isVehicleRoad(road)) {
          addVehicle(
            x + nx * side * (half * 0.35),
            z + nz * side * (half * 0.35),
            Math.atan2(-dz, dx),
            chooseVehicle(road, rng()),
          );
        } else if (roll < 0.73) {
          addBench(x + nx * side * (half + 1.2), z + nz * side * (half + 1.2));
        } else if (roll < 0.80) {
          addBush(
            x + nx * side * (half + 2.2 + rng() * 2.2),
            z + nz * side * (half + 2.2 + rng() * 2.2),
          );
        }
        if (count >= limit) break;
      }
      if (count >= limit) break;
    }
    if (count >= limit) break;
  }
  if (count < limit) {
    const attempts = Math.max(10, Math.floor(limit * 0.8));
    for (let i = 0; i < attempts && count < limit; i++) {
      const x = hf.originX + rng() * (hf.width - 1) * hf.cellSize;
      const z = hf.originZ + rng() * (hf.height - 1) * hf.cellSize;
      if (isBlocked(x, z, rings, 2.2)) continue;
      addTree(x, z, rng() > 0.8);
    }
  }

  // Commercial and civic frontages get a small, separately capped parking bay
  // after the generic street props. Bays are aligned to the nearest vehicle
  // road, keep clear of buildings and existing props, and use the existing
  // vehicle builder so parked cars gain the same collision footprint as
  // traffic. Parking does not consume the street-prop budget, so it cannot
  // starve market/vendor detail; the parking cap bounds the extra geometry.
  const parkingLimit = PARKING_BAY_LIMITS[quality];
  if (parkingLimit > 0) {
    const candidates = pois
      .filter((poi) => parkingPoiKinds.has(poi.kind))
      .map((poi) => ({ poi, score: seededUnit(poi.id, 509) }))
      .sort((a, b) => a.score - b.score || a.poi.id.localeCompare(b.poi.id));
    let parkingBays = 0;
    for (const { poi } of candidates) {
      if (parkingBays >= parkingLimit) break;
      if (addParkingBay(poi)) parkingBays++;
    }
  }

  // Compound walls are a separate, tightly capped frontage pass. They do not
  // consume the street-prop budget, but they still respect building, road and
  // prop clearance so the walls never grow into the carriageway.
  const compoundLimit = COMPOUND_WALL_LIMITS[quality];
  if (compoundLimit > 0) {
    const candidates = buildings
      .map((building, index) => ({ building, index, score: seededUnit(building.meta.id, 401) }))
      .filter(({ building }) => isCompoundCandidate(building))
      .sort((a, b) => a.score - b.score || a.index - b.index);
    let compounds = 0;
    for (const { building } of candidates) {
      if (compounds >= compoundLimit) break;
      if (addCompoundWalls(building)) compounds++;
    }
  }
  return { geometry: builder.build(), obstacles, counts };
}

export function buildWaterGeometry(features: WaterFeature[], level: number): THREE.BufferGeometry | null {
  const builder = new MeshBuilder();
  const water = rgb('#3f6f8a');
  const shallow = rgb('#4d8196');
  for (const feature of features) {
    if (feature.points.length < 3) continue;
    const tris = triangulateRing(feature.points);
    for (let i = 0; i < tris.length; i += 3) {
      builder.triangle(
        [tris[i][0], level, tris[i][1]],
        [tris[i + 2][0], level, tris[i + 2][1]],
        [tris[i + 1][0], level, tris[i + 1][1]],
        i % 6 === 0 ? shallow : water,
      );
    }
  }
  return builder.build();
}

/**
 * Builds narrow ribbons for real OSM waterway centrelines. Each point carries
 * its own inferred surface height, so streams follow valleys instead of
 * floating on a single global water plane.
 */
export function buildWaterwaysGeometry(features: WaterwayFeature[]): THREE.BufferGeometry | null {
  const builder = new MeshBuilder();
  const water = rgb('#467d91');
  const ripple = rgb('#578ea0');
  for (const feature of features) {
    const { points, levels } = feature;
    if (points.length < 2 || levels.length !== points.length) continue;
    const half = Math.max(0.4, feature.width / 2);
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i];
      let nx0 = 0;
      let nz0 = 0;
      let nx1 = 0;
      let nz1 = 0;
      if (i > 0) {
        const [ax, az] = points[i - 1];
        const dx = x - ax;
        const dz = z - az;
        const len = Math.hypot(dx, dz) || 1;
        nx0 = -dz / len;
        nz0 = dx / len;
      }
      if (i < points.length - 1) {
        const [bx, bz] = points[i + 1];
        const dx = bx - x;
        const dz = bz - z;
        const len = Math.hypot(dx, dz) || 1;
        nx1 = -dz / len;
        nz1 = dx / len;
      }
      if (nx0 === 0 && nz0 === 0) {
        nx0 = nx1;
        nz0 = nz1;
      }
      if (nx1 === 0 && nz1 === 0) {
        nx1 = nx0;
        nz1 = nz0;
      }
      let mx = nx0 + nx1;
      let mz = nz0 + nz1;
      const mlen = Math.hypot(mx, mz);
      if (mlen < 1e-6) {
        mx = nx1;
        mz = nz1;
      } else {
        mx /= mlen;
        mz /= mlen;
      }
      const cosHalf = Math.max(0.45, Math.abs(mx * nx1 + mz * nz1));
      const miter = Math.min(half / cosHalf, half * 2.2);
      left.push([x + mx * miter, z + mz * miter]);
      right.push([x - mx * miter, z - mz * miter]);
    }
    for (let i = 0; i < points.length - 1; i++) {
      const aL: [number, number, number] = [left[i][0], levels[i] + 0.12, left[i][1]];
      const bL: [number, number, number] = [left[i + 1][0], levels[i + 1] + 0.12, left[i + 1][1]];
      const bR: [number, number, number] = [right[i + 1][0], levels[i + 1] + 0.12, right[i + 1][1]];
      const aR: [number, number, number] = [right[i][0], levels[i] + 0.12, right[i][1]];
      builder.quad(aL, bL, bR, aR, i % 2 === 0 ? water : ripple);
    }
  }
  return builder.build();
}
