import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createHeightfield, heightAt } from '../src/world/terrain.ts';
import { loadChunk, loadManifest, loadWorldData } from '../src/world/loader.ts';
import { roadsForChunk } from '../src/world/roads.ts';
import type { BuildingGeometry, Heightfield, Poi, WorldData, WorldManifest, WorldRoad } from '../src/world/types.ts';
import type { DecodedBuilding } from '../src/world/buildings.ts';
import { GeoCollisionWorld } from '../src/render/geo/collision.ts';
import { RoadIndex } from '../src/render/geo/roadIndex.ts';
import {
  BALCONY_LIMITS,
  COMPOUND_WALL_LIMITS,
  PARKING_BAY_LIMITS,
  VENDOR_STANDS_PER_MARKET,
  buildBuildingGeometry,
  buildPropsGeometry,
  buildRoadGeometry,
  buildTerrainGeometry,
  buildWaterGeometry,
  buildWaterwaysGeometry,
  chooseVehicle,
} from '../src/render/geo/geometry.ts';
import { createGeoAdapter } from '../src/render/geo/adapter.ts';
import { BRIDGE_DECK_LIFT, bridgeDeckHalfWidth, bridgeSurfaceAt } from '../src/render/geo/bridges.ts';

function flatField(): Heightfield {
  const heights = new Float32Array(9);
  return createHeightfield(3, 3, 10, 0, -20, heights, 0, 0);
}

function road(overrides: Partial<WorldRoad> = {}): WorldRoad {
  return {
    id: 'w1',
    sourceId: 'w1',
    name: 'Test road',
    roadClass: 'residential',
    points: [[0, -100], [200, -100]],
    nodeIds: [1, 2],
    width: 6.5,
    widthStatus: 'inferred',
    oneway: false,
    bridge: false,
    tunnel: false,
    surface: 'asphalt',
    walkable: true,
    provenance: {
      source: 'openstreetmap',
      sourceId: 'w1',
      sourceVersion: 'test',
      license: 'ODbL-1.0',
      geometryStatus: 'real',
      heightStatus: 'inferred',
    },
    ...overrides,
  };
}

function building(classification: BuildingGeometry['meta']['classification'] = 'small_house'): BuildingGeometry {
  return {
    meta: {
      id: 'b1',
      source: 'openstreetmap',
      sourceId: 'w1',
      classification,
      height: 5,
      floors: 1,
      area: 100,
      confidence: 0.5,
      geometryStatus: 'real',
      heightStatus: 'inferred',
      architectureStatus: 'designed',
      gameplayStatus: 'designed',
    },
    ring: [[0, -10], [10, -10], [10, -20], [0, -20]],
  };
}

function decoded(): DecodedBuilding {
  return {
    ring: [[0, -10], [10, -10], [10, -20], [0, -20]],
    classification: 'small_house',
    flags: 0,
    height: 5,
    wall: [180, 160, 140],
    roof: [120, 70, 50],
  };
}

function tallBuilding(): BuildingGeometry {
  const base = building();
  return { ...base, meta: { ...base.meta, height: 6.6, floors: 2 } };
}

function tallDecoded(): DecodedBuilding {
  return { ...decoded(), height: 6.6 };
}

test('geo terrain geometry samples the heightfield and has upward-facing indices', () => {
  const hf = flatField();
  const geo = buildTerrainGeometry(hf, 'high');
  assert.ok(geo.attributes.position.count >= 9);
  assert.ok(geo.index && geo.index.count > 0);
  geo.dispose();
});

test('geo terrain geometry adds a finite vertical skirt around each streaming chunk', () => {
  const hf = createHeightfield(
    3,
    3,
    10,
    0,
    -20,
    Float32Array.from([5, 5, 5, 5, 6, 5, 5, 5, 5]),
    0,
    0,
  );
  const geo = buildTerrainGeometry(hf, 'high');
  geo.computeBoundingBox();
  assert.ok(geo.boundingBox);
  assert.ok(geo.boundingBox!.min.y < 5 - 12, 'chunk edge should extend below the terrain surface');
  const positions = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) {
    assert.ok(Number.isFinite(positions.getX(i)));
    assert.ok(Number.isFinite(positions.getY(i)));
    assert.ok(Number.isFinite(positions.getZ(i)));
  }
  geo.dispose();
});

