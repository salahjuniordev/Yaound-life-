import test from 'node:test';
import assert from 'node:assert/strict';
import { utmForward, utmInverse, WorldTransform, makeOrigin, projectedToGame, gameToProjected } from '../src/world/transform';
import {
  chunkKey,
  chunkIndexFromGame,
  chunkBounds,
  chunkBoundsFromProjected,
  chunkIndexFromKey,
  chunkIdsAround,
  worldBoundsFromProjected,
} from '../src/world/chunks';
import { createHeightfield, heightAt, sampleChunkHeightfield, heightfieldEdgeMatches, encodeHeightfield, decodeHeightfield } from '../src/world/terrain';
import { buildRoadGraph, validateRoad, pointToPolylineDistance, clipPolylineToBounds } from '../src/world/roads';
import {
  polygonArea,
  polygonCentroid,
  pointInPolygon,
  closestPointOnPolygon,
  resolveCirclePolygon,
  classifyBuilding,
  inferFloors,
  encodeBuildings,
  decodeBuildings,
  deterministicColors,
  hashString,
} from '../src/world/buildings';
import { validateManifest, WORLD_FORMAT, WORLD_FORMAT_VERSION } from '../src/world/manifest';
import type { BuildingGeometry, WorldManifest, WorldRoad } from '../src/world/types';

const YAOUNDE = { lon: 11.518966, lat: 3.8870052 };

function road(overrides: Partial<WorldRoad> = {}): WorldRoad {
  return {
    id: 'road-1',
    roadClass: 'residential',
    points: [[0, 0], [10, 0], [10, 10]],
    width: 6.5,
    widthStatus: 'inferred',
    oneway: false,
    bridge: false,
    tunnel: false,
    walkable: true,
    provenance: {
      source: 'openstreetmap',
      sourceVersion: 'test',
      license: 'ODbL-1.0',
      geometryStatus: 'real',
    },
    ...overrides,
  };
}

test('UTM 32N forward/inverse round trips in Yaoundé', () => {
  const projected = utmForward(YAOUNDE.lon, YAOUNDE.lat);
  assert.ok(projected.east > 700000 && projected.east < 800000);
  assert.ok(projected.north > 400000 && projected.north < 460000);
  const back = utmInverse(projected.east, projected.north);
  assert.ok(Math.abs(back.lon - YAOUNDE.lon) < 1e-8);
  assert.ok(Math.abs(back.lat - YAOUNDE.lat) < 1e-8);
});

test('game coordinates map east to +X and north to -Z', () => {
  const origin = makeOrigin(11.5, 3.88);
  const eastPoint = projectedToGame({ east: origin.east + 100, north: origin.north }, origin);
  const northPoint = projectedToGame({ east: origin.east, north: origin.north + 100 }, origin);
  assert.equal(eastPoint.x, 100);
  assert.equal(eastPoint.z, 0);
  assert.equal(northPoint.x, 0);
  assert.equal(northPoint.z, -100);
  const roundTrip = gameToProjected(eastPoint, origin);
  assert.ok(Math.abs(roundTrip.east - (origin.east + 100)) < 1e-9);
});

test('WorldTransform converts between WGS84 and game coordinates', () => {
  const origin = makeOrigin(11.5126, 3.878);
  const transform = new WorldTransform(origin, 1);
  const game = transform.gameFromLonLat({ lon: 11.518966, lat: 3.8870052 });
  assert.ok(game.x > 0);
  assert.ok(game.z < 0);
  const back = transform.lonLatFromGame(game);
  assert.ok(Math.abs(back.lon - 11.518966) < 1e-8);
  assert.ok(Math.abs(back.lat - 3.8870052) < 1e-8);
});

test('chunk keys and bounds are stable', () => {
  const origin = makeOrigin(11.5126, 3.878);
  assert.equal(chunkKey(0, 0), 'c_0_0');
  assert.equal(chunkKey(-2, 3), 'c_-2_3');
  assert.deepEqual(chunkIndexFromKey('c_-2_3'), { ix: -2, iz: 3 });
  assert.equal(chunkIndexFromKey('nope'), null);
  assert.deepEqual(chunkBounds(0, 0, origin, 512), { minX: 0, maxX: 512, minZ: -512, maxZ: 0 });
  assert.deepEqual(chunkIndexFromGame(10, -10, origin, 512), { ix: 0, iz: 0 });
  assert.deepEqual(chunkIndexFromGame(513, -10, origin, 512), { ix: 1, iz: 0 });
  assert.deepEqual(chunkIndexFromGame(10, -513, origin, 512), { ix: 0, iz: 1 });
  const projectedBounds = chunkBoundsFromProjected(0, 0, origin, 512);
  assert.equal(projectedBounds.minEast, origin.east);
  assert.equal(projectedBounds.minNorth, origin.north);
  const worldBounds = worldBoundsFromProjected(origin.east, origin.east + 1024, origin.north, origin.north + 1024, origin);
  assert.equal(worldBounds.minX, 0);
  assert.equal(worldBounds.maxX, 1024);
  assert.equal(worldBounds.minZ, -1024);
  assert.equal(worldBounds.maxZ, 0);
  assert.deepEqual(chunkIdsAround(0, 0, 1), ['c_-1_-1', 'c_0_-1', 'c_1_-1', 'c_-1_0', 'c_0_0', 'c_1_0', 'c_-1_1', 'c_0_1', 'c_1_1']);
});

