#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { utmForward } from '../src/world/transform.ts';
import { chunkKey } from '../src/world/chunks.ts';

const ROOT = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const config = JSON.parse(readFileSync(join(ROOT, 'data/geodata/config/nlongkak.json'), 'utf8'));

function countFeatures(path) {
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const counts = { features: 0, roads: 0, buildings: 0, water: 0, pois: 0, lines: 0, polygons: 0, points: 0 };
  for (const feature of data.features ?? []) {
    counts.features++;
    const tags = feature.properties ?? {};
    const type = feature.geometry?.type;
    if (type === 'LineString' || type === 'MultiLineString') counts.lines++;
    if (type === 'Polygon' || type === 'MultiPolygon') counts.polygons++;
    if (type === 'Point') counts.points++;
    if (tags.highway && type !== 'Point') counts.roads++;
    if (tags.building) counts.buildings++;
    if (tags.natural === 'water' || tags.waterway === 'riverbank' || tags.landuse === 'reservoir') counts.water++;
    if (tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.historic || tags.place) counts.pois++;
  }
  return counts;
}

const bbox = config.bbox;
const corners = [
  [bbox.minLon, bbox.minLat],
  [bbox.minLon, bbox.maxLat],
  [bbox.maxLon, bbox.minLat],
  [bbox.maxLon, bbox.maxLat],
].map(([lon, lat]) => utmForward(lon, lat));
const minEast = Math.min(...corners.map((c) => c.east));
const maxEast = Math.max(...corners.map((c) => c.east));
const minNorth = Math.min(...corners.map((c) => c.north));
const maxNorth = Math.max(...corners.map((c) => c.north));
const width = maxEast - minEast;
const depth = maxNorth - minNorth;
const nx = Math.ceil(width / config.chunkSize);
const nz = Math.ceil(depth / config.chunkSize);

const osm = config.sources.find((source) => source.id === 'openstreetmap');
const dem = config.sources.find((source) => source.id === 'copernicus_dem_glo30');
console.log(`area: ${config.name} (${config.areaId})`);
console.log(`bbox: ${bbox.minLon},${bbox.minLat} .. ${bbox.maxLon},${bbox.maxLat}`);
console.log(`projected: EPSG:32632 east ${minEast.toFixed(1)}..${maxEast.toFixed(1)}, north ${minNorth.toFixed(1)}..${maxNorth.toFixed(1)}`);
console.log(`size: ${width.toFixed(1)} m x ${depth.toFixed(1)} m`);
console.log(`chunks: ${nx} x ${nz} = ${nx * nz} (${config.chunkSize} m)`);
console.log(`first chunk: ${chunkKey(0, 0)}`);

for (const source of config.sources) {
  const path = join(ROOT, source.exportFile ?? source.decodedFile ?? source.rawFile);
  console.log(`source ${source.id}: ${existsSync(path) ? 'present' : 'missing'} (${path.slice(ROOT.length + 1)})`);
}
const geojsonPath = join(ROOT, osm.exportFile);
if (existsSync(geojsonPath)) {
  const counts = countFeatures(geojsonPath);
  console.log(`OSM extract: ${JSON.stringify(counts)}`);
}
const demMetaPath = join(ROOT, dem.decodedMetaFile);
if (existsSync(demMetaPath)) {
  const meta = JSON.parse(readFileSync(demMetaPath, 'utf8'));
  console.log(`DEM window: ${meta.width}x${meta.height}, ${meta.minElevation.toFixed(1)}..${meta.maxElevation.toFixed(1)} m, pixel ${meta.pixelDegrees.toFixed(8)} deg`);
}
console.log('not used:', config.notUsed?.map((item) => item.id).join(', ') || 'none');