test('geo terrain skirt faces outward on every chunk edge', () => {
  const hf = flatField();
  const geo = buildTerrainGeometry(hf, 'low');
  const positions = geo.attributes.position as THREE.BufferAttribute;
  const index = geo.index!;
  const triangles = index.count / 3;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const hits = { south: 0, north: 0, west: 0, east: 0 };
  const minX = hf.originX;
  const minZ = hf.originZ;
  const maxX = minX + (hf.width - 1) * hf.cellSize;
  const maxZ = minZ + (hf.height - 1) * hf.cellSize;
  for (let triangle = 0; triangle < triangles; triangle++) {
    const ia = index.getX(triangle * 3);
    const ib = index.getX(triangle * 3 + 1);
    const ic = index.getX(triangle * 3 + 2);
    a.fromBufferAttribute(positions, ia);
    b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    const vertical = Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y) > 1;
    if (!vertical) continue;
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac).normalize();
    if (a.z === minZ && b.z === minZ && c.z === minZ) {
      assert.ok(normal.z < -0.9, `south skirt normal ${normal.z.toFixed(2)}`);
      hits.south++;
    } else if (a.z === maxZ && b.z === maxZ && c.z === maxZ) {
      assert.ok(normal.z > 0.9, `north skirt normal ${normal.z.toFixed(2)}`);
      hits.north++;
    } else if (a.x === minX && b.x === minX && c.x === minX) {
      assert.ok(normal.x < -0.9, `west skirt normal ${normal.x.toFixed(2)}`);
      hits.west++;
    } else if (a.x === maxX && b.x === maxX && c.x === maxX) {
      assert.ok(normal.x > 0.9, `east skirt normal ${normal.x.toFixed(2)}`);
      hits.east++;
    }
  }
  assert.ok(hits.south > 0 && hits.north > 0 && hits.west > 0 && hits.east > 0, JSON.stringify(hits));
  geo.dispose();
});

test('heightAt substitutes corrupt height samples without losing the terrain surface', () => {
  const corrupt = createHeightfield(
    2,
    2,
    10,
    0,
    0,
    Float32Array.from([0, 10, Number.NaN, 20]),
    0,
    0,
  );
  const value = heightAt(corrupt, 5, 5);
  assert.ok(Number.isFinite(value));
  assert.ok(Math.abs(value - 10) < 1e-6, `expected 10 m, received ${value}`);
  const allBad = createHeightfield(
    2,
    2,
    10,
    0,
    0,
    Float32Array.from([Number.NaN, Number.NaN, Number.NaN, Number.POSITIVE_INFINITY]),
    0,
    0,
  );
  assert.equal(heightAt(allBad, 5, 5), 0);
});

test('geo road geometry creates a surface above terrain', () => {
  const hf = flatField();
  const geo = buildRoadGeometry([road()], hf, 'mid');
  assert.ok(geo);
  const pos = geo!.attributes.position as THREE.BufferAttribute;
  assert.ok(pos.count > 0);
  for (let i = 0; i < pos.count; i++) assert.ok(pos.getY(i) >= 0);
  geo!.dispose();
});

test('geo road geometry raises OSM bridge decks and adds parapets', () => {
  const hf = flatField();
  const points: Array<[number, number]> = [
    [0, -10],
    [18, -10],
  ];
  const normal = buildRoadGeometry([road({ id: 'normal', points, roadClass: 'secondary' })], hf, 'mid');
  const bridge = buildRoadGeometry([road({ id: 'bridge', points, roadClass: 'secondary', bridge: true })], hf, 'mid');
  assert.ok(normal && bridge);
  const normalPositions = normal!.attributes.position as THREE.BufferAttribute;
  const bridgePositions = bridge!.attributes.position as THREE.BufferAttribute;
  assert.ok(bridgePositions.count > normalPositions.count);

  let normalMaxY = 0;
  for (let i = 0; i < normalPositions.count; i++) normalMaxY = Math.max(normalMaxY, normalPositions.getY(i));
  let bridgeMaxY = 0;
  let deckTop = false;
  for (let i = 0; i < bridgePositions.count; i++) {
    const y = bridgePositions.getY(i);
    bridgeMaxY = Math.max(bridgeMaxY, y);
    if (Math.abs(y - (BRIDGE_DECK_LIFT + 0.012)) < 0.02) deckTop = true;
  }
  assert.ok(bridgeMaxY > normalMaxY + 0.6);
  assert.ok(deckTop, 'bridge should have a raised deck surface');
  normal!.dispose();
  bridge!.dispose();
});

test('bridge surface sampler follows the deck and approach ramps', () => {
  const bridge = road({
    id: 'bridge-sampler',
    bridge: true,
    points: [
      [0, -10],
      [18, -10],
    ],
  });
  const base = () => 2;
  assert.equal(bridgeDeckHalfWidth(bridge), bridge.width / 2 + 2.05);
  assert.equal(
    bridgeDeckHalfWidth(road({ roadClass: 'footway', width: 2.2 })),
    2.2 / 2 + 0.85,
  );
  const deck = bridgeSurfaceAt([bridge], 9, -10, base);
  assert.ok(deck !== null);
  assert.ok(Math.abs(deck! - (2 + BRIDGE_DECK_LIFT)) < 1e-9);
  const graded = bridgeSurfaceAt([bridge], 9, -10, (x) => (x <= 0 ? 10 : x >= 18 ? 12 : 11));
  assert.ok(graded !== null && Math.abs(graded - (11 + BRIDGE_DECK_LIFT)) < 1e-9);
  assert.equal(bridgeSurfaceAt([bridge], 9, -2, base), null);
  const ramp = bridgeSurfaceAt([bridge], -1, -10, base);
  assert.ok(ramp !== null && ramp > 2 && ramp < 2 + BRIDGE_DECK_LIFT);
  assert.equal(bridgeSurfaceAt([bridge], -4, -10, base), null);
  assert.equal(bridgeSurfaceAt([road({ bridge: false })], 9, -10, base), null);
});

