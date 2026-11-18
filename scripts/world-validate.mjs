#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValidManifest, validateManifest } from '../src/world/manifest.ts';
import { decodeHeightfield } from '../src/world/terrain.ts';
import { decodeBuildings } from '../src/world/buildings.ts';
import { validateChunkPayload, validateWorldData } from '../src/world/validation.ts';
import { validateWorldFileCatalog } from '../src/world/offline.ts';
import { validateWorldPackRegistry } from '../src/world/registry.ts';

const ROOT = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const PACK_PREFIX = (process.argv[2] ?? 'world/v1').replace(/^\/+/, '').replace(/^public\//, '').replace(/\/+$/, '');
if (!/^world\/[A-Za-z0-9._/-]+$/.test(PACK_PREFIX) || PACK_PREFIX.includes('..')) {
  console.error(`Invalid world pack path: ${process.argv[2] ?? ''}`);
  process.exit(1);
}
const WORLD_DIR = join(ROOT, 'public', PACK_PREFIX);
const REGISTRY_PATH = join(ROOT, 'public/world/registry.json');

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

let registry = null;
if (!existsSync(REGISTRY_PATH)) {
  errors.push('registry: missing public/world/registry.json');
} else {
  try {
    registry = validateWorldPackRegistry(readJson(REGISTRY_PATH));
  } catch (error) {
    errors.push(`registry: ${error instanceof Error ? error.message : String(error)}`);
  }
}
const registered = registry?.packs.find((pack) => pack.districtId === manifest.area.id) ?? null;
if (registry && !registered) errors.push(`registry: no pack registered for ${manifest.area.id}`);
if (registered) {
  if (registered.worldVersion !== manifest.worldVersion) errors.push('registry: worldVersion does not match manifest');
  if (registered.manifestFormatVersion !== manifest.formatVersion) errors.push('registry: manifestFormatVersion does not match manifest');
  if (registered.basePath !== PACK_PREFIX) errors.push(`registry: unexpected basePath ${registered.basePath} for ${PACK_PREFIX}`);
}
for (const pack of registry?.packs ?? []) {
  const packManifestPath = join(ROOT, 'public', pack.basePath, 'manifest.json');
  if (!existsSync(packManifestPath)) {
    errors.push(`registry: ${pack.id} is missing ${pack.basePath}/manifest.json`);
    continue;
  }
  try {
    const packManifest = assertValidManifest(readJson(packManifestPath));
    if (packManifest.worldVersion !== pack.worldVersion) errors.push(`registry: ${pack.id} worldVersion does not match its manifest`);
    if (packManifest.area.id !== pack.districtId) errors.push(`registry: ${pack.id} district does not match its manifest area`);
    if (packManifest.formatVersion !== pack.manifestFormatVersion) errors.push(`registry: ${pack.id} manifest format does not match`);
  } catch (error) {
    errors.push(`registry: ${pack.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const roads = readJson(join(WORLD_DIR, 'roads/network.json'));
const pois = readJson(join(WORLD_DIR, 'pois/pois.json'));
const water = readJson(join(WORLD_DIR, 'water/water.json'));
const waterways = readJson(join(WORLD_DIR, 'water/waterways.json'));
const districts = readJson(join(WORLD_DIR, 'districts/districts.json'));
const coarseBuffer = readBuffer(join(WORLD_DIR, 'terrain/heightfield.bin'));
const coarseTerrain = decodeHeightfield(coarseBuffer.buffer.slice(coarseBuffer.byteOffset, coarseBuffer.byteOffset + coarseBuffer.byteLength));

const worldIssues = validateWorldData({ manifest, roads, pois, water, waterways, districts, coarseTerrain });
for (const issue of worldIssues) {
  if (issue.severity === 'error') errors.push(`${issue.scope}: ${issue.message}`);
  else warnings.push(`${issue.scope}: ${issue.message}`);
}

const catalogPath = join(WORLD_DIR, 'files.json');
let catalog = null;
if (!existsSync(catalogPath)) {
  errors.push('catalog: missing files.json');
} else {
  try {
    catalog = validateWorldFileCatalog(readJson(catalogPath));
  } catch (error) {
    errors.push(`catalog: ${error instanceof Error ? error.message : String(error)}`);
  }
}
if (catalog) {
  if (catalog.worldVersion !== manifest.worldVersion) errors.push('catalog: worldVersion does not match manifest');
  const prefix = `${PACK_PREFIX}/`;
  const listed = new Set(catalog.files.map((file) => file.path));
  for (const file of catalog.files) {
    const relative = file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path;
    const full = join(WORLD_DIR, relative);
    if (!existsSync(full)) {
      errors.push(`catalog: missing ${file.path}`);
      continue;
    }
    const actual = statSync(full).size;
    if (actual !== file.bytes) errors.push(`catalog: byte size mismatch for ${file.path} (${actual} != ${file.bytes})`);
  }
  const precachePath = join(WORLD_DIR, 'precache.json');
  if (!existsSync(precachePath)) {
    errors.push('catalog: missing precache.json');
  } else {
    const precache = readJson(precachePath);
    if (JSON.stringify(precache) !== JSON.stringify(catalog.initial)) errors.push('catalog: precache.json does not match catalog initial files');
  }
  const walk = (dir) => {
    const out = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) out.push(...walk(full));
      else out.push(full);
    }
    return out;
  };
  for (const full of walk(WORLD_DIR)) {
    const relative = full.slice(WORLD_DIR.length + 1).replaceAll('\\', '/');
    if (relative === 'files.json' || relative === 'precache.json') continue;
    if (!listed.has(`${prefix}${relative}`)) errors.push(`catalog: ${relative} is not listed`);
  }
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

console.log(`world: ${manifest.area.name} (${manifest.worldVersion}) at ${PACK_PREFIX}`);
console.log(`chunks: ${manifest.chunks.length}, roads: ${manifest.featureCounts.roads}, buildings: ${manifest.featureCounts.buildings}, pois: ${manifest.featureCounts.pois}, water: ${manifest.featureCounts.waterPolygons}, waterways: ${manifest.featureCounts.waterways ?? 0}`);
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
