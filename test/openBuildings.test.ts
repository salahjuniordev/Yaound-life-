import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WorldTransform, makeOrigin } from '../src/world/transform';
import {
  OPEN_BUILDINGS_SOURCE_ID,
  enabledOpenBuildingsSourceConfig,
  footprintsOverlap,
  importOpenBuildings,
  openBuildingToGeometry,
  parseOpenBuildingsCsv,
  parseOpenBuildingsSourceConfig,
  validateOpenBuildingsSourceConfig,
} from '../src/world/openBuildings';
import type { OpenBuildingsSourceConfig } from '../src/world/openBuildings';

const SYNTHETIC_CSV = readFileSync(new URL('./fixtures/open-buildings-synthetic.csv', import.meta.url), 'utf8');
const MALFORMED_CSV = readFileSync(new URL('./fixtures/open-buildings-malformed.csv', import.meta.url), 'utf8');
const ORIGIN_LON = 11.5189;
const ORIGIN_LAT = 3.887;
const transform = new WorldTransform(makeOrigin(ORIGIN_LON, ORIGIN_LAT));
const bounds = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 };

function source(overrides: Partial<OpenBuildingsSourceConfig> = {}): OpenBuildingsSourceConfig {
  return {
    id: OPEN_BUILDINGS_SOURCE_ID,
    name: 'Google Open Buildings V3 synthetic test source',
    url: 'https://sites.research.google/open-buildings/',
    license: 'CC-BY-4.0',
    attribution: 'Google Open Buildings (synthetic test fixture)',
    snapshotDate: '2023-05-01',
    exportFile: 'test/fixtures/open-buildings-synthetic.csv',
    minConfidence: 0.75,
    usage: 'Synthetic contract test only; never a production source.',
    ...overrides,
  };
}

function ringFromLonLat(coords: [number, number][]): [number, number][] {
  return coords.map(([lon, lat]) => {
    const point = transform.gameFromLonLat({ lon, lat });
    return [point.x, point.z];
  });
}

const OSM_CONFLICT_RING = ringFromLonLat([
  [11.51785, 3.88585],
  [11.51815, 3.88585],
  [11.51815, 3.88615],
  [11.51785, 3.88615],
]);

function importFixture(overrides: Partial<Parameters<typeof importOpenBuildings>[0]> = {}) {
  return importOpenBuildings({
    source: source(),
    csv: SYNTHETIC_CSV,
    bounds,
    transform,
    osmBuildings: [{ id: 'osm-synthetic-conflict', ring: OSM_CONFLICT_RING }],
    minArea: 12,
    ...overrides,
  });
}

test('Open Buildings source config requires an explicit accepted licence and attribution', () => {
  assert.deepEqual(validateOpenBuildingsSourceConfig(source()), []);

  const bad = validateOpenBuildingsSourceConfig({
    ...source(),
    license: 'proprietary',
    attribution: 'A source',
    url: 'http://example.invalid/export',
    snapshotDate: '2023-02-31',
    exportFile: '../outside.csv',
    minConfidence: 0.4,
  });
  assert.ok(bad.some((error) => error.includes('license')));
  assert.ok(bad.some((error) => error.includes('attribution')));
  assert.ok(bad.some((error) => error.includes('https')));
  assert.ok(bad.some((error) => error.includes('snapshotDate')));
  assert.ok(bad.some((error) => error.includes('exportFile')));
  assert.ok(bad.some((error) => error.includes('minConfidence')));
  assert.throws(() => parseOpenBuildingsSourceConfig({ ...source(), license: 'proprietary' }), /Invalid Open Buildings source config/);
});

test('Open Buildings import is opt-in through the world config', () => {
  assert.equal(enabledOpenBuildingsSourceConfig({}), null);
  assert.equal(enabledOpenBuildingsSourceConfig({ openBuildings: { enabled: false } }), null);
  assert.equal(enabledOpenBuildingsSourceConfig({ openBuildings: { ...source(), enabled: true } })?.snapshotDate, '2023-05-01');
  assert.throws(() => enabledOpenBuildingsSourceConfig({ openBuildings: { ...source(), enabled: 'yes' } }), /enabled must be a boolean/);
});

test('checked-in world configs keep Open Buildings production ingestion disabled', () => {
  for (const name of ['nlongkak', 'mvog_mbi']) {
    const config = JSON.parse(readFileSync(new URL(`../data/geodata/config/${name}.json`, import.meta.url), 'utf8'));
    assert.equal(enabledOpenBuildingsSourceConfig(config), null);
    assert.ok(config.notUsed?.some((item: { id: string }) => item.id === OPEN_BUILDINGS_SOURCE_ID));
  }
});

test('Open Buildings CSV parser accepts Polygon and MultiPolygon WKT and preserves deterministic provenance fields', () => {
  const parsed = parseOpenBuildingsCsv(SYNTHETIC_CSV);
  assert.equal(parsed.issues.length, 0);
  assert.equal(parsed.rows.length, 6);

  const first = parsed.rows[0];
  assert.equal(first.rowNumber, 2);
  assert.equal(first.fullPlusCode, 'TEST+OB1');
  assert.equal(first.parts.length, 1);
  assert.equal(first.parts[0].ring.length, 4, 'closing WKT vertex should be removed');
  assert.match(first.parts[0].sourceId, /^v3-TEST\+OB1-[0-9a-f]{8}$/);

  const multi = parsed.rows.find((row) => row.fullPlusCode === 'TEST+OB5');
  assert.ok(multi);
  assert.equal(multi.parts.length, 2);
  assert.notEqual(multi.parts[0].sourceId, multi.parts[1].sourceId);
  assert.match(multi.parts[0].sourceId, /-0$/);
  assert.match(multi.parts[1].sourceId, /-1$/);

  const again = parseOpenBuildingsCsv(SYNTHETIC_CSV);
  assert.deepEqual(
    again.rows.flatMap((row) => row.parts.map((part) => part.sourceId)),
    parsed.rows.flatMap((row) => row.parts.map((part) => part.sourceId)),
  );
});