test('geo building geometry builds walls and a roof from a footprint', () => {
  const hf = flatField();
  const geo = buildBuildingGeometry([building()], [decoded()], hf, 'high');
  assert.ok(geo);
  const pos = geo!.attributes.position as THREE.BufferAttribute;
  assert.ok(pos.count > 12);
  geo!.dispose();
});

test('geo building frontage adds deterministic upper-floor balconies', () => {
  const hf = flatField();
  const tall = tallBuilding();
  const first = buildBuildingGeometry([tall], [tallDecoded()], hf, 'high');
  const second = buildBuildingGeometry([tall], [tallDecoded()], hf, 'high');
  const oneFloor = buildBuildingGeometry([building()], [decoded()], hf, 'high');
  const low = buildBuildingGeometry([tall], [tallDecoded()], hf, 'low');
  assert.ok(first && second && oneFloor && low);
  assert.equal(BALCONY_LIMITS.low, 0);
  assert.ok(first!.attributes.position.count > oneFloor!.attributes.position.count + 60);
  assert.ok(first!.attributes.position.count > low!.attributes.position.count);
  assert.deepEqual(
    Array.from((first!.attributes.position as THREE.BufferAttribute).array),
    Array.from((second!.attributes.position as THREE.BufferAttribute).array),
  );
  first!.dispose();
  second!.dispose();
  oneFloor!.dispose();
  low!.dispose();
});

test('geo water geometry triangulates a polygon', () => {
  const geo = buildWaterGeometry([
    {
      id: 'water1',
      points: [[0, -5], [10, -5], [10, -15], [0, -15]],
      level: 0.5,
      provenance: {
        source: 'openstreetmap',
        sourceVersion: 'test',
        license: 'ODbL-1.0',
        geometryStatus: 'real',
      },
    },
  ], 0.5);
  assert.ok(geo);
  assert.ok(geo!.attributes.position.count >= 6);
  geo!.dispose();
});

test('geo water geometry keeps each feature level instead of the manifest fallback', () => {
  const geo = buildWaterGeometry([
    {
      id: 'low-pond',
      points: [[0, -5], [10, -5], [10, -15], [0, -15]],
      level: 27.06,
      provenance: {
        source: 'openstreetmap',
        sourceVersion: 'test',
        license: 'ODbL-1.0',
        geometryStatus: 'real',
      },
    },
    {
      id: 'high-pond',
      points: [[20, -5], [30, -5], [30, -15], [20, -15]],
      level: 50.25,
      provenance: {
        source: 'openstreetmap',
        sourceVersion: 'test',
        license: 'ODbL-1.0',
        geometryStatus: 'real',
      },
    },
  ], 27.06);
  assert.ok(geo);
  const positions = geo!.attributes.position as THREE.BufferAttribute;
  const levels = new Set<number>();
  for (let i = 0; i < positions.count; i++) levels.add(Number(positions.getY(i).toFixed(2)));
  assert.deepEqual([...levels].sort((a, b) => a - b), [27.06, 50.25]);
  geo!.dispose();
});

test('geo waterway geometry follows per-point levels and uses a continuous ribbon', () => {
  const geo = buildWaterwaysGeometry([
    {
      id: 'stream1',
      name: 'Mfoundi',
      kind: 'stream',
      points: [[0, -5], [10, -5], [20, -8]],
      levels: [0.2, 0.35, 0.5],
      width: 2.4,
      widthStatus: 'inferred',
      provenance: {
        source: 'openstreetmap',
        sourceVersion: 'test',
        license: 'ODbL-1.0',
        geometryStatus: 'real',
        heightStatus: 'inferred',
      },
    },
  ]);
  assert.ok(geo);
  const pos = geo!.attributes.position as THREE.BufferAttribute;
  assert.equal(pos.count, 12);
  const ys = new Set<number>();
  for (let i = 0; i < pos.count; i++) ys.add(Number(pos.getY(i).toFixed(2)));
  assert.deepEqual([...ys].sort((a, b) => a - b), [0.32, 0.47, 0.62]);
  geo!.dispose();
});

test('geo waterway geometry skips malformed level arrays', () => {
  const geo = buildWaterwaysGeometry([
    {
      id: 'broken',
      kind: 'drain',
      points: [[0, 0], [5, 0]],
      levels: [0.1],
      width: 1,
      widthStatus: 'inferred',
      provenance: {
        source: 'openstreetmap',
        sourceVersion: 'test',
        license: 'ODbL-1.0',
        geometryStatus: 'real',
      },
    },
  ]);
  assert.equal(geo, null);
});

test('geo collision pushes a player out of a building footprint', () => {
  const collision = new GeoCollisionWorld();
  collision.addChunk('c', [building()]);
  const [x, z] = collision.resolve(5, -15, 0.5);
  assert.ok(x < 0 || x > 10 || z > -10 || z < -20);
});

