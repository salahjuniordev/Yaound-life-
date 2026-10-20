import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ZONES, ROADS, HILLS, LANDMARKS, DISTRICT_MAP } from '../data/districts';
import { PLACES } from '../data/places';
import { terrainHeight, distanceToPolyline } from '../sim/world';
import { RNG, seedFromString } from '../sim/rng';
import type { QualityTier } from './controls';

export interface Obstacle {
  x: number;
  z: number;
  r: number;
}

export interface WorldBuild {
  terrain: THREE.BufferGeometry;
  roads: THREE.BufferGeometry;
  city: THREE.BufferGeometry;
  water: THREE.BufferGeometry;
  obstacles: Obstacle[];
}

const WALLS = ['#b9b2a6', '#c96f4a', '#7fa1b5', '#a8c0a0', '#d8d2c6', '#9a8f7f', '#c2a68a'];
const ROOFS = ['#7a4630', '#5f5a52', '#8c3f2c', '#4f5a63', '#6e5b3e'];
const UMBRELLAS = ['#d94f6b', '#2f6fe0', '#f2b134', '#2fa05a', '#e0532f'];

export const LAKE_CENTER: [number, number] = [80, -195];
export const LAKE_RADIUS = 38;

function paint(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const color = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number, hex: string, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return paint(g, hex);
}

function cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, hex: string, seg = 8) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return paint(g, hex);
}

function cone(r: number, h: number, x: number, y: number, z: number, hex: string, seg = 8) {
  const g = new THREE.ConeGeometry(r, h, seg);
  g.translate(x, y, z);
  return paint(g, hex);
}

