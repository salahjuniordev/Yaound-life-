import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createHeightfield } from '../src/world/terrain.ts';
import type { BuildingGeometry, Heightfield, WorldData, WorldManifest, WorldRoad } from '../src/world/types.ts';
import type { DecodedBuilding } from '../src/world/buildings.ts';
import { GeoCollisionWorld } from '../src/render/geo/collision.ts';
import { RoadIndex } from '../src/render/geo/roadIndex.ts';
import { buildBuildingGeometry, buildRoadGeometry, buildTerrainGeometry, buildWaterGeometry } from '../src/render/geo/geometry.ts';
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

function building(): BuildingGeometry {
  return {
    meta: {
      id: 'b1',
      source: 'openstreetmap',
      sourceId: 'w1',
      classification: 'small_house',
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
    featureCounts: { chunks: 1, roads: 1, buildings: 1, pois: 0, waterPolygons: 0, terrainSamples: 9 },
    chunks: [],
    contentHash: '',
    validation: { ok: true, errors: [], warnings: [] },
  };
  const data: WorldData = {
    manifest,
    roads: [road({ points: [[0, -100], [200, -100]] })],
    pois: [],
    water: [],
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