test('geo camera obstruction stops at building walls and clears above roofs', () => {
  const collision = new GeoCollisionWorld();
  collision.addChunk('c', [building()]);
  const ground = () => 0;
  const blocked = collision.cameraBlockFraction(5, -5, 3, 5, -25, 3, ground, 0.32);
  assert.ok(blocked !== null);
  assert.ok(blocked! > 0 && blocked! < 1);
  const clear = collision.cameraBlockFraction(5, -5, 12, 5, -25, 12, ground, 0.32);
  assert.equal(clear, null);
});

test('geo road index finds the nearest walkable segment', () => {
  const index = new RoadIndex([road()]);
  const hit = index.nearest(100, -95, 20);
  assert.ok(hit);
  assert.ok(hit!.distance <= 5.01);
});

test('geo road index can prefer a narrower spawning street', () => {
  const wide = road({ id: 'wide', width: 20, points: [[0, -99], [200, -99]] });
  const narrow = road({ id: 'narrow', width: 6.5, points: [[0, -120], [200, -120]] });
  const index = new RoadIndex([wide, narrow]);
  const nearest = index.nearest(100, -100, 40);
  assert.equal(nearest?.road.id, 'wide');
  const preferred = index.nearest(100, -100, 40, (candidate) => candidate.width <= 8);
  assert.equal(preferred?.road.id, 'narrow');
});

test('geo adapter maps Nlongkak gameplay positions into the real slice', () => {
  const hf = flatField();
  const manifest: WorldManifest = {
    format: 'yaounde-life-world',
    formatVersion: 1,
    worldVersion: 'test-v1',
    generatorVersion: 'test',
    generatedAt: new Date(0).toISOString(),
    area: { id: 'nlongkak', name: 'Nlongkak', description: 'test' },
    projection: { id: 'EPSG:32632', name: 'UTM 32N', zone: 32, hemisphere: 'N', datum: 'WGS84', centralMeridian: 9 },
    origin: { lon: 11.5, lat: 3.87, east: 0, north: 0 },
    unitsPerMetre: 1,
    verticalScale: 1,
    verticalOffset: 0,
    elevationDatum: 'test',
    terrainCellSize: 8,
    coarseTerrainCellSize: 16,
    chunkSize: 512,
    bounds: { minX: 0, maxX: 512, minZ: -512, maxZ: 0, minEast: 0, maxEast: 512, minNorth: 0, maxNorth: 512 },
    waterLevel: null,
    sources: [],
    featureCounts: { chunks: 1, roads: 1, buildings: 1, pois: 0, waterPolygons: 0, waterways: 0, terrainSamples: 9 },
    chunks: [],
    contentHash: '',
    validation: { ok: true, errors: [], warnings: [] },
  };
  const data: WorldData = {
    manifest,
    roads: [road({ points: [[0, -100], [200, -100]] })],
    pois: [],
    water: [],
    waterways: [],
    districts: [{
      id: 'nlongkak',
      name: 'Nlongkak',
      nameFr: 'Nlongkak',
      lon: 11.5,
      lat: 3.88,
      gameX: 100,
      gameZ: -100,
      provenance: { source: 'openstreetmap', sourceVersion: 'test', license: 'ODbL-1.0', geometryStatus: 'real' },
    }],
    coarseTerrain: hf,
  };
  const collision = new GeoCollisionWorld();
  collision.addChunk('c', [building()]);
  const adapter = createGeoAdapter({
    world: data,
    collision,
    roads: new RoadIndex(data.roads),
    terrainHeight: () => 0,
  });
  assert.equal(adapter.mode, 'geographic');
  assert.ok(adapter.places.length > 0);
  for (const place of adapter.places) {
    assert.ok(Number.isFinite(place.worldPos[0]));
    assert.ok(Number.isFinite(place.worldPos[1]));
  }
  const spawn = adapter.spawnForDistrict('nlongkak');
  assert.ok(Number.isFinite(spawn[0]) && Number.isFinite(spawn[1]));
  assert.ok(Math.abs(adapter.terrainHeight(100, -100) - 0.095) < 1e-9, 'carriageway surface should lift the feet');
  assert.ok(Math.abs(adapter.terrainHeight(100, -100 + 3.25 + 0.9) - 0.142) < 1e-9, 'pavement surface should lift the feet');
  assert.equal(adapter.terrainHeight(100, -80), 0, 'open terrain keeps the heightfield height');
  const mapped = adapter.toWorldPosition('nlongkak', [-95, -25]);
  assert.ok(Number.isFinite(mapped[0]) && Number.isFinite(mapped[1]));

  const placed = adapter.placePedestrian(100, -100);
  assert.equal(collision.nearBuilding(placed[0], placed[1], 0.25), false);
  const route = adapter.sidewalkRoute?.(placed[0], placed[1], 2.4) ?? null;
  assert.ok(route, 'sidewalk route should exist on an open road');
  assert.equal(collision.nearBuilding(route!.ax, route!.az, 0.2), false);
  assert.equal(collision.nearBuilding(route!.bx, route!.bz, 0.2), false);
  assert.ok(Math.hypot(route!.bx - route!.ax, route!.bz - route!.az) >= 0.7);

  const camera = adapter.resolveCamera?.([5, 3, -5], [5, 3, -25]);
  assert.ok(camera);
  assert.ok(camera![2] > -25, 'camera should shorten before the building wall');
  assert.ok(camera![2] < -5);
});

