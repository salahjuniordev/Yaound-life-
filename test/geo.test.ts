import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createHeightfield } from '../src/world/terrain.ts';
import type { BuildingGeometry, Heightfield, Poi, WorldData, WorldManifest, WorldRoad } from '../src/world/types.ts';
import type { DecodedBuilding } from '../src/world/buildings.ts';
import { GeoCollisionWorld } from '../src/render/geo/collision.ts';
import { RoadIndex } from '../src/render/geo/roadIndex.ts';
import {
  buildBuildingGeometry,
  buildPropsGeometry,
  buildRoadGeometry,
  buildTerrainGeometry,
  buildWaterGeometry,
  buildWaterwaysGeometry,
  chooseVehicle,
} from '../src/render/geo/geometry.ts';
import { createGeoAdapter } from '../src/render/geo/adapter.ts';

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

test('geo terrain geometry samples the heightfield and has upward-facing indices', () => {
  const hf = flatField();
  const geo = buildTerrainGeometry(hf, 'high');
  assert.ok(geo.attributes.position.count >= 9);
  assert.ok(geo.index && geo.index.count > 0);
  geo.dispose();
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

test('geo building geometry builds walls and a roof from a footprint', () => {
  const hf = flatField();
  const geo = buildBuildingGeometry([building()], [decoded()], hf, 'high');
  assert.ok(geo);
  const pos = geo!.attributes.position as THREE.BufferAttribute;
  assert.ok(pos.count > 12);
  geo!.dispose();
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

test('geo road index finds the nearest walkable segment', () => {
  const index = new RoadIndex([road()]);
  const hit = index.nearest(100, -95, 20);
  assert.ok(hit);
  assert.ok(hit!.distance <= 5.01);
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
  const mapped = adapter.toWorldPosition('nlongkak', [-95, -25]);
  assert.ok(Number.isFinite(mapped[0]) && Number.isFinite(mapped[1]));
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