test('heightfield bilinear sampling and binary round trip', () => {
  const heights = new Float32Array([0, 10, 20, 10, 20, 30, 20, 30, 40]);
  const hf = createHeightfield(3, 3, 10, 0, 0, heights);
  assert.equal(heightAt(hf, 0, 0), 0);
  assert.equal(heightAt(hf, 20, 20), 40);
  assert.equal(heightAt(hf, 10, 10), 20);
  assert.equal(heightAt(hf, 5, 5), 10);
  assert.equal(heightAt(hf, -100, -100), 0);
  assert.equal(heightAt(hf, 1000, 1000), 40);
  const decoded = decodeHeightfield(encodeHeightfield(hf));
  assert.equal(decoded.width, 3);
  assert.equal(decoded.height, 3);
  assert.equal(decoded.heights[8], 40);
});

test('adjacent chunk heightfields share identical edges', () => {
  const heights = new Float32Array(9 * 9);
  for (let z = 0; z < 9; z++) {
    for (let x = 0; x < 9; x++) heights[z * 9 + x] = Math.sin(x * 0.4) * 5 + Math.cos(z * 0.3) * 3;
  }
  const global = createHeightfield(9, 9, 16, 0, 0, heights);
  const left = sampleChunkHeightfield(global, { minX: 0, maxX: 64, minZ: -64, maxZ: 0 }, 16);
  const right = sampleChunkHeightfield(global, { minX: 64, maxX: 128, minZ: -64, maxZ: 0 }, 16);
  assert.equal(left.width, 5);
  assert.equal(right.width, 5);
  assert.ok(heightfieldEdgeMatches(left, right, 'x'));
});

test('road validation catches malformed polylines and zero-length segments', () => {
  assert.equal(validateRoad(road()).length, 0);
  assert.ok(validateRoad(road({ points: [[0, 0]] })).length > 0);
  assert.ok(validateRoad(road({ points: [[0, 0], [0, 0]] })).length > 0);
  assert.ok(validateRoad(road({ points: [[0, 0], [Number.NaN, 2]] })).length > 0);
  assert.ok(validateRoad(road({ width: 0 })).length > 0);
});

test('road graph connects ways through shared OSM nodes', () => {
  const a = road({ id: 'a', points: [[0, 0], [10, 0]], nodeIds: [1, 2] });
  const b = road({ id: 'b', points: [[10, 0], [10, 10]], nodeIds: [2, 3] });
  const graph = buildRoadGraph([a, b]);
  assert.equal(graph.nodes.size, 3);
  assert.equal(graph.edges.size, 2);
  const shared = graph.nodes.get('osm:2');
  assert.ok(shared);
  assert.equal(shared.edges.length, 2);
});

test('road geometry utilities preserve curves and clip to chunks', () => {
  const dist = pointToPolylineDistance(5, 3, [[0, 0], [10, 0]]);
  assert.equal(dist.distance, 3);
  assert.equal(dist.x, 5);
  const clipped = clipPolylineToBounds([[-10, 5], [10, 5], [30, 5]], { minX: 0, maxX: 20, minZ: 0, maxZ: 10 });
  assert.equal(clipped.length, 1);
  assert.ok(clipped[0].length >= 2);
  assert.ok(clipped[0][0][0] >= 0);
  assert.ok(clipped[0][clipped[0].length - 1][0] <= 20);
});

test('building polygon area, centroid, point tests and collision', () => {
  const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(polygonArea(ring), 100);
  assert.deepEqual(polygonCentroid(ring), [5, 5]);
  assert.equal(pointInPolygon(5, 5, ring), true);
  assert.equal(pointInPolygon(15, 5, ring), false);
  assert.equal(closestPointOnPolygon(15, 5, ring).distance, 5);
  const inside = resolveCirclePolygon(5, 5, 0.5, ring);
  assert.equal(inside.collided, true);
  assert.equal(pointInPolygon(inside.x, inside.z, ring), false);
  const outside = resolveCirclePolygon(10.3, 5, 0.5, ring);
  assert.equal(outside.collided, true);
  assert.ok(outside.x > 10.5);
  const free = resolveCirclePolygon(20, 20, 0.5, ring);
  assert.equal(free.collided, false);
});