test('geo pedestrians stay on narrow footway surfaces instead of beside them', () => {
  const hf = flatField();
  const manifest: WorldManifest = {
    format: 'yaounde-life-world',
    formatVersion: 1,
    worldVersion: 'footway-test-v1',
    generatorVersion: 'test',
    generatedAt: new Date(0).toISOString(),
    area: { id: 'nlongkak', name: 'Nlongkak', description: 'test' },
    projection: { id: 'EPSG:32632', name: 'UTM 32N', zone: 32, hemisphere: 'N', datum: 'WGS84', centralMeridian: 9 },
    origin: { lon: 11.5, lat: 3.87, east: 0, north: 0 },
    unitsPerMetre: 1,
    verticalScale: 1,
    verticalOffset: 0,
    elevationDatum: 'test',
    terrainCellSize: 8,
    coarseTerrainCellSize: 16,
    chunkSize: 512,
    bounds: { minX: 0, maxX: 512, minZ: -512, maxZ: 0, minEast: 0, maxEast: 512, minNorth: 0, maxNorth: 512 },
    waterLevel: null,
    sources: [],
    featureCounts: { chunks: 1, roads: 1, buildings: 0, pois: 0, waterPolygons: 0, waterways: 0, terrainSamples: 9 },
    chunks: [],
    contentHash: '',
    validation: { ok: true, errors: [], warnings: [] },
  };
  const data: WorldData = {
    manifest,
    roads: [road({ id: 'foot', roadClass: 'footway', width: 2.2, points: [[0, -100], [200, -100]] })],
    pois: [],
    water: [],
    waterways: [],
    districts: [{
      id: 'nlongkak',
      name: 'Nlongkak',
      nameFr: 'Nlongkak',
      lon: 11.5,
      lat: 3.88,
      gameX: 100,
      gameZ: -100,
      provenance: { source: 'openstreetmap', sourceVersion: 'test', license: 'ODbL-1.0', geometryStatus: 'real' },
    }],
    coarseTerrain: hf,
  };
  const adapter = createGeoAdapter({
    world: data,
    collision: new GeoCollisionWorld(),
    roads: new RoadIndex(data.roads),
    terrainHeight: () => 0,
  });
  const placed = adapter.placePedestrian(100, -100);
  assert.ok(Math.abs(placed[1] + 100) <= 1.1, 'footway pedestrian should stay on the path');
  assert.ok(Math.abs(adapter.terrainHeight(100, -100) - 0.075) < 1e-9, 'footway surface should lift the feet');
  const route = adapter.sidewalkRoute?.(placed[0], placed[1], 2.4) ?? null;
  assert.ok(route, 'footway route should exist');
  assert.ok(Math.abs(route!.az + 100) <= 1.1);
  assert.ok(Math.abs(route!.bz + 100) <= 1.1);
  const spawn = adapter.spawnForDistrict('nlongkak');
  assert.ok(Math.abs(spawn[1] + 100) <= 1.1, 'footway spawn should stay on the path');
});

test('geo adapter follows the pack district instead of a hard-coded Nlongkak anchor', () => {
  const hf = flatField();
  const manifest = {
    format: 'yaounde-life-world',
    formatVersion: 1,
    worldVersion: 'mvog-test-v1',
    generatorVersion: 'test',
    generatedAt: new Date(0).toISOString(),
    area: { id: 'mvog_mbi', name: 'Mvog-Mbi', description: 'test' },
    projection: { id: 'EPSG:32632', name: 'UTM 32N', zone: 32, hemisphere: 'N', datum: 'WGS84', centralMeridian: 9 },
    origin: { lon: 11.5, lat: 3.87, east: 0, north: 0 },
    unitsPerMetre: 1,
    verticalScale: 1,
    verticalOffset: 0,
    elevationDatum: 'test',
    terrainCellSize: 8,
    coarseTerrainCellSize: 16,
    chunkSize: 512,
    bounds: { minX: 0, maxX: 512, minZ: -512, maxZ: 0, minEast: 0, maxEast: 512, minNorth: 0, maxNorth: 512 },
    waterLevel: null,
    sources: [],
    featureCounts: { chunks: 1, roads: 1, buildings: 1, pois: 0, waterPolygons: 0, waterways: 0, terrainSamples: 9 },
    chunks: [],
    contentHash: '',
    validation: { ok: true, errors: [], warnings: [] },
  } satisfies WorldManifest;
  const data: WorldData = {
    manifest,
    roads: [road({ points: [[0, -100], [200, -100]] })],
    pois: [],
    water: [],
    waterways: [],
    districts: [{
      id: 'mvog_mbi',
      name: 'Mvog-Mbi',
      nameFr: 'Mvog-Mbi',
      lon: 11.5,
      lat: 3.88,
      gameX: 100,
      gameZ: -100,
      provenance: { source: 'openstreetmap', sourceVersion: 'test', license: 'ODbL-1.0', geometryStatus: 'real' },
    }],
    coarseTerrain: hf,
  };
  const adapter = createGeoAdapter({
    world: data,
    collision: new GeoCollisionWorld(),
    roads: new RoadIndex(data.roads),
    terrainHeight: () => 0,
  });
  assert.equal(adapter.districtAt(0, 0), 'mvog_mbi');
  assert.ok(adapter.places.length > 0);
  assert.ok(adapter.places.every((place) => place.district === 'mvog_mbi'));
  const mapped = adapter.toWorldPosition('mvog_mbi', [10, 85]);
  assert.ok(Number.isFinite(mapped[0]) && Number.isFinite(mapped[1]));
  assert.deepEqual(adapter.toWorldPosition('nlongkak', [-95, -25]), [-95, -25]);
});

