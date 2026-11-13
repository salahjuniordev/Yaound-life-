import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createHeightfield } from '../src/world/terrain.ts';
import type { BuildingGeometry, Heightfield, Poi, WorldData, WorldManifest, WorldRoad } from '../src/world/types.ts';
import type { DecodedBuilding } from '../src/world/buildings.ts';
import { GeoCollisionWorld } from '../src/render/geo/collision.ts';
import { RoadIndex } from '../src/render/geo/roadIndex.ts';
import {
  BALCONY_LIMITS,
  COMPOUND_WALL_LIMITS,
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
  const marketOnly = buildPropsGeometry('market-only', [], [], hf, 'high', [marketplace]);
  assert.ok(marketOnly.counts.vendorUmbrellas >= 1);
  assert.ok(marketOnly.counts.vendorUmbrellas <= VENDOR_STANDS_PER_MARKET);
  assert.equal(marketOnly.counts.displayTables, marketOnly.counts.vendorUmbrellas);
  assert.ok(clustered.counts.vendorUmbrellas >= 1);
  assert.equal(clustered.counts.displayTables, clustered.counts.vendorUmbrellas);
});

test('geo roadside props add utility poles, cable spans and street signs', () => {
  const hf = flatField();
  const utilityRoad = road({ id: 'utility-road', points: [[0, -30], [200, -30]], width: 7 });
  const props = buildPropsGeometry('utility-test', [utilityRoad], [], hf, 'high', []);
  assert.ok(props.geometry);
  assert.equal(props.counts.utilityPoles, 2);
  assert.equal(props.counts.streetSigns, 1);
  assert.equal(props.counts.utilityWires, 6);
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
