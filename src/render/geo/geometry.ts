import * as THREE from 'three';
import type { DecodedBuilding } from '../../world/buildings';
import { hashString, polygonArea, polygonCentroid, seededUnit } from '../../world/buildings';
import type { BuildingGeometry, Heightfield, WaterFeature, WorldRoad } from '../../world/types';
import { heightAt } from '../../world/terrain';
import type { QualityTier } from '../controls';
import type { CircleObstacle } from './collision';

type RGB = [number, number, number];
type Point2 = [number, number];

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
): void {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const aL: [number, number, number] = [ax + nx * halfWidth, heightAt(hf, ax + nx * halfWidth, az + nz * halfWidth) + yOffset, az + nz * halfWidth];
  const bL: [number, number, number] = [bx + nx * halfWidth, heightAt(hf, bx + nx * halfWidth, bz + nz * halfWidth) + yOffset, bz + nz * halfWidth];
  const bR: [number, number, number] = [bx - nx * halfWidth, heightAt(hf, bx - nx * halfWidth, bz - nz * halfWidth) + yOffset, bz - nz * halfWidth];
  const aR: [number, number, number] = [ax - nx * halfWidth, heightAt(hf, ax - nx * halfWidth, az - nz * halfWidth) + yOffset, az - nz * halfWidth];
  builder.quad(aL, bL, bR, aR, color);
}

export function buildRoadGeometry(roads: WorldRoad[], hf: Heightfield, quality: QualityTier): THREE.BufferGeometry | null {
  const builder = new MeshBuilder();
  const asphalt = rgb('#4d4c50');
  const shoulder = rgb('#8d8677');
  const path = rgb('#a99a80');
  const marking = rgb('#e8c34a');
  const white = rgb('#e9e5d9');
  for (const road of roads) {
    if (road.tunnel) continue;
    const baseColor = rgb(ROAD_COLORS[road.roadClass] ?? '#55545a');
    const walk = !isVehicleRoad(road);
    const half = road.width / 2;
    for (let i = 0; i < road.points.length - 1; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.1) continue;
      if (walk) {
        addRoadQuad(builder, hf, ax, az, bx, bz, half, 0.075, path);
        continue;
      }
      addRoadQuad(builder, hf, ax, az, bx, bz, half + 1.4, 0.045, shoulder);
      addRoadQuad(builder, hf, ax, az, bx, bz, half, 0.095, baseColor);
      if (['trunk', 'primary', 'secondary', 'tertiary'].includes(road.roadClass) && len > 5) {
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

export function buildBuildingGeometry(
  buildings: BuildingGeometry[],
  decoded: DecodedBuilding[],
  hf: Heightfield,
  quality: QualityTier,
): THREE.BufferGeometry | null {
  const builder = new MeshBuilder();
  const near = quality !== 'low';
  for (let index = 0; index < buildings.length; index++) {
    const building = buildings[index];
    const visual = decoded[index];
    if (!visual || building.ring.length < 3) continue;
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
      if (building.meta.classification === 'shop' || building.meta.classification === 'restaurant' || building.meta.classification === 'market') {
        if (seededUnit(building.meta.id, 31) > 0.45) {
          const start = edgeLength * 0.2;
          const awningColor = rgb(['#c94f4f', '#2f7f5f', '#d99a32', '#3d6fa8'][hashString(building.meta.id) % 4]);
          const awx = a[0] + dx * start + nx * 0.85;
          const awz = a[1] + dz * start + nz * 0.85;
          builder.box(awx, baseY + 2.35, awz, 2.4, 0.12, 1.4, awningColor, Math.atan2(-dz, dx));
        }
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
}

export function buildPropsGeometry(
  chunkId: string,
  roads: WorldRoad[],
  buildings: BuildingGeometry[],
  hf: Heightfield,
  quality: QualityTier,
): PropBuild {
  const builder = new MeshBuilder();
  const obstacles: CircleObstacle[] = [];
  const rings = buildings.map((b) => b.ring);
  const rng = rngFrom(hashString(chunkId));
  const limit = quality === 'low' ? 24 : quality === 'mid' ? 46 : 76;
  let count = 0;
  const step = quality === 'low' ? 30 : quality === 'mid' ? 19 : 14;
  const trunk = rgb('#5b4430');
  const leaves = ['#4f6b38', '#5f7b42', '#6b8548', '#456034'];
  const pole = rgb('#5d5d59');
  const lamp = rgb('#f2d18a');
  const taxi = rgb('#e8b02c');
  const glass = rgb('#3c4a55');
  const fabric = ['#c94f4f', '#2f7f5f', '#d99a32', '#3d6fa8', '#8f4f9c'];
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
  const addStall = (x: number, z: number) => {
    if (count >= limit) return;
    if (isBlocked(x, z, rings, 1.4)) return;
    const y = heightAt(hf, x, z);
    const cloth = rgb(fabric[Math.floor(rng() * fabric.length)]);
    builder.box(x, y + 0.75, z, 2.1, 0.12, 1.2, rgb('#8a6b48'));
    builder.box(x, y + 2.25, z, 2.5, 0.1, 1.7, cloth);
    for (const [ox, oz] of [[-1.05, -0.65], [1.05, -0.65], [-1.05, 0.65], [1.05, 0.65]] as Point2[]) {
      builder.box(x + ox, y, z + oz, 0.09, 2.25, 0.09, pole);
    }
    builder.box(x - 0.5, y + 0.92, z, 0.5, 0.28, 0.5, rgb('#b88a45'));
    builder.box(x + 0.45, y + 0.92, z + 0.1, 0.45, 0.24, 0.4, rgb('#7d9a55'));
    obstacles.push({ x, z, r: 1.0 });
    count++;
  };
  const addTaxi = (x: number, z: number, rotY: number) => {
    if (count >= limit) return;
    if (isBlocked(x, z, rings, 1.0)) return;
    const y = heightAt(hf, x, z);
    builder.box(x, y + 0.32, z, 1.85, 0.68, 4.1, taxi, rotY);
    builder.box(x, y + 1.0, z, 1.6, 0.58, 2.1, taxi, rotY);
    builder.box(x, y + 1.02, z, 1.62, 0.36, 1.85, glass, rotY);
    builder.box(x, y + 1.58, z, 0.7, 0.12, 0.3, rgb('#e9e2c9'), rotY);
    obstacles.push({ x, z, r: 1.25 });
    count++;
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
        if (roll < 0.36) {
          addTree(x + nx * side * (half + 2.5 + rng() * 2.5), z + nz * side * (half + 2.5 + rng() * 2.5), rng() > 0.75);
        } else if (roll < 0.5) {
          addLamp(x + nx * side * (half + 0.9), z + nz * side * (half + 0.9));
        } else if (roll < 0.57 && road.roadClass !== 'footway' && road.roadClass !== 'path') {
          addStall(x + nx * side * (half + 2.2), z + nz * side * (half + 2.2));
        } else if (roll < 0.62 && road.roadClass !== 'footway' && road.roadClass !== 'path') {
          addTaxi(x + nx * side * (half * 0.35), z + nz * side * (half * 0.35), Math.atan2(-dz, dx));
        } else if (roll < 0.66) {
          addBench(x + nx * side * (half + 1.2), z + nz * side * (half + 1.2));
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
  return { geometry: builder.build(), obstacles };
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