test('geo props cluster market stalls around real marketplace POIs', () => {
  const hf = flatField();
  const roadOnly = road({ points: [[0, -100], [200, -100]] });
  const bare = buildPropsGeometry('c1', [roadOnly], [], hf, 'high', []);
  const marketplace: Poi = {
    id: 'poi-market',
    name: 'Marché test',
    kind: 'marketplace',
    pos: [10, -10],
    provenance: {
      source: 'openstreetmap',
      sourceVersion: 'test',
      license: 'ODbL-1.0',
      geometryStatus: 'real',
    },
  };
  const clustered = buildPropsGeometry('c1', [roadOnly], [], hf, 'high', [marketplace]);
  assert.ok(bare.geometry);
  assert.ok(clustered.geometry);
  assert.ok(clustered.geometry!.attributes.position.count > bare.geometry!.attributes.position.count);
  assert.ok(clustered.obstacles.some((obstacle) => Math.hypot(obstacle.x - 10, obstacle.z + 10) < 12));
  const marketOnly = buildPropsGeometry('market-only', [], [], hf, 'high', [marketplace]);
  assert.ok(marketOnly.counts.vendorUmbrellas >= 1);
  assert.ok(marketOnly.counts.vendorUmbrellas <= VENDOR_STANDS_PER_MARKET);
  assert.equal(marketOnly.counts.displayTables, marketOnly.counts.vendorUmbrellas);
  assert.ok(clustered.counts.vendorUmbrellas >= 1);
  assert.equal(clustered.counts.displayTables, clustered.counts.vendorUmbrellas);
});

test('geo commercial POIs add bounded parking bays with parked vehicles', () => {
  const hf = flatField();
  const parkingRoad = road({ id: 'parking-road', points: [[0, -5], [200, -5]], width: 7 });
  const shop: Poi = {
    id: 'poi-shop',
    name: 'Test shop',
    kind: 'shop',
    pos: [10, -12],
    provenance: {
      source: 'openstreetmap',
      sourceVersion: 'test',
      license: 'ODbL-1.0',
      geometryStatus: 'real',
    },
  };
  const high = buildPropsGeometry('parking-test', [parkingRoad], [], hf, 'high', [shop]);
  const low = buildPropsGeometry('parking-test', [parkingRoad], [], hf, 'low', [shop]);
  const again = buildPropsGeometry('parking-test', [parkingRoad], [], hf, 'high', [shop]);
  assert.ok(high.geometry && low.geometry && again.geometry);
  assert.equal(PARKING_BAY_LIMITS.low, 0);
  assert.ok(high.counts.parkingBays >= 1);
  assert.ok(high.counts.parkingBays <= PARKING_BAY_LIMITS.high);
  assert.ok(high.counts.parkedVehicles >= 1);
  assert.equal(low.counts.parkingBays, 0);
  assert.deepEqual(
    Array.from((high.geometry!.attributes.position as THREE.BufferAttribute).array),
    Array.from((again.geometry!.attributes.position as THREE.BufferAttribute).array),
  );
  high.geometry!.dispose();
  low.geometry!.dispose();
  again.geometry!.dispose();
});

test('geo roadside props add utility poles, cable spans and street signs', () => {
  const hf = flatField();
  const utilityRoad = road({ id: 'utility-road', points: [[0, -30], [200, -30]], width: 7 });
  const props = buildPropsGeometry('utility-test', [utilityRoad], [], hf, 'high', []);
  assert.ok(props.geometry);
  assert.equal(props.counts.utilityPoles, 2);
  assert.equal(props.counts.streetSigns, 1);
  assert.equal(props.counts.utilityWires, 6);
  assert.ok(props.counts.streetlights >= 1);
  assert.ok(props.obstacles.length >= 2);
});

