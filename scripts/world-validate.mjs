#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValidManifest, validateManifest } from '../src/world/manifest.ts';
import { decodeHeightfield } from '../src/world/terrain.ts';
import { decodeBuildings } from '../src/world/buildings.ts';
import { validateChunkPayload, validateWorldData } from '../src/world/validation.ts';

const ROOT = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const WORLD_DIR = join(ROOT, 'public/world/v1');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readBuffer(path) {
  return readFileSync(path);
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

const errors = [];
const warnings = [];
const manifestPath = join(WORLD_DIR, 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}. Run npm run world:build first.`);
  process.exit(1);
}
const rawManifest = readJson(manifestPath);
for (const message of validateManifest(rawManifest)) errors.push(`manifest: ${message}`);
const manifest = assertValidManifest(rawManifest);

const roads = readJson(join(WORLD_DIR, 'roads/network.json'));
const pois = readJson(join(WORLD_DIR, 'pois/pois.json'));
const water = readJson(join(WORLD_DIR, 'water/water.json'));
const districts = readJson(join(WORLD_DIR, 'districts/districts.json'));
const coarseBuffer = readBuffer(join(WORLD_DIR, 'terrain/heightfield.bin'));
const coarseTerrain = decodeHeightfield(coarseBuffer.buffer.slice(coarseBuffer.byteOffset, coarseBuffer.byteOffset + coarseBuffer.byteLength));

const worldIssues = validateWorldData({ manifest, roads, pois, water, districts, coarseTerrain });
for (const issue of worldIssues) {
  if (issue.severity === 'error') errors.push(`${issue.scope}: ${issue.message}`);
  else warnings.push(`${issue.scope}: ${issue.message}`);
}

for (const ref of manifest.chunks) {
  const terrainPath = join(WORLD_DIR, ref.terrainFile);
  const buildingsPath = join(WORLD_DIR, ref.buildingsFile);
  const metaPath = join(WORLD_DIR, ref.buildingsMetaFile);
  const roadsPath = join(WORLD_DIR, ref.roadsFile);
  const poisPath = join(WORLD_DIR, ref.poisFile);
  for (const path of [terrainPath, buildingsPath, metaPath, roadsPath, poisPath]) {
    if (!existsSync(path)) {
      errors.push(`chunk ${ref.id}: missing ${path.slice(WORLD_DIR.length + 1)}`);
      continue;
    }
  }
  if (!existsSync(terrainPath) || !existsSync(buildingsPath) || !existsSync(metaPath) || !existsSync(roadsPath) || !existsSync(poisPath)) continue;
  const terrainBuffer = readBuffer(terrainPath);
  const buildingBuffer = readBuffer(buildingsPath);
  const metaBuffer = readBuffer(metaPath);
  const roadsBuffer = readBuffer(roadsPath);
  const poisBuffer = readBuffer(poisPath);
  const hash = sha256(Buffer.concat([buildingBuffer, metaBuffer, roadsBuffer, poisBuffer, terrainBuffer]));
  if (hash !== ref.hash) errors.push(`chunk ${ref.id}: content hash mismatch`);
  const terrain = decodeHeightfield(terrainBuffer.buffer.slice(terrainBuffer.byteOffset, terrainBuffer.byteOffset + terrainBuffer.byteLength));
  const decoded = decodeBuildings(buildingBuffer.buffer.slice(buildingBuffer.byteOffset, buildingBuffer.byteOffset + buildingBuffer.byteLength));
  const meta = JSON.parse(metaBuffer.toString('utf8'));
  if (decoded.length !== meta.length) errors.push(`chunk ${ref.id}: geometry/metadata count mismatch`);
  const chunkRoads = JSON.parse(roadsBuffer.toString('utf8'));
  if (chunkRoads.length !== ref.roadCount) errors.push(`chunk ${ref.id}: road count mismatch`);
  if (decoded.length !== ref.buildingCount) errors.push(`chunk ${ref.id}: building count mismatch`);
  const issues = validateChunkPayload(manifest, ref.id, chunkRoads, decoded.map((b, i) => ({ ring: b.ring, height: meta[i]?.height ?? 0 })), terrain);
  for (const issue of issues) {
    if (issue.severity === 'error') errors.push(`${issue.scope}: ${issue.message}`);
    else warnings.push(`${issue.scope}: ${issue.message}`);
  }
}

console.log(`world: ${manifest.area.name} (${manifest.worldVersion})`);
console.log(`chunks: ${manifest.chunks.length}, roads: ${manifest.featureCounts.roads}, buildings: ${manifest.featureCounts.buildings}, pois: ${manifest.featureCounts.pois}, water: ${manifest.featureCounts.waterPolygons}`);
console.log(`elevation offset: ${manifest.verticalOffset.toFixed(1)} m, water level: ${manifest.waterLevel ?? 'none'}`);
if (warnings.length > 0) {
  console.log(`warnings: ${warnings.length}`);
  for (const warning of warnings.slice(0, 10)) console.log(`  WARN ${warning}`);
}
if (errors.length > 0) {
  console.error(`validation FAILED (${errors.length} errors)`);
  for (const error of errors.slice(0, 30)) console.error(`  ERROR ${error}`);
  process.exit(1);
}
console.log('validation PASS');
