#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldTransform, utmForward, utmInverse } from '../src/world/transform.ts';
import { chunkBounds, chunkIndexFromGame, chunkKey } from '../src/world/chunks.ts';
import { createHeightfield, encodeHeightfield, heightAt, sampleChunkHeightfield } from '../src/world/terrain.ts';
import {
  classifyBuilding,
  encodeBuildings,
  heightForFloors,
  inferFloors,
  polygonArea,
  polygonCentroid,
  seededUnit,
} from '../src/world/buildings.ts';
import {
  WALKABLE_CLASSES,
  classifyRoad,
  clipPolylineToBounds,
  defaultRoadWidth,
  polylineLength,
  validateRoad,
} from '../src/world/roads.ts';
import { validateChunkPayload, validateWorldData } from '../src/world/validation.ts';
import { validateManifest, WORLD_FORMAT, WORLD_FORMAT_VERSION, WORLD_GENERATOR_VERSION } from '../src/world/manifest.ts';

const ROOT = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const CONFIG_PATH = join(ROOT, 'data/geodata/config/nlongkak.json');
const DISTRICTS_PATH = join(ROOT, 'data/geodata/config/districts.json');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeBuffer(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(value));
}

function tagSubset(tags) {
  const keep = [
    'name',
    'name:fr',
    'building',
    'building:levels',
    'height',
    'amenity',
    'shop',
    'tourism',
    'leisure',
    'historic',
    'place',
    'office',
    'healthcare',
    'surface',
    'lanes',
    'width',
    'oneway',
    'junction',
    'bridge',
    'tunnel',
    'foot',
    'access',
    'addr:street',
    'addr:housenumber',
    'religion',
    'denomination',
    'operator',
    'description',
  ];
  const out = {};
  for (const key of keep) {
    if (tags[key] !== undefined) out[key] = String(tags[key]);
  }
  return out;
}

function parseOplWayNodes(path) {
  const map = new Map();
  if (!existsSync(path)) return map;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    if (!line.startsWith('w')) continue;
    const idMatch = /^w(\d+)\s/.exec(line);
    if (!idMatch) continue;
    const nIndex = line.lastIndexOf(' N');
    if (nIndex < 0) continue;
    const refs = line
      .slice(nIndex + 2)
      .split(',')
      .map((ref) => Number(ref.slice(1)))
      .filter((ref) => Number.isFinite(ref));
    if (refs.length > 0) map.set(Number(idMatch[1]), refs);
  }
  return map;
}

function readDem(metaPath, dataPath) {
  const meta = readJson(metaPath);
  const buffer = readFileSync(dataPath);
  const values = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);
  return { meta, values };
}

function demElevation(dem, lon, lat) {
  const { meta, values } = dem;
  const fx = (lon - meta.lon0) / meta.pixelDegrees;
  const fy = (meta.lat0 - lat) / meta.pixelDegrees;
  const x = Math.max(0, Math.min(meta.width - 1, fx));
  const y = Math.max(0, Math.min(meta.height - 1, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(meta.width - 1, x0 + 1);
  const y1 = Math.min(meta.height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const v00 = values[y0 * meta.width + x0];
  const v10 = values[y0 * meta.width + x1];
  const v01 = values[y1 * meta.width + x0];
  const v11 = values[y1 * meta.width + x1];
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * ty;
}

function smooth(values, width, height, passes = 1) {
  let src = values;
  for (let pass = 0; pass < passes; pass++) {
    const out = new Float32Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let oy = -1; oy <= 1; oy++) {
          const yy = y + oy;
          if (yy < 0 || yy >= height) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = x + ox;
            if (xx < 0 || xx >= width) continue;
            sum += src[yy * width + xx];
            count++;
          }
        }
        out[y * width + x] = sum / Math.max(1, count);
      }
    }
    src = out;
  }
  return src;
}