test('geo compound walls add deterministic gated frontage detail within the cap', () => {
  const hf = flatField();
  const compoundRoad = road({ id: 'compound-road', points: [[-20, -30], [300, -30]], width: 6.5 });
  const houses = Array.from({ length: 10 }, (_, i) => {
    const base = building();
    return {
      ...base,
      meta: { ...base.meta, id: `compound-${i}`, area: 100 },
      ring: base.ring.map(([x, z]) => [x + i * 24, z] as [number, number]),
    };
  });
  const props = buildPropsGeometry('compound-test', [compoundRoad], houses, hf, 'high', []);
  const low = buildPropsGeometry('compound-test', [compoundRoad], houses, hf, 'low', []);
  const again = buildPropsGeometry('compound-test', [compoundRoad], houses, hf, 'high', []);
  assert.ok(props.geometry && low.geometry && again.geometry);
  assert.ok(props.counts.compoundWalls > 0);
  assert.ok(props.counts.compoundWalls <= COMPOUND_WALL_LIMITS.high);
  assert.equal(props.counts.compoundGates, props.counts.compoundWalls);
  assert.equal(low.counts.compoundWalls, 0);
  assert.ok(props.geometry!.attributes.position.count > low.geometry!.attributes.position.count);
  assert.deepEqual(
    Array.from((props.geometry!.attributes.position as THREE.BufferAttribute).array),
    Array.from((again.geometry!.attributes.position as THREE.BufferAttribute).array),
  );
  props.geometry!.dispose();
  low.geometry!.dispose();
  again.geometry!.dispose();
});

test('geo road geometry adds drainage gutters and pavements on major roads', () => {
  const hf = flatField();
  const major = buildRoadGeometry([road({ id: 'major', roadClass: 'primary' })], hf, 'mid');
  const footway = buildRoadGeometry([road({ id: 'walk', roadClass: 'footway' })], hf, 'mid');
  assert.ok(major && footway);
  assert.ok(major!.attributes.position.count > footway!.attributes.position.count * 4);
  const positions = major!.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < positions.count; i++) assert.ok(positions.getY(i) >= 0);
});

test('geo shop fronts add painted sign boards', () => {
  const hf = flatField();
  const house = buildBuildingGeometry([building('small_house')], [decoded()], hf, 'high');
  const shop = buildBuildingGeometry([building('shop')], [decoded()], hf, 'high');
  assert.ok(house && shop);
  assert.ok(shop!.attributes.position.count > house!.attributes.position.count);
});

test('geo kerb faces point toward the carriageway on both pavement edges', () => {
  const hf = flatField();
  const street = road({ width: 6.5, points: [[0, -100], [200, -100]] });
  const geo = buildRoadGeometry([street], hf, 'mid');
  assert.ok(geo);
  const positions = geo!.attributes.position as THREE.BufferAttribute;
  const half = street.width / 2;
  const curb = -100 + half + 0.64;
  const outer = -100 + half + 1.78;
  const leftCurb = -100 - half - 0.64;
  const leftOuter = -100 - half - 1.78;
  const near = (value: number, target: number) => Math.abs(value - target) < 0.01;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const seen = { rightCurb: 0, rightOuter: 0, leftCurb: 0, leftOuter: 0 };
  for (let triangle = 0; triangle < positions.count / 3; triangle++) {
    const ia = triangle * 3;
    const ib = ia + 1;
    const ic = ia + 2;
    a.fromBufferAttribute(positions, ia);
    b.fromBufferAttribute(positions, ib);
    c.fromBufferAttribute(positions, ic);
    if (Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y) < 0.01) continue;
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac).normalize();
    const constantZ = near(a.z, b.z) && near(a.z, c.z);
    if (!constantZ) continue;
    if (near(a.z, curb)) {
      assert.ok(normal.z < -0.9, `right kerb should face the road, received ${normal.z.toFixed(2)}`);
      seen.rightCurb++;
    } else if (near(a.z, outer)) {
      assert.ok(normal.z > 0.9, `right outer kerb should face away, received ${normal.z.toFixed(2)}`);
      seen.rightOuter++;
    } else if (near(a.z, leftCurb)) {
      assert.ok(normal.z > 0.9, `left kerb should face the road, received ${normal.z.toFixed(2)}`);
      seen.leftCurb++;
    } else if (near(a.z, leftOuter)) {
      assert.ok(normal.z < -0.9, `left outer kerb should face away, received ${normal.z.toFixed(2)}`);
      seen.leftOuter++;
    }
  }
  assert.ok(
    seen.rightCurb > 0 && seen.rightOuter > 0 && seen.leftCurb > 0 && seen.leftOuter > 0,
    JSON.stringify(seen),
  );
  geo!.dispose();
});

test('geo vehicles mix taxis, private cars, buses, trucks and motos by road class', () => {
  const majorKinds = new Set<string>();
  const minorKinds = new Set<string>();
  for (let i = 0; i < 100; i++) {
    majorKinds.add(chooseVehicle(road({ roadClass: 'primary' }), i / 100));
    minorKinds.add(chooseVehicle(road({ roadClass: 'residential' }), i / 100));
  }
  assert.deepEqual([...majorKinds].sort(), ['bus', 'moto', 'private', 'taxi', 'truck']);
  assert.deepEqual([...minorKinds].sort(), ['moto', 'private', 'taxi']);
});