test('Open Buildings CSV parser reports malformed and unsupported rows without aborting the file', () => {
  const parsed = parseOpenBuildingsCsv(MALFORMED_CSV);
  assert.equal(parsed.rows.length, 0);
  assert.deepEqual(
    parsed.issues.map((issue) => issue.reason),
    ['invalid-area', 'invalid-confidence', 'unsupported-geometry', 'invalid-geometry', 'unsupported-geometry'],
  );
  assert.deepEqual(
    parsed.issues.map((issue) => issue.rowNumber),
    [2, 3, 4, 5, 6],
  );
});

test('Open Buildings CSV parser rejects missing required columns', () => {
  assert.throws(
    () => parseOpenBuildingsCsv('latitude,longitude,confidence\n3.887,11.519,0.9\n'),
    /missing required column/,
  );
});

test('Open Buildings importer filters confidence, bounds and area before retaining provenance', () => {
  const result = importFixture();
  assert.equal(result.stats.parsedRows, 6);
  assert.equal(result.stats.candidates, 6);
  assert.equal(result.stats.accepted, 3);
  assert.equal(result.stats.lowConfidence, 1);
  assert.equal(result.stats.outsideBounds, 1);
  assert.equal(result.stats.belowMinimumArea, 1);
  assert.equal(result.stats.osmOverlaps, 1);
  assert.equal(result.candidates.length, 3);

  for (const candidate of result.candidates) {
    assert.equal(candidate.source, OPEN_BUILDINGS_SOURCE_ID);
    assert.equal(candidate.sourceVersion, '2023-05-01');
    assert.equal(candidate.license, 'CC-BY-4.0');
    assert.equal(candidate.attribution, source().attribution);
    assert.ok(candidate.confidence >= 0.75);
    assert.ok(candidate.area >= 12);
    assert.ok(candidate.id.startsWith('gob-v3-'));
  }

  const geometry = openBuildingToGeometry(result.candidates[0], result.candidates[0].ring);
  assert.equal(geometry.meta.source, OPEN_BUILDINGS_SOURCE_ID);
  assert.equal(geometry.meta.sourceId, result.candidates[0].sourceId);
  assert.equal(geometry.meta.confidence, result.candidates[0].confidence);
  assert.equal(geometry.meta.geometryStatus, 'inferred');
  assert.equal(geometry.meta.heightStatus, 'inferred');
  assert.equal(geometry.meta.architectureStatus, 'procedural');
  assert.ok(geometry.meta.height > 0);
  assert.ok(geometry.meta.area > 0);
});

test('Open Buildings deduplication keeps OSM geometry and rejects overlapping detections', () => {
  const osmBefore = OSM_CONFLICT_RING.map(([x, z]) => [x, z] as [number, number]);
  const result = importFixture();
  const overlapIssue = result.issues.find((issue) => issue.reason === 'overlaps-osm');
  assert.ok(overlapIssue);
  assert.match(overlapIssue.detail, /OSM geometry retained/);
  assert.ok(!result.candidates.some((candidate) => candidate.fullPlusCode === 'TEST+OB3'));
  assert.deepEqual(OSM_CONFLICT_RING, osmBefore);

  assert.equal(footprintsOverlap(OSM_CONFLICT_RING, OSM_CONFLICT_RING), true);
  assert.equal(
    footprintsOverlap(OSM_CONFLICT_RING, ringFromLonLat([
      [11.51790, 3.88590],
      [11.51810, 3.88590],
      [11.51810, 3.88610],
      [11.51790, 3.88610],
    ])),
    true,
  );
  assert.equal(
    footprintsOverlap(OSM_CONFLICT_RING, ringFromLonLat([
      [11.51900, 3.88700],
      [11.51910, 3.88700],
      [11.51910, 3.88710],
      [11.51900, 3.88710],
    ])),
    false,
  );
});

test('Open Buildings importer rejects duplicate detections instead of adding a second footprint', () => {
  const duplicateRow = SYNTHETIC_CSV.trimEnd().split('\n')[1];
  const result = importFixture({ csv: `${SYNTHETIC_CSV.trimEnd()}\n${duplicateRow}\n` });
  assert.equal(result.stats.accepted, 3);
  assert.equal(result.stats.duplicates, 1);
  assert.ok(result.issues.some((issue) => issue.reason === 'duplicate'));
  assert.equal(result.candidates.filter((candidate) => candidate.fullPlusCode === 'TEST+OB1').length, 1);
});

test('Open Buildings provenance remains traceable when the caller simplifies the ring', () => {
  const result = importFixture();
  const candidate = result.candidates[0];
  const simplified = [...candidate.ring];
  const geometry = openBuildingToGeometry(candidate, simplified);
  assert.equal(geometry.meta.sourceId, candidate.sourceId);
  assert.equal(geometry.meta.id, candidate.id);
  assert.equal(geometry.meta.area, Math.round(candidate.area * 10) / 10);
});