function buildTerrain(): THREE.BufferGeometry {
  const width = 540;
  const depth = 470;
  const segX = 108;
  const segZ = 94;
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const cx = 5;
  const cz = -30;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const green = new THREE.Color('#6f7f4a');
  const dry = new THREE.Color('#8a7f55');
  const rock = new THREE.Color('#7d7568');
  const sand = new THREE.Color('#9c8f6e');
  const roadStone = new THREE.Color('#5b5b52');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = pos.getZ(i);
    const wx = lx + cx;
    const wz = lz + cz;
    const h = terrainHeight(wx, wz);
    pos.setY(i, h);
    const hash = Math.abs(Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453) % 1;
    c.copy(green).lerp(dry, hash * 0.6);
    if (h > 7) c.lerp(rock, Math.min(1, (h - 7) / 10));
    const dLake = Math.hypot(wx - LAKE_CENTER[0], wz - LAKE_CENTER[1]);
    if (dLake < LAKE_RADIUS + 6) c.copy(sand);
    if (dLake < LAKE_RADIUS) c.set('#3f6f8a');
    let nearRoad = Infinity;
    for (const road of ROADS) {
      const d = distanceToPolyline(wx, wz, road.points);
      if (d < nearRoad) nearRoad = d;
      if (nearRoad < road.width / 2 + 0.5) break;
    }
    if (nearRoad < 5.5 && dLake > LAKE_RADIUS) c.lerp(roadStone, Math.max(0, 1 - nearRoad / 5.5) * 0.75);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.translate(cx, 0, cz);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildRoads(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const road of ROADS) {
    const curve = new THREE.CatmullRomCurve3(road.points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const samples = Math.max(24, road.points.length * 16);
    const points = curve.getSpacedPoints(samples);
    const positions: number[] = [];
    const colors: number[] = [];
    const roadColor = new THREE.Color('#43434b');
    const edgeColor = new THREE.Color('#6b6455');
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const half = road.width / 2;
      const edges: [number, number][] = [
        [a.x + nx * half, a.z + nz * half],
        [a.x - nx * half, a.z - nz * half],
        [b.x - nx * half, b.z - nz * half],
        [b.x + nx * half, b.z + nz * half],
      ];
      const ys = edges.map(([ex, ez]) => terrainHeight(ex, ez) + 0.07);
      const tri = [0, 1, 2, 0, 2, 3];
      for (const idx of tri) {
        positions.push(edges[idx][0], ys[idx], edges[idx][1]);
        const isEdge = idx === 1 || idx === 2;
        const col = isEdge ? edgeColor : roadColor;
        colors.push(col.r, col.g, col.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    parts.push(g);
  }
  return mergeGeometries(parts, false) ?? parts[0];
}

function buildCity(obstacles: Obstacle[]): { city: THREE.BufferGeometry; water: THREE.BufferGeometry } {
  const parts: THREE.BufferGeometry[] = [];
  const placePositions = PLACES.map((p) => p.pos);

  for (const zone of ZONES) {
    const rng = new RNG(seedFromString(`city_${zone.id}_v3`));
    const [cx, cz] = zone.center;
    const isMarket = zone.tags.includes('market');
    const isUpscale = zone.id === 'bastos' || zone.id === 'mont_febe';
    const count = Math.round(9 + zone.footTraffic * 20) + (isUpscale ? 6 : 0);
    const placed: { x: number; z: number; w: number; d: number }[] = [];

    for (let attempt = 0; attempt < count * 5 && placed.length < count; attempt++) {
      const ang = rng.range(0, Math.PI * 2);
      const dist = rng.range(6, zone.radius * 0.85);
      const x = cx + Math.cos(ang) * dist;
      const z = cz + Math.sin(ang) * dist;
      let nearRoad = Infinity;
      for (const road of ROADS) {
        const d = distanceToPolyline(x, z, road.points);
        nearRoad = Math.min(nearRoad, d);
      }
      if (nearRoad < 6 || nearRoad > 42) continue;
      if (Math.hypot(x - LAKE_CENTER[0], z - LAKE_CENTER[1]) < LAKE_RADIUS + 8) continue;
      let blocked = false;
      for (const p of placePositions) {
        if (Math.hypot(x - p[0], z - p[1]) < 8) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      for (const b of placed) {
        if (Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) * 0.55 + 5) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      const w = rng.range(4, isUpscale ? 11 : 8);
      const d = rng.range(4, isUpscale ? 11 : 8);
      const floors = 1 + (rng.chance(isUpscale ? 0.55 : 0.28) ? 1 : 0) + (rng.chance(isUpscale ? 0.25 : 0.05) ? 1 : 0);
      const h = floors * 3;
      const rot = rng.chance(0.5) ? 0 : rng.range(-0.3, 0.3);
      const wall = rng.pick(WALLS);
      const roof = rng.pick(ROOFS);
      const baseY = terrainHeight(x, z);
      parts.push(box(w, h, d, x, baseY + h / 2, z, wall, rot));
      parts.push(box(w + 0.6, 0.28, d + 0.6, x, baseY + h + 0.12, z, roof, rot));
      const shopChance = isMarket ? 0.45 : nearRoad < 14 ? 0.3 : 0.1;
      if (rng.chance(shopChance) && floors === 1) {
        const umb = rng.pick(UMBRELLAS);
        parts.push(box(w * 0.85, 0.08, 1.3, x, baseY + 2.45, z + (d / 2 + 0.6), umb, rot));
        parts.push(box(w * 0.7, 0.55, 0.1, x, baseY + 2.9, z + (d / 2 + 0.2), '#e8e2d4', rot));
      }
      if (rng.chance(0.25)) {
        parts.push(box(w + 3.4, 1.7, 0.16, x, baseY + 0.85, z + d / 2 + 1.8, '#a39a8b', rot));
        parts.push(box(0.16, 1.7, d + 3.4, x + w / 2 + 1.6, baseY + 0.85, z, '#a39a8b', rot));
      }
      placed.push({ x, z, w, d });
      obstacles.push({ x, z, r: Math.max(w, d) * 0.62 });
    }

    const props = isMarket ? 10 : 4;
    for (let i = 0; i < props; i++) {
      const ang = rng.range(0, Math.PI * 2);
      const dist = rng.range(5, zone.radius * 0.7);
      const x = cx + Math.cos(ang) * dist;
      const z = cz + Math.sin(ang) * dist;
      if (Math.hypot(x - LAKE_CENTER[0], z - LAKE_CENTER[1]) < LAKE_RADIUS + 4) continue;
      const baseY = terrainHeight(x, z);
      if (isMarket && rng.chance(0.65)) {
        const umb = rng.pick(UMBRELLAS);
        parts.push(box(2.1, 0.12, 1.1, x, baseY + 0.95, z, '#8c6b45'));
        parts.push(cyl(0.05, 0.05, 2.4, x, baseY + 1.2, z, '#5f5a52'));
        parts.push(cone(1.9, 0.7, x, baseY + 2.65, z, umb, 7));
        obstacles.push({ x, z, r: 1.4 });
      } else if (rng.chance(0.5)) {
        parts.push(cyl(0.14, 0.18, 4.5, x, baseY + 2.25, z, '#6b5b45'));
        parts.push(cone(2.4, 3.2, x, baseY + 6, z, '#4a6b35', 7));
        parts.push(cone(1.9, 2.4, x, baseY + 7.6, z, '#557a3d', 7));
        obstacles.push({ x, z, r: 0.5 });
      } else if (rng.chance(0.5)) {
        parts.push(cyl(0.08, 0.1, 7, x, baseY + 3.5, z, '#4d4a44'));
        parts.push(box(1.6, 0.08, 0.08, x, baseY + 6.4, z, '#4d4a44'));
        obstacles.push({ x, z, r: 0.35 });
      } else {
        parts.push(cyl(0.9, 1, 1.6, x, baseY + 2.6, z, '#3f4a55', 10));
        parts.push(box(1.4, 1.8, 1.4, x, baseY + 0.9, z, '#6b6455'));
        obstacles.push({ x, z, r: 1.2 });
      }
    }
  }

  for (const road of ROADS) {
    const curve = new THREE.CatmullRomCurve3(road.points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const points = curve.getSpacedPoints(40);
    for (let i = 12; i < points.length - 12; i += 14) {
      const { x, z } = points[i];
      const baseY = terrainHeight(x, z);
      parts.push(cyl(0.07, 0.09, 6.5, x - 0.5, baseY + 3.2, z, '#4d4a44'));
      parts.push(box(1.2, 0.07, 0.07, x - 0.5, baseY + 5.9, z, '#4d4a44'));
    }
  }

  for (let i = 0; i < 26; i++) {
    const rng = new RNG(seedFromString(`taxi_${i}`));
    const road = ROADS[i % ROADS.length];
    const t = rng.range(0.15, 0.85);
    const curve = new THREE.CatmullRomCurve3(road.points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const p = curve.getPoint(t);
    const baseY = terrainHeight(p.x, p.z) + 0.1;
    const rot = rng.range(0, Math.PI * 2);
    parts.push(box(4.2, 0.9, 1.9, p.x, baseY + 0.75, p.z, '#f2b134', rot));
    parts.push(box(2.2, 0.65, 1.7, p.x, baseY + 1.5, p.z, '#e8b02c', rot));
    parts.push(cyl(0.32, 0.32, 0.25, p.x + 1.3, baseY + 0.3, p.z + 0.9, '#1a1a1a', 8).rotateX(Math.PI / 2));
    parts.push(cyl(0.32, 0.32, 0.25, p.x - 1.3, baseY + 0.3, p.z - 0.9, '#1a1a1a', 8).rotateX(Math.PI / 2));
    obstacles.push({ x: p.x, z: p.z, r: 2.1 });
  }

  for (const l of LANDMARKS) {
    const [x, z] = l.pos;
    const baseY = terrainHeight(x, z);
    if (l.kind === 'museum') {
      parts.push(box(22, 8, 12, x, baseY + 4, z, '#c9bfa8'));
      parts.push(box(23, 0.6, 13, x, baseY + 8.3, z, '#8c7b5e'));
      for (let i = -3; i <= 3; i++) {
        parts.push(cyl(0.5, 0.5, 7, x + i * 3, baseY + 3.5, z + 6.6, '#d8d2c6', 8));
      }
      obstacles.push({ x, z, r: 12 });
    } else if (l.kind === 'roundabout') {
      parts.push(cyl(9, 9.5, 0.5, x, baseY + 0.25, z, '#9c9c96', 20));
      parts.push(cyl(1.2, 1.6, 5, x, baseY + 2.9, z, '#7d7568', 10));
      parts.push(box(1.6, 1.8, 1.6, x, baseY + 6.4, z, '#c96f4a'));
      obstacles.push({ x, z, r: 2.4 });
    } else if (l.kind === 'market_hall') {
      parts.push(box(30, 0.5, 22, x, baseY + 7.5, z, '#8c3f2c'));
      for (let ix = -2; ix <= 2; ix++) {
        for (let iz = -1; iz <= 1; iz++) {
          parts.push(cyl(0.35, 0.4, 7, x + ix * 6.5, baseY + 3.5, z + iz * 9, '#b9b2a6', 8));
        }
      }
      obstacles.push({ x, z, r: 8 });
    } else if (l.kind === 'university_gate') {
      parts.push(box(2.4, 6.5, 2.4, x - 6, baseY + 3.25, z, '#d8d2c6'));
      parts.push(box(2.4, 6.5, 2.4, x + 6, baseY + 3.25, z, '#d8d2c6'));
      parts.push(box(14, 1.6, 2, x, baseY + 7.2, z, '#c9bfa8'));
      obstacles.push({ x: x - 6, z, r: 1.6 });
      obstacles.push({ x: x + 6, z, r: 1.6 });
    } else if (l.kind === 'monument') {
      parts.push(cyl(7, 8, 1, x, baseY + 0.5, z, '#9c9c96', 16));
      parts.push(box(2.2, 9, 2.2, x, baseY + 5.5, z, '#c96f4a'));
      parts.push(box(3, 1, 3, x, baseY + 10.4, z, '#8c3f2c'));
      obstacles.push({ x, z, r: 2.6 });
    } else if (l.kind === 'viewpoint') {
      for (const [ox, oz] of [
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ]) {
        parts.push(cyl(0.18, 0.2, 3.2, x + ox, baseY + 1.6, z + oz, '#6b5b45'));
      }
      parts.push(box(6, 0.3, 6, x, baseY + 3.4, z, '#8c7b5e'));
    }
  }

  const waterGeo = new THREE.CircleGeometry(LAKE_RADIUS, 40);
  waterGeo.rotateX(-Math.PI / 2);
  const wy = terrainHeight(LAKE_CENTER[0], LAKE_CENTER[1]) + 0.35;
  waterGeo.translate(LAKE_CENTER[0], wy, LAKE_CENTER[1]);

  const city = mergeGeometries(parts, false);
  return { city: city ?? parts[0], water: waterGeo };
}

let cached: WorldBuild | null = null;

export function buildWorldGeometry(_quality: QualityTier): WorldBuild {
  if (cached) return cached;
  const obstacles: Obstacle[] = [];
  const terrain = buildTerrain();
  const roads = buildRoads();
  const { city, water } = buildCity(obstacles);
  cached = { terrain, roads, city, water, obstacles };
  return cached;
}

export function zoneCenterOf(districtId: string): [number, number] {
  const zone = DISTRICT_MAP[districtId as keyof typeof DISTRICT_MAP];
  return zone ? zone.center : [10, 85];
}

export { HILLS };