function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;
  const sqTolerance = tolerance * tolerance;
  const getSqSegDist = (p, a, b) => {
    let x = a[0];
    let z = a[1];
    let dx = b[0] - x;
    let dz = b[1] - z;
    if (dx !== 0 || dz !== 0) {
      const t = ((p[0] - x) * dx + (p[1] - z) * dz) / (dx * dx + dz * dz);
      if (t > 1) {
        x = b[0];
        z = b[1];
      } else if (t > 0) {
        x += dx * t;
        z += dz * t;
      }
    }
    dx = p[0] - x;
    dz = p[1] - z;
    return dx * dx + dz * dz;
  };
  const simplifyStep = (first, last, out) => {
    let maxSqDist = sqTolerance;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const sqDist = getSqSegDist(points[i], points[first], points[last]);
      if (sqDist > maxSqDist) {
        index = i;
        maxSqDist = sqDist;
      }
    }
    if (index > 0) {
      if (index - first > 1) simplifyStep(first, index, out);
      out.push(points[index]);
      if (last - index > 1) simplifyStep(index, last, out);
    }
  };
  const out = [points[0]];
  simplifyStep(0, points.length - 1, out);
  out.push(points[points.length - 1]);
  return out;
}

function geometryRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((poly) => poly[0]);
  return [];
}

function geometryLines(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

function pointGeometry(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'Point') return geometry.coordinates;
  if (geometry.type === 'Polygon') return geometry.coordinates[0]?.[0] ?? null;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0]?.[0]?.[0] ?? null;
  return null;
}

function insideBounds(x, z, bounds, margin = 0) {
  return x >= bounds.minX - margin && x <= bounds.maxX + margin && z >= bounds.minZ - margin && z <= bounds.maxZ + margin;
}

function gamePoints(coords, transform) {
  return coords.map(([lon, lat]) => {
    const game = transform.gameFromLonLat({ lon, lat });
    return [game.x, game.z];
  });
}

function roadWidth(tags, roadClass) {
  const raw = tags.width;
  if (raw !== undefined) {
    const parsed = Number.parseFloat(String(raw).replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0.5 && parsed < 60) return { width: parsed, status: 'real' };
  }
  const lanes = Number.parseFloat(tags.lanes ?? '');
  if (Number.isFinite(lanes) && lanes > 0 && lanes < 12) {
    return { width: Math.max(2.5, lanes * 3.1 + 1.2), status: 'inferred' };
  }
  return defaultRoadWidth(roadClass);
}

function isOneway(tags, roadClass) {
  const value = String(tags.oneway ?? '').toLowerCase();
  if (value === 'yes' || value === 'true' || value === '1' || value === '-1') return true;
  return roadClass === 'roundabout' && value !== 'no';
}

function isWaterPolygon(tags) {
  return (
    tags.natural === 'water' ||
    tags.waterway === 'riverbank' ||
    tags.landuse === 'reservoir' ||
    (tags.water !== undefined && tags.water !== 'no')
  );
}

function isPoi(tags) {
  return Boolean(tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.historic || tags.place || tags.office || tags.healthcare);
}