test('every production pack builds finite geometry for every chunk', async () => {
  const PUBLIC = new URL('../public/', import.meta.url);
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = String(input).replace(/^https?:\/\/[^/]+/, '');
    return new Response(readFileSync(new URL(url.replace(/^\/app\//, ''), PUBLIC)));
  }) as typeof fetch;

  const assertFinite = (geometry: THREE.BufferGeometry | null, label: string) => {
    assert.ok(geometry, `${label} geometry should build`);
    assert.ok(geometry!.attributes.position.count > 0, `${label} geometry should have positions`);
    const values = (geometry!.attributes.position as THREE.BufferAttribute).array;
    for (let index = 0; index < values.length; index++) {
      assert.ok(Number.isFinite(values[index]), `${label} geometry should contain only finite positions`);
    }
  };
  const geometryTriangles = (geometry: THREE.BufferGeometry | null): number => {
    if (!geometry) return 0;
    return geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  };
  const budget = { terrain: 0, roads: 0, buildings: 0, props: 0 };

  const packs = [
    { id: 'nlongkak', basePath: 'world/v1', version: 'nlongkak-2026-10-30-v2', chunks: 16 },
    { id: 'mvog_mbi', basePath: 'world/mvog-mbi/v1', version: 'mvog-mbi-2026-10-30-v1', chunks: 9 },
    { id: 'mokolo', basePath: 'world/mokolo/v1', version: 'mokolo-2026-10-30-v1', chunks: 6 },
    { id: 'bastos', basePath: 'world/bastos/v1', version: 'bastos-2026-10-30-v1', chunks: 9 },
    { id: 'ngoa_ekelle', basePath: 'world/ngoa-ekelle/v1', version: 'ngoa-ekelle-2026-10-30-v1', chunks: 9 },
    { id: 'boulevard', basePath: 'world/boulevard/v1', version: 'boulevard-2026-10-30-v1', chunks: 4 },
    { id: 'lac_municipal', basePath: 'world/lac-municipal/v1', version: 'lac-municipal-2026-10-30-v1', chunks: 9 },
    { id: 'mvan', basePath: 'world/mvan/v1', version: 'mvan-2026-10-30-v1', chunks: 9 },
    { id: 'mont_febe', basePath: 'world/mont-febe/v1', version: 'mont-febe-2026-10-30-v1', chunks: 9 },
  ] as const;

  for (const pack of packs) {
    const baseUrl = `/app/${pack.basePath}`;
    const manifest = await loadManifest(baseUrl, {
      fetchImpl,
      expectedWorldVersion: pack.version,
      expectedAreaId: pack.id,
    });
    const world = await loadWorldData(baseUrl, manifest, { fetchImpl });
    assert.equal(manifest.chunks.length, pack.chunks);

    for (const ref of manifest.chunks) {
      const chunk = await loadChunk(baseUrl, manifest, ref, { fetchImpl });
      const roads = roadsForChunk(world.roads, ref.bounds);
      const terrain = buildTerrainGeometry(chunk.terrain, 'high');
      const roadGeometry = buildRoadGeometry(roads, chunk.terrain, 'high');
      const buildingGeometry = buildBuildingGeometry(chunk.buildings, chunk.decodedBuildings, chunk.terrain, 'high');
      const props = buildPropsGeometry(ref.id, roads, chunk.buildings, chunk.terrain, 'high', chunk.pois);

      assertFinite(terrain, `${pack.id} ${ref.id} terrain`);
      assertFinite(roadGeometry, `${pack.id} ${ref.id} roads`);
      assertFinite(buildingGeometry, `${pack.id} ${ref.id} buildings`);
      assertFinite(props.geometry, `${pack.id} ${ref.id} props`);
      if (pack.id === 'nlongkak') {
        budget.terrain += geometryTriangles(terrain);
        budget.roads += geometryTriangles(roadGeometry);
        budget.buildings += geometryTriangles(buildingGeometry);
        budget.props += geometryTriangles(props.geometry);
      }

      terrain.dispose();
      roadGeometry?.dispose();
      buildingGeometry?.dispose();
      props.geometry?.dispose();
    }
  }

  // Regression guard for the mobile-oriented detail pass. These totals cover
  // every Nlongkak chunk at the highest tier, which is intentionally above the
  // runtime 560 m near LOD, so they catch accidental geometry explosions while
  // leaving room for small visual additions.
  assert.ok(budget.terrain < 155_000, `Nlongkak terrain triangles ${budget.terrain}`);
  assert.ok(budget.roads < 280_000, `Nlongkak road triangles ${budget.roads}`);
  assert.ok(budget.buildings < 1_350_000, `Nlongkak near building triangles ${budget.buildings}`);
  assert.ok(budget.props < 150_000, `Nlongkak prop triangles ${budget.props}`);
});