test('building classification and height inference are conservative', () => {
  assert.equal(classifyBuilding({ building: 'church' }), 'church');
  assert.equal(classifyBuilding({ building: 'yes', shop: 'bakery' }), 'shop');
  assert.equal(classifyBuilding({ building: 'apartments', 'building:levels': '6' }), 'apartment');
  assert.equal(classifyBuilding({ building: 'house' }), 'small_house');
  assert.equal(classifyBuilding({}), 'unknown');
  assert.deepEqual(inferFloors({ 'building:levels': '4' }, 100, 'a'), { floors: 4, status: 'real' });
  const inferred = inferFloors({}, 100, 'a');
  assert.equal(inferred.status, 'inferred');
  assert.ok(inferred.floors >= 1 && inferred.floors <= 4);
});

test('building binary round trip preserves footprint and height', () => {
  const buildings: BuildingGeometry[] = [
    {
      meta: {
        id: 'b1',
        source: 'test',
        classification: 'small_house',
        height: 4.2,
        floors: 1,
        area: 100,
        confidence: 0.9,
        geometryStatus: 'real',
        heightStatus: 'inferred',
        architectureStatus: 'procedural',
        gameplayStatus: 'designed',
      },
      ring: [[0, 0], [10, 0], [10, 10], [0, 10]],
    },
  ];
  const decoded = decodeBuildings(encodeBuildings(0, 0, buildings));
  assert.equal(decoded.length, 1);
  assert.equal(decoded[0].height, 4.2);
  assert.equal(decoded[0].classification, 'small_house');
  assert.ok(Math.abs(decoded[0].ring[2][0] - 10) < 0.01);
  assert.ok(Math.abs(decoded[0].ring[2][1] - 10) < 0.01);
  const colors = deterministicColors('b1');
  assert.deepEqual(colors.wall, decoded[0].wall);
  assert.equal(hashString('b1'), hashString('b1'));
});

test('manifest validation rejects incompatible or incomplete manifests', () => {
  const origin = makeOrigin(11.5126, 3.878);
  const manifest: WorldManifest = {
    format: WORLD_FORMAT,
    formatVersion: WORLD_FORMAT_VERSION,
    worldVersion: 'test-1',
    generatorVersion: 'test',
    generatedAt: '2026-10-31T00:00:00Z',
    area: { id: 'nlongkak', name: 'Nlongkak', description: 'test' },
    projection: { id: 'EPSG:32632', name: 'WGS 84 / UTM zone 32N', zone: 32, hemisphere: 'N', datum: 'WGS84', centralMeridian: 9 },
    origin,
    unitsPerMetre: 1,
    verticalScale: 1,
    verticalOffset: 0,
    elevationDatum: 'test',
    terrainCellSize: 8,
    coarseTerrainCellSize: 16,
    chunkSize: 512,
    bounds: worldBoundsFromProjected(origin.east, origin.east + 512, origin.north, origin.north + 512, origin),
    waterLevel: null,
    sources: [{ id: 'test', name: 'Test', url: '', license: 'test', attribution: 'test', snapshotDate: '2026-10-31', usage: 'test' }],
    featureCounts: { chunks: 1, roads: 0, buildings: 0, pois: 0, waterPolygons: 0, terrainSamples: 0 },
    chunks: [
      {
        id: 'c_0_0',
        ix: 0,
        iz: 0,
        bounds: { minX: 0, maxX: 512, minZ: -512, maxZ: 0 },
        terrainFile: 'terrain/c_0_0.bin',
        roadsFile: 'roads/c_0_0.json',
        buildingsFile: 'buildings/c_0_0.bin',
        buildingsMetaFile: 'buildings/c_0_0.json',
        poisFile: 'pois/c_0_0.json',
        buildingCount: 0,
        roadCount: 0,
        hash: 'x',
      },
    ],
    contentHash: 'x',
    validation: { ok: true, errors: [], warnings: [] },
  };
  assert.deepEqual(validateManifest(manifest), []);
  assert.ok(validateManifest({ ...manifest, formatVersion: 99 }).length > 0);
  assert.ok(validateManifest({ ...manifest, projection: { id: 'EPSG:3857' } }).length > 0);
  assert.ok(validateManifest({ ...manifest, chunks: [] }).length > 0);
});