function main() {
  const config = readJson(CONFIG_PATH);
  const bbox = config.bbox;
  const sources = config.sources;
  const osmSource = sources.find((source) => source.id === 'openstreetmap');
  const demSource = sources.find((source) => source.id === 'copernicus_dem_glo30');
  if (!osmSource || !demSource) throw new Error('Missing source configuration');

  const geojsonPath = join(ROOT, osmSource.exportFile);
  const oplPath = join(ROOT, osmSource.oplFile);
  const demMetaPath = join(ROOT, demSource.decodedMetaFile);
  const demDataPath = join(ROOT, demSource.decodedFile);
  for (const path of [geojsonPath, oplPath, demMetaPath, demDataPath]) {
    if (!existsSync(path)) throw new Error(`Missing input: ${path}`);
  }

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
  const originLonLat = utmInverse(minEast, minNorth);
  const origin = { lon: originLonLat.lon, lat: originLonLat.lat, east: minEast, north: minNorth };
  const transform = new WorldTransform(origin, 1);
  const width = maxEast - minEast;
  const depth = maxNorth - minNorth;
  const bounds = {
    minX: 0,
    maxX: width,
    minZ: -depth,
    maxZ: 0,
    minEast,
    maxEast,
    minNorth,
    maxNorth,
  };

  const chunkSize = config.chunkSize;
  const nx = Math.ceil(width / chunkSize);
  const nz = Math.ceil(depth / chunkSize);
  const chunkRefs = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const id = chunkKey(ix, iz);
      const cb = chunkBounds(ix, iz, origin, chunkSize);
      chunkRefs.push({
        id,
        ix,
        iz,
        bounds: cb,
        terrainFile: `terrain/${id}.bin`,
        roadsFile: `roads/${id}.json`,
        buildingsFile: `buildings/${id}.bin`,
        buildingsMetaFile: `buildings/${id}.json`,
        poisFile: `pois/${id}.json`,
        buildingCount: 0,
        roadCount: 0,
        hash: '',
      });
    }
  }
  const chunkById = new Map(chunkRefs.map((ref) => [ref.id, ref]));

  const dem = readDem(demMetaPath, demDataPath);
  const fineCell = config.terrainCellSize;
  const fineWidth = Math.round(width / fineCell) + 1;
  const fineHeight = Math.round(depth / fineCell) + 1;
  const rawFine = new Float32Array(fineWidth * fineHeight);
  for (let iz = 0; iz < fineHeight; iz++) {
    const z = bounds.minZ + iz * fineCell;
    for (let ix = 0; ix < fineWidth; ix++) {
      const x = bounds.minX + ix * fineCell;
      const projected = transform.projectedFromGame({ x, z });
      const lonLat = utmInverse(projected.east, projected.north);
      rawFine[iz * fineWidth + ix] = demElevation(dem, lonLat.lon, lonLat.lat);
    }
  }
  const smoothed = smooth(rawFine, fineWidth, fineHeight, 1);
  let absoluteMin = Infinity;
  let absoluteMax = -Infinity;
  for (const value of smoothed) {
    if (value < absoluteMin) absoluteMin = value;
    if (value > absoluteMax) absoluteMax = value;
  }
  const verticalOffset = Math.floor(absoluteMin * 10) / 10;
  const fineHeights = new Float32Array(smoothed.length);
  for (let i = 0; i < smoothed.length; i++) fineHeights[i] = Math.max(0, smoothed[i] - verticalOffset);
  const fineTerrain = createHeightfield(fineWidth, fineHeight, fineCell, bounds.minX, bounds.minZ, fineHeights);

  const coarseCell = config.coarseTerrainCellSize;
  const coarseWidth = Math.round(width / coarseCell) + 1;
  const coarseHeight = Math.round(depth / coarseCell) + 1;
  const coarseHeights = new Float32Array(coarseWidth * coarseHeight);
  for (let iz = 0; iz < coarseHeight; iz++) {
    const z = bounds.minZ + iz * coarseCell;
    for (let ix = 0; ix < coarseWidth; ix++) {
      const x = bounds.minX + ix * coarseCell;
      coarseHeights[iz * coarseWidth + ix] = heightAt(fineTerrain, x, z);
    }
  }
  const coarseTerrain = createHeightfield(coarseWidth, coarseHeight, coarseCell, bounds.minX, bounds.minZ, coarseHeights);

  const geojson = readJson(geojsonPath);
  const wayNodes = parseOplWayNodes(oplPath);
  const roads = [];
  const buildingsByChunk = new Map(chunkRefs.map((ref) => [ref.id, []]));
  const poisByChunk = new Map(chunkRefs.map((ref) => [ref.id, []]));
  const pois = [];
  const water = [];
  const buildingKeys = new Set();
  const seenPois = new Set();
  let skippedBuildings = 0;

  for (const feature of geojson.features ?? []) {
    const id = String(feature.id ?? '');
    const tags = feature.properties ?? {};
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (tags.highway) {
      const lines = geometryLines(geometry);
      const wayId = id.startsWith('w') ? Number(id.slice(1)) : null;
      const nodeRefs = wayId !== null ? wayNodes.get(wayId) : undefined;
      let pieceIndex = 0;
      for (const line of lines) {
        const gameLine = gamePoints(line, transform);
        const clipped = clipPolylineToBounds(gameLine, bounds);
        for (const piece of clipped) {
          if (piece.length < 2) continue;
          const roadClass = classifyRoad(tags);
          const widthInfo = roadWidth(tags, roadClass);
          const clippedNodeIds = nodeRefs
            ? piece.map(([x, z]) => {
                const originalIndex = gameLine.findIndex(([gx, gz]) => Math.abs(gx - x) < 0.01 && Math.abs(gz - z) < 0.01);
                return originalIndex >= 0 ? nodeRefs[originalIndex] : undefined;
              })
            : undefined;
          const hasAllNodeIds = clippedNodeIds?.every((value) => Number.isFinite(value));
          const road = {
            id: `osm-${id}${pieceIndex > 0 ? `-${pieceIndex}` : ''}`,
            sourceId: id,
            name: tags.name,
            roadClass,
            points: piece,
            ...(hasAllNodeIds ? { nodeIds: clippedNodeIds } : {}),
            width: widthInfo.width,
            widthStatus: widthInfo.status,
            oneway: isOneway(tags, roadClass),
            bridge: tags.bridge === 'yes' || tags.bridge === 'viaduct',
            tunnel: tags.tunnel === 'yes' || tags.tunnel === 'building_passage',
            surface: tags.surface,
            walkable: WALKABLE_CLASSES.has(roadClass) && tags.foot !== 'no' && tags.access !== 'private',
            provenance: {
              source: 'openstreetmap',
              sourceId: id,
              sourceVersion: osmSource.snapshotDate,
              license: osmSource.license,
              geometryStatus: 'real',
              heightStatus: 'inferred',
              architectureStatus: 'designed',
              gameplayStatus: 'designed',
            },
          };
          const issues = validateRoad(road);
          if (issues.length === 0) {
            roads.push(road);
            const mid = piece[Math.floor(piece.length / 2)];
            const chunk = chunkIndexFromGame(mid[0], mid[1], origin, chunkSize);
            const ref = chunkById.get(chunkKey(chunk.ix, chunk.iz));
            if (ref) {
              if (!ref._roads) ref._roads = [];
              ref._roads.push(road);
            }
          }
          pieceIndex++;
        }
      }
      continue;
    }

    if (tags.building) {
      const rings = geometryRings(geometry);
      for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
        const gameRing = gamePoints(rings[ringIndex], transform);
        if (gameRing.length > 1 && gameRing[0][0] === gameRing[gameRing.length - 1][0] && gameRing[0][1] === gameRing[gameRing.length - 1][1]) {
          gameRing.pop();
        }
        const simplified = simplifyRing(gameRing, config.simplifyTolerance);
        if (simplified.length < 3) {
          skippedBuildings++;
          continue;
        }
        const area = polygonArea(simplified);
        if (!Number.isFinite(area) || area < config.minBuildingArea) {
          skippedBuildings++;
          continue;
        }
        const [cx, cz] = polygonCentroid(simplified);
        if (!insideBounds(cx, cz, bounds, 40)) {
          skippedBuildings++;
          continue;
        }
        const dedupeKey = `${Math.round(cx)}:${Math.round(cz)}:${Math.round(area)}`;
        if (buildingKeys.has(dedupeKey)) {
          skippedBuildings++;
          continue;
        }
        buildingKeys.add(dedupeKey);
        const buildingId = `osm-${id}${ringIndex > 0 ? `-${ringIndex}` : ''}`;
        const floorsInfo = inferFloors(tags, area, buildingId);
        const explicitHeight = Number.parseFloat(tags.height ?? '');
        const height = Number.isFinite(explicitHeight) && explicitHeight > 0 ? Math.min(200, explicitHeight) : heightForFloors(floorsInfo.floors);
        const meta = {
          id: buildingId,
          source: 'openstreetmap',
          sourceId: id,
          name: tags.name,
          classification: classifyBuilding(tags),
          height,
          floors: floorsInfo.floors,
          area: Math.round(area * 10) / 10,
          confidence: 1,
          geometryStatus: 'real',
          heightStatus: Number.isFinite(explicitHeight) || tags['building:levels'] ? 'real' : 'inferred',
          architectureStatus: 'procedural',
          gameplayStatus: 'designed',
          tags: tagSubset(tags),
        };
        const chunk = chunkIndexFromGame(cx, cz, origin, chunkSize);
        const ref = chunkById.get(chunkKey(chunk.ix, chunk.iz));
        if (!ref) {
          skippedBuildings++;
          continue;
        }
        buildingsByChunk.get(ref.id).push({ meta, ring: simplified });
      }
      continue;
    }

    if (isWaterPolygon(tags) && geometry.type !== 'LineString' && geometry.type !== 'MultiLineString') {
      const rings = geometryRings(geometry);
      for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
        const gameRing = gamePoints(rings[ringIndex], transform);
        if (gameRing.length > 1 && gameRing[0][0] === gameRing[gameRing.length - 1][0] && gameRing[0][1] === gameRing[gameRing.length - 1][1]) {
          gameRing.pop();
        }
        const simplified = simplifyRing(gameRing, 0.8);
        if (simplified.length < 3) continue;
        const [cx, cz] = polygonCentroid(simplified);
        if (!insideBounds(cx, cz, bounds, 50)) continue;
        if (polygonArea(simplified) < 20) continue;
        let minLevel = Infinity;
        for (const [x, z] of simplified) minLevel = Math.min(minLevel, heightAt(fineTerrain, x, z));
        water.push({
          id: `osm-${id}${ringIndex > 0 ? `-${ringIndex}` : ''}`,
          name: tags.name,
          points: simplified,
          level: Math.max(0, minLevel - 0.15),
          provenance: {
            source: 'openstreetmap',
            sourceId: id,
            sourceVersion: osmSource.snapshotDate,
            license: osmSource.license,
            geometryStatus: 'real',
            heightStatus: 'inferred',
            architectureStatus: 'designed',
            gameplayStatus: 'designed',
          },
        });
      }
      continue;
    }

    if (isPoi(tags) && !tags.highway && !tags.building) {
      const point = pointGeometry(geometry);
      if (!point) continue;
      const game = transform.gameFromLonLat({ lon: point[0], lat: point[1] });
      if (!insideBounds(game.x, game.z, bounds)) continue;
      const kind = tags.amenity ?? tags.shop ?? tags.tourism ?? tags.leisure ?? tags.historic ?? tags.place ?? tags.office ?? tags.healthcare ?? 'poi';
      const name = tags.name ?? tags['name:fr'] ?? kind;
      if (!name) continue;
      const poiId = `osm-${id}`;
      if (seenPois.has(poiId)) continue;
      seenPois.add(poiId);
      const poi = {
        id: poiId,
        sourceId: id,
        name,
        nameFr: tags['name:fr'],
        kind,
        pos: [game.x, game.z],
        provenance: {
          source: 'openstreetmap',
          sourceId: id,
          sourceVersion: osmSource.snapshotDate,
          license: osmSource.license,
          geometryStatus: 'real',
          heightStatus: 'inferred',
          architectureStatus: 'designed',
          gameplayStatus: 'designed',
        },
      };
      pois.push(poi);
      const chunk = chunkIndexFromGame(game.x, game.z, origin, chunkSize);
      const ref = chunkById.get(chunkKey(chunk.ix, chunk.iz));
      if (ref) poisByChunk.get(ref.id).push(poi);
    }
  }

  const districtsConfig = readJson(DISTRICTS_PATH);
  const districts = districtsConfig.map((district) => {
    const game = transform.gameFromLonLat({ lon: district.lon, lat: district.lat });
    const boundary = district.boundary ? district.boundary.map(([lon, lat]) => {
      const p = transform.gameFromLonLat({ lon, lat });
      return [p.x, p.z];
    }) : undefined;
    return {
      ...district,
      gameX: game.x,
      gameZ: game.z,
      inWorld: insideBounds(game.x, game.z, bounds),
      ...(boundary ? { boundary } : {}),
    };
  });

  const outputDir = join(ROOT, config.outputDir);
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(join(outputDir, 'terrain'), { recursive: true });
  mkdirSync(join(outputDir, 'roads'), { recursive: true });
  mkdirSync(join(outputDir, 'buildings'), { recursive: true });
  mkdirSync(join(outputDir, 'pois'), { recursive: true });
  mkdirSync(join(outputDir, 'water'), { recursive: true });
  mkdirSync(join(outputDir, 'districts'), { recursive: true });
  mkdirSync(join(outputDir, 'metadata'), { recursive: true });

  writeBuffer(join(outputDir, 'terrain/heightfield.bin'), encodeHeightfield(coarseTerrain));
  writeJson(join(outputDir, 'roads/network.json'), roads);
  writeJson(join(outputDir, 'pois/pois.json'), pois);
  writeJson(join(outputDir, 'water/water.json'), water);
  writeJson(join(outputDir, 'districts/districts.json'), districts);

  const validationIssues = [];
  for (const ref of chunkRefs) {
    const chunkRoads = ref._roads ?? [];
    const chunkBuildings = buildingsByChunk.get(ref.id) ?? [];
    const cb = ref.bounds;
    const terrain = sampleChunkHeightfield(fineTerrain, cb, fineCell);
    const buildingBuffer = encodeBuildings(cb.minX, cb.minZ, chunkBuildings);
    const roadsJson = Buffer.from(`${JSON.stringify(chunkRoads, null, 2)}\n`);
    const buildingsMetaJson = Buffer.from(`${JSON.stringify(chunkBuildings.map((b) => b.meta), null, 2)}\n`);
    const poisJson = Buffer.from(`${JSON.stringify(poisByChunk.get(ref.id) ?? [], null, 2)}\n`);
    const terrainBuffer = Buffer.from(encodeHeightfield(terrain));
    const hash = sha256(Buffer.concat([Buffer.from(buildingBuffer), buildingsMetaJson, roadsJson, poisJson, terrainBuffer]));
    ref.hash = hash;
    ref.buildingCount = chunkBuildings.length;
    ref.roadCount = chunkRoads.length;
    writeBuffer(join(outputDir, ref.terrainFile), terrainBuffer);
    writeBuffer(join(outputDir, ref.buildingsFile), buildingBuffer);
    writeBuffer(join(outputDir, ref.buildingsMetaFile), buildingsMetaJson);
    writeBuffer(join(outputDir, ref.roadsFile), roadsJson);
    writeBuffer(join(outputDir, ref.poisFile), poisJson);
    validationIssues.push(...validateChunkPayload(
      { ...({ chunks: chunkRefs, origin, chunkSize } ) },
      ref.id,
      chunkRoads,
      chunkBuildings.map((b) => ({ ring: b.ring, height: b.meta.height })),
      terrain,
    ));
    delete ref._roads;
  }

  const manifest = {
    format: WORLD_FORMAT,
    formatVersion: WORLD_FORMAT_VERSION,
    worldVersion: config.worldVersion,
    generatorVersion: WORLD_GENERATOR_VERSION,
    generatedAt: new Date().toISOString(),
    area: {
      id: config.areaId,
      name: config.name,
      description: config.description,
    },
    projection: {
      id: 'EPSG:32632',
      name: 'WGS 84 / UTM zone 32N',
      zone: 32,
      hemisphere: 'N',
      datum: 'WGS84',
      centralMeridian: 9,
    },
    origin,
    unitsPerMetre: 1,
    verticalScale: 1,
    verticalOffset,
    elevationDatum: 'Copernicus DEM GLO-30 (EGM2008), local offset',
    terrainCellSize: fineCell,
    coarseTerrainCellSize: coarseCell,
    chunkSize,
    bounds,
    waterLevel: water.length > 0 ? Math.min(...water.map((w) => w.level)) : null,
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      url: source.url,
      license: source.license,
      attribution: source.attribution,
      snapshotDate: source.snapshotDate,
      usage: source.usage,
    })),
    featureCounts: {
      chunks: chunkRefs.length,
      roads: roads.length,
      buildings: chunkRefs.reduce((sum, ref) => sum + ref.buildingCount, 0),
      pois: pois.length,
      waterPolygons: water.length,
      terrainSamples: fineTerrain.heights.length,
    },
    chunks: chunkRefs,
    contentHash: '',
    validation: { ok: true, errors: [], warnings: [] },
  };

  const manifestErrors = validateManifest(manifest);
  const worldData = {
    manifest,
    roads,
    pois,
    water,
    districts,
    coarseTerrain,
  };
  const worldIssues = validateWorldData(worldData);
  validationIssues.push(...worldIssues);
  const errors = [...manifestErrors, ...validationIssues.filter((issue) => issue.severity === 'error').map((issue) => `${issue.scope}: ${issue.message}`)];
  const warnings = validationIssues.filter((issue) => issue.severity === 'warning').map((issue) => `${issue.scope}: ${issue.message}`);
  manifest.validation = { ok: errors.length === 0, errors, warnings };
  manifest.contentHash = sha256(
    Buffer.from(
      JSON.stringify({
        worldVersion: manifest.worldVersion,
        chunks: chunkRefs.map((ref) => ref.hash),
        roads: roads.length,
        buildings: manifest.featureCounts.buildings,
        pois: pois.length,
        water: water.length,
      }),
    ),
  );
  writeJson(join(outputDir, 'manifest.json'), manifest);
  const precache = [
    'manifest.json',
    'licenses.json',
    'terrain/heightfield.bin',
    'roads/network.json',
    'pois/pois.json',
    'water/water.json',
    'districts/districts.json',
    ...chunkRefs.flatMap((ref) => [ref.terrainFile, ref.roadsFile, ref.buildingsFile, ref.buildingsMetaFile, ref.poisFile]),
  ];
  const outputPrefix = config.outputDir.replace(/^public\//, '').replace(/\/$/, '');
  writeJson(join(outputDir, 'precache.json'), [...new Set(precache)].map((path) => `${outputPrefix}/${path}`));

  writeJson(join(outputDir, 'licenses.json'), {
    worldVersion: manifest.worldVersion,
    generatedAt: manifest.generatedAt,
    sources: manifest.sources,
    obligations: [
      'OpenStreetMap data is (c) OpenStreetMap contributors and licensed under ODbL 1.0. Attribution and share-alike obligations apply to derived data.',
      'Copernicus DEM GLO-30 is (c) ESA and is used under the Copernicus DEM licence. Attribution is required.',
      'Google Open Buildings V3 was not used for this slice; its licence obligations do not apply to this package.',
    ],
  });
  writeJson(join(outputDir, 'metadata/validation.json'), {
    ok: errors.length === 0,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
  });
  writeJson(join(outputDir, 'metadata/build-report.json'), {
    worldVersion: manifest.worldVersion,
    area: manifest.area,
    bbox,
    origin,
    bounds,
    chunkSize,
    chunks: chunkRefs.length,
    roads: roads.length,
    buildings: manifest.featureCounts.buildings,
    pois: pois.length,
    waterPolygons: water.length,
    skippedBuildings,
    elevation: {
      absoluteMin,
      absoluteMax,
      verticalOffset,
      relativeMin: 0,
      relativeMax: absoluteMax - verticalOffset,
    },
    sourceFiles: sources.map((source) => ({ id: source.id, rawFile: source.rawFile, snapshotDate: source.snapshotDate })),
  });

  console.log(`world built: ${config.outputDir}`);
  console.log(`  chunks: ${chunkRefs.length}`);
  console.log(`  roads: ${roads.length}`);
  console.log(`  buildings: ${manifest.featureCounts.buildings} (${skippedBuildings} skipped)`);
  console.log(`  pois: ${pois.length}`);
  console.log(`  water polygons: ${water.length}`);
  console.log(`  elevation: ${absoluteMin.toFixed(1)}..${absoluteMax.toFixed(1)} m (offset ${verticalOffset.toFixed(1)} m)`);
  console.log(`  validation: ${errors.length === 0 ? 'PASS' : 'FAIL'}`);
  if (errors.length > 0) {
    for (const error of errors.slice(0, 20)) console.error(`  ERROR ${error}`);
    process.exitCode = 1;
  }
}

main();
