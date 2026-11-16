import type { BuildingGeometry, WorldBounds } from './types';
import type { GamePoint, LonLat } from './transform';
import {
  hashString,
  heightForFloors,
  inferFloors,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
} from './buildings';

/**
 * Optional build-time contract for Google Open Buildings V3.
 *
 * This module is deliberately not imported by the runtime renderer. It exists
 * so an explicitly licensed export can be validated, filtered, projected and
 * deduplicated against OpenStreetMap without silently changing the current
 * pack. Production footprints must come from a real, pinned export; the test
 * fixtures are synthetic.
 */
export const OPEN_BUILDINGS_SOURCE_ID = 'google_open_buildings_v3';
export const OPEN_BUILDINGS_DEFAULT_MIN_CONFIDENCE = 0.75;
export const OPEN_BUILDINGS_ACCEPTED_LICENSES = ['CC-BY-4.0', 'ODbL-1.0'] as const;

export type OpenBuildingsLicense = (typeof OPEN_BUILDINGS_ACCEPTED_LICENSES)[number];

export interface OpenBuildingsSourceConfig {
  id: typeof OPEN_BUILDINGS_SOURCE_ID;
  name: string;
  url: string;
  license: OpenBuildingsLicense;
  attribution: string;
  snapshotDate: string;
  exportFile: string;
  minConfidence: number;
  usage: string;
}

export interface LonLatRing extends Array<[number, number]> {}

export interface ParsedOpenBuildingsPart {
  /** Deterministic source ID derived from the row and footprint geometry. */
  sourceId: string;
  /** Open ring in WGS84 lon/lat order. The duplicate closing vertex is removed. */
  ring: LonLatRing;
}

export interface ParsedOpenBuildingsRow {
  rowNumber: number;
  latitude: number;
  longitude: number;
  areaInMeters: number;
  confidence: number;
  fullPlusCode?: string;
  parts: ParsedOpenBuildingsPart[];
}

export type OpenBuildingsIssueReason =
  | 'malformed-row'
  | 'invalid-coordinate'
  | 'invalid-area'
  | 'invalid-confidence'
  | 'invalid-geometry'
  | 'unsupported-geometry'
  | 'low-confidence'
  | 'outside-bounds'
  | 'below-minimum-area'
  | 'overlaps-osm'
  | 'duplicate';

export interface OpenBuildingsIssue {
  rowNumber: number;
  sourceId?: string;
  reason: OpenBuildingsIssueReason;
  detail: string;
}

export interface OpenBuildingsCsvResult {
  rows: ParsedOpenBuildingsRow[];
  issues: OpenBuildingsIssue[];
}

export interface ImportedOpenBuilding {
  id: string;
  sourceId: string;
  ring: [number, number][];
  area: number;
  confidence: number;
  fullPlusCode?: string;
  source: typeof OPEN_BUILDINGS_SOURCE_ID;
  sourceVersion: string;
  license: OpenBuildingsLicense;
  attribution: string;
  rowNumber: number;
}

export interface OpenBuildingsImportStats {
  rows: number;
  parsedRows: number;
  malformedRows: number;
  candidates: number;
  accepted: number;
  lowConfidence: number;
  outsideBounds: number;
  belowMinimumArea: number;
  osmOverlaps: number;
  duplicates: number;
  invalidGeometry: number;
}

export interface OpenBuildingsImportResult {
  candidates: ImportedOpenBuilding[];
  issues: OpenBuildingsIssue[];
  stats: OpenBuildingsImportStats;
}

export interface OpenBuildingsProjector {
  gameFromLonLat(point: LonLat): GamePoint;
}

export interface OsmFootprintForDedupe {
  id: string;
  ring: [number, number][];
}

export interface ImportOpenBuildingsOptions {
  source: OpenBuildingsSourceConfig;
  /** Raw CSV text from the licensed export. */
  csv: string;
  bounds: Pick<WorldBounds, 'minX' | 'maxX' | 'minZ' | 'maxZ'>;
  transform: OpenBuildingsProjector;
  osmBuildings: readonly OsmFootprintForDedupe[];
  /** Minimum projected footprint area in square metres. */
  minArea: number;
  /** Allow a centroid slightly outside the playable bounds, as OSM does. */
  margin?: number;
}

type CsvRow = string[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function safeRelativeCsvPath(value: string): boolean {
  if (!value.endsWith('.csv')) return false;
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/.test(value)) return false;
  const segments = value.split(/[\\/]+/);
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export function validateOpenBuildingsSourceConfig(value: unknown): string[] {
  if (!isRecord(value)) return ['openBuildings must be an object'];
  const errors: string[] = [];
  if (value.id !== OPEN_BUILDINGS_SOURCE_ID) {
    errors.push(`openBuildings.id must be ${OPEN_BUILDINGS_SOURCE_ID}`);
  }

  for (const key of ['name', 'url', 'license', 'attribution', 'snapshotDate', 'exportFile'] as const) {
    if (requiredString(value[key]) === null) errors.push(`openBuildings.${key} must be a non-empty string`);
  }

  if (typeof value.license === 'string' && !OPEN_BUILDINGS_ACCEPTED_LICENSES.includes(value.license as OpenBuildingsLicense)) {
    errors.push(`openBuildings.license must be one of ${OPEN_BUILDINGS_ACCEPTED_LICENSES.join(', ')}`);
  }

  if (typeof value.url === 'string' && !/^https:\/\/\S+$/i.test(value.url.trim())) {
    errors.push('openBuildings.url must be an https URL');
  }

  if (typeof value.snapshotDate === 'string' && !validDate(value.snapshotDate.trim())) {
    errors.push('openBuildings.snapshotDate must be a real YYYY-MM-DD date');
  }

  if (typeof value.exportFile === 'string' && !safeRelativeCsvPath(value.exportFile.trim())) {
    errors.push('openBuildings.exportFile must be a relative .csv path without parent traversal');
  }

  if (value.minConfidence !== undefined) {
    if (typeof value.minConfidence !== 'number' || !Number.isFinite(value.minConfidence)) {
      errors.push('openBuildings.minConfidence must be a finite number');
    } else if (value.minConfidence < 0.65 || value.minConfidence > 1) {
      errors.push('openBuildings.minConfidence must be between 0.65 and 1');
    }
  }

  if (typeof value.attribution === 'string' && !/open\s*buildings/i.test(value.attribution)) {
    errors.push('openBuildings.attribution must name Google Open Buildings');
  }

  return errors;
}

export function parseOpenBuildingsSourceConfig(value: unknown): OpenBuildingsSourceConfig {
  const errors = validateOpenBuildingsSourceConfig(value);
  if (errors.length > 0) throw new Error(`Invalid Open Buildings source config: ${errors.join('; ')}`);
  const record = value as Record<string, unknown>;
  return {
    id: OPEN_BUILDINGS_SOURCE_ID,
    name: String(record.name).trim(),
    url: String(record.url).trim(),
    license: String(record.license).trim() as OpenBuildingsLicense,
    attribution: String(record.attribution).trim(),
    snapshotDate: String(record.snapshotDate).trim(),
    exportFile: String(record.exportFile).trim(),
    minConfidence:
      record.minConfidence === undefined
        ? OPEN_BUILDINGS_DEFAULT_MIN_CONFIDENCE
        : (record.minConfidence as number),
    usage:
      requiredString(record.usage) ??
      'Optional building footprints, confidence-filtered and deduplicated against OpenStreetMap.',
  };
}

/**
 * Returns a validated source config only when the world config explicitly sets
 * `openBuildings.enabled` to true. Missing or disabled configuration is a no-op.
 */
export function enabledOpenBuildingsSourceConfig(worldConfig: unknown): OpenBuildingsSourceConfig | null {
  if (!isRecord(worldConfig) || worldConfig.openBuildings === undefined) return null;
  if (!isRecord(worldConfig.openBuildings)) throw new Error('Invalid Open Buildings config: openBuildings must be an object');
  if (worldConfig.openBuildings.enabled === undefined || worldConfig.openBuildings.enabled === false) return null;
  if (worldConfig.openBuildings.enabled !== true) {
    throw new Error('Invalid Open Buildings config: openBuildings.enabled must be a boolean');
  }
  return parseOpenBuildingsSourceConfig(worldConfig.openBuildings);
}

function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = [];
  let row: CsvRow = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (field.length > 0) throw new Error('Invalid CSV: unexpected quote inside an unquoted field');
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (inQuotes) throw new Error('Invalid CSV: unterminated quoted field');
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim().length > 0));
}

function unwrapParentheses(input: string): string {
  const text = input.trim();
  if (!text.startsWith('(') || !text.endsWith(')')) throw new Error('expected a parenthesised WKT group');
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) throw new Error('unbalanced WKT parentheses');
      if (depth === 0 && i !== text.length - 1) throw new Error('unexpected text after WKT group');
    }
  }
  if (depth !== 0) throw new Error('unbalanced WKT parentheses');
  return text.slice(1, -1);
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth < 0) throw new Error('unbalanced WKT parentheses');
    } else if (ch === ',' && depth === 0) {
      const part = input.slice(start, i).trim();
      if (part.length === 0) throw new Error('empty WKT group');
      parts.push(part);
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error('unbalanced WKT parentheses');
  const last = input.slice(start).trim();
  if (last.length === 0) throw new Error('empty WKT group');
  parts.push(last);
  return parts;
}

function parseRing(group: string): LonLatRing {
  const inner = unwrapParentheses(group);
  const positions = splitTopLevel(inner).map((position) => {
    const values = position.trim().split(/\s+/);
    if (values.length !== 2) throw new Error('WKT positions must contain two coordinates');
    const lon = Number(values[0]);
    const lat = Number(values[1]);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error('WKT position is not finite');
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) throw new Error('WKT position is outside lon/lat bounds');
    return [lon, lat] as [number, number];
  });

  if (positions.length < 4) throw new Error('WKT ring has fewer than four positions');
  const first = positions[0];
  const last = positions[positions.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-9 || Math.abs(first[1] - last[1]) > 1e-9) {
    throw new Error('WKT ring is not closed');
  }
  positions.pop();

  const unique = new Set(positions.map(([lon, lat]) => `${lon.toFixed(9)},${lat.toFixed(9)}`));
  if (positions.length < 3 || unique.size < 3) throw new Error('WKT ring has fewer than three distinct positions');

  const ring: LonLatRing = [];
  for (const position of positions) {
    const previous = ring[ring.length - 1];
    if (previous && previous[0] === position[0] && previous[1] === position[1]) continue;
    ring.push(position);
  }
  if (ring.length >= 2) {
    const firstPoint = ring[0];
    const lastPoint = ring[ring.length - 1];
    if (firstPoint[0] === lastPoint[0] && firstPoint[1] === lastPoint[1]) ring.pop();
  }
  if (ring.length < 3) throw new Error('WKT ring collapses to fewer than three positions');
  return ring;
}

function parseWktRings(value: string): LonLatRing[] {
  const text = value.trim();
  const match = /^(POLYGON|MULTIPOLYGON)\s*(Z|M|ZM)?\s*(\(.*\))$/is.exec(text);
  if (!match) {
    if (/^(POINT|LINESTRING|MULTILINESTRING|GEOMETRYCOLLECTION)\b/i.test(text)) {
      throw new Error('only POLYGON and MULTIPOLYGON WKT are supported');
    }
    throw new Error('unrecognised WKT geometry');
  }
  if (match[2]) throw new Error('three-dimensional WKT is not supported');

  const type = match[1].toUpperCase();
  if (type === 'POLYGON') {
    const rings = splitTopLevel(unwrapParentheses(match[3]));
    if (rings.length !== 1) throw new Error('polygon holes are not supported');
    return [parseRing(rings[0])];
  }

  const polygons = splitTopLevel(unwrapParentheses(match[3]));
  const result: LonLatRing[] = [];
  for (const polygon of polygons) {
    const rings = splitTopLevel(unwrapParentheses(polygon));
    if (rings.length !== 1) throw new Error('polygon holes are not supported');
    result.push(parseRing(rings[0]));
  }
  if (result.length === 0) throw new Error('MULTIPOLYGON contains no polygons');
  return result;
}

function canonicalRing(ring: LonLatRing): string {
  return ring.map(([lon, lat]) => `${lon.toFixed(8)},${lat.toFixed(8)}`).join(';');
}

function sourceIdFor(
  latitude: number,
  longitude: number,
  area: number,
  confidence: number,
  plusCode: string | undefined,
  ring: LonLatRing,
  partIndex: number,
  partCount: number,
): string {
  const seed = [
    plusCode ?? '',
    latitude.toFixed(8),
    longitude.toFixed(8),
    area.toFixed(3),
    confidence.toFixed(4),
    String(partIndex),
    canonicalRing(ring),
  ].join('|');
  const prefix = plusCode ? plusCode.replace(/[^A-Za-z0-9+]/g, '').slice(0, 24) : 'noplus';
  const hash = hashString(seed).toString(16).padStart(8, '0');
  return `v3-${prefix || 'noplus'}-${hash}${partCount > 1 ? `-${partIndex}` : ''}`;
}

function finiteNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseOpenBuildingsCsv(csv: string): OpenBuildingsCsvResult {
  const table = parseCsv(csv);
  if (table.length === 0) throw new Error('Open Buildings CSV is empty');
  const header = table[0].map((name, index) => (index === 0 ? name.replace(/^\uFEFF/, '') : name).trim().toLowerCase());
  const required = ['latitude', 'longitude', 'area_in_meters', 'confidence', 'geometry'];
  const missing = required.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    throw new Error(`Open Buildings CSV missing required column(s): ${missing.join(', ')}`);
  }
  const indexOf = (name: string) => header.indexOf(name);
  const latitudeIndex = indexOf('latitude');
  const longitudeIndex = indexOf('longitude');
  const areaIndex = indexOf('area_in_meters');
  const confidenceIndex = indexOf('confidence');
  const geometryIndex = indexOf('geometry');
  const plusCodeIndex = indexOf('full_plus_code');

  const rows: ParsedOpenBuildingsRow[] = [];
  const issues: OpenBuildingsIssue[] = [];

  for (let rowIndex = 1; rowIndex < table.length; rowIndex++) {
    const row = table[rowIndex];
    const rowNumber = rowIndex + 1;
    if (row.length !== header.length) {
      issues.push({
        rowNumber,
        reason: 'malformed-row',
        detail: `expected ${header.length} fields, received ${row.length}`,
      });
      continue;
    }

    const latitude = finiteNumber(row[latitudeIndex]);
    const longitude = finiteNumber(row[longitudeIndex]);
    const areaInMeters = finiteNumber(row[areaIndex]);
    const confidence = finiteNumber(row[confidenceIndex]);
    const geometryText = row[geometryIndex]?.trim() ?? '';
    const plusCode = plusCodeIndex >= 0 ? row[plusCodeIndex]?.trim() || undefined : undefined;

    if (latitude === null || latitude < -90 || latitude > 90) {
      issues.push({ rowNumber, reason: 'invalid-coordinate', detail: 'latitude is missing, non-finite or outside [-90, 90]' });
      continue;
    }
    if (longitude === null || longitude < -180 || longitude > 180) {
      issues.push({ rowNumber, reason: 'invalid-coordinate', detail: 'longitude is missing, non-finite or outside [-180, 180]' });
      continue;
    }
    if (areaInMeters === null || areaInMeters <= 0) {
      issues.push({ rowNumber, reason: 'invalid-area', detail: 'area_in_meters must be a positive finite number' });
      continue;
    }
    if (confidence === null || confidence < 0 || confidence > 1) {
      issues.push({ rowNumber, reason: 'invalid-confidence', detail: 'confidence must be between 0 and 1' });
      continue;
    }
    if (!geometryText) {
      issues.push({ rowNumber, reason: 'invalid-geometry', detail: 'geometry is empty' });
      continue;
    }

    let rings: LonLatRing[];
    try {
      rings = parseWktRings(geometryText);
    } catch (error) {
      issues.push({
        rowNumber,
        reason: /only POLYGON|three-dimensional|holes/.test(String(error)) ? 'unsupported-geometry' : 'invalid-geometry',
        detail: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const parts = rings.map((ring, partIndex) => ({
      sourceId: sourceIdFor(latitude, longitude, areaInMeters, confidence, plusCode, ring, partIndex, rings.length),
      ring,
    }));
    rows.push({
      rowNumber,
      latitude,
      longitude,
      areaInMeters,
      confidence,
      ...(plusCode ? { fullPlusCode: plusCode } : {}),
      parts,
    });
  }

  return { rows, issues };
}

interface RingBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface IndexedFootprint extends OsmFootprintForDedupe {
  bounds: RingBounds;
}

function ringBounds(ring: readonly [number, number][]): RingBounds {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minX, maxX, minZ, maxZ };
}

function boundsOverlap(a: RingBounds, b: RingBounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

function orientation(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
  const value = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : -1;
}

function onSegment(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): boolean {
  return (
    Math.min(ax, bx) - 1e-9 <= cx &&
    cx <= Math.max(ax, bx) + 1e-9 &&
    Math.min(az, bz) - 1e-9 <= cz &&
    cz <= Math.max(az, bz) + 1e-9
  );
}

function segmentsIntersect(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number,
): boolean {
  const o1 = orientation(ax, az, bx, bz, cx, cz);
  const o2 = orientation(ax, az, bx, bz, dx, dz);
  const o3 = orientation(cx, cz, dx, dz, ax, az);
  const o4 = orientation(cx, cz, dx, dz, bx, bz);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, az, bx, bz, cx, cz)) return true;
  if (o2 === 0 && onSegment(ax, az, bx, bz, dx, dz)) return true;
  if (o3 === 0 && onSegment(cx, cz, dx, dz, ax, az)) return true;
  if (o4 === 0 && onSegment(cx, cz, dx, dz, bx, bz)) return true;
  return false;
}

/**
 * Conservative footprint overlap used only for deduplication. Touching edges
 * count as an overlap so a machine-generated detection cannot be added on top
 * of an existing OSM building.
 */
export function footprintsOverlap(a: readonly [number, number][], b: readonly [number, number][]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const aBounds = ringBounds(a);
  const bBounds = ringBounds(b);
  if (!boundsOverlap(aBounds, bBounds)) return false;

  const aCentroid = polygonCentroid(a as [number, number][]);
  const bCentroid = polygonCentroid(b as [number, number][]);
  if (pointInPolygon(aCentroid[0], aCentroid[1], b as [number, number][])) return true;
  if (pointInPolygon(bCentroid[0], bCentroid[1], a as [number, number][])) return true;

  for (const [x, z] of a) {
    if (pointInPolygon(x, z, b as [number, number][])) return true;
  }
  for (const [x, z] of b) {
    if (pointInPolygon(x, z, a as [number, number][])) return true;
  }

  for (let i = 0; i < a.length; i++) {
    const [ax, az] = a[i];
    const [bx, bz] = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const [cx, cz] = b[j];
      const [dx, dz] = b[(j + 1) % b.length];
      if (segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz)) return true;
    }
  }
  return false;
}

export function importOpenBuildings(options: ImportOpenBuildingsOptions): OpenBuildingsImportResult {
  const { source, bounds, transform, osmBuildings, minArea } = options;
  const sourceIssues = validateOpenBuildingsSourceConfig(source);
  if (sourceIssues.length > 0) throw new Error(`Invalid Open Buildings source config: ${sourceIssues.join('; ')}`);
  if (!Number.isFinite(minArea) || minArea <= 0) throw new Error('Open Buildings minArea must be positive');
  if (!Number.isFinite(source.minConfidence) || source.minConfidence < 0.65 || source.minConfidence > 1) {
    throw new Error('Open Buildings minConfidence must be between 0.65 and 1');
  }
  const margin = options.margin ?? 40;

  const parsed = parseOpenBuildingsCsv(options.csv);
  const issues: OpenBuildingsIssue[] = [...parsed.issues];
  const candidates: ImportedOpenBuilding[] = [];
  const acceptedBounds: RingBounds[] = [];
  const acceptedIds = new Set<string>();
  const osmIndex: IndexedFootprint[] = osmBuildings.map((building) => ({
    ...building,
    bounds: ringBounds(building.ring),
  }));

  const malformedRows = new Set(parsed.issues.map((issue) => issue.rowNumber)).size;
  const stats: OpenBuildingsImportStats = {
    rows: parsed.rows.length + malformedRows,
    parsedRows: parsed.rows.length,
    malformedRows,
    candidates: 0,
    accepted: 0,
    lowConfidence: 0,
    outsideBounds: 0,
    belowMinimumArea: 0,
    osmOverlaps: 0,
    duplicates: 0,
    invalidGeometry: 0,
  };

  for (const row of parsed.rows) {
    if (row.confidence < source.minConfidence) {
      stats.lowConfidence++;
      issues.push({
        rowNumber: row.rowNumber,
        reason: 'low-confidence',
        detail: `confidence ${row.confidence.toFixed(4)} is below ${source.minConfidence.toFixed(4)}`,
      });
      continue;
    }

    for (const part of row.parts) {
      stats.candidates++;
      const ring: [number, number][] = [];
      let projectionFailed = false;
      for (const [lon, lat] of part.ring) {
        const game = transform.gameFromLonLat({ lon, lat });
        if (!Number.isFinite(game.x) || !Number.isFinite(game.z)) {
          projectionFailed = true;
          break;
        }
        ring.push([game.x, game.z]);
      }
      if (projectionFailed) {
        stats.invalidGeometry++;
        issues.push({
          rowNumber: row.rowNumber,
          sourceId: part.sourceId,
          reason: 'invalid-geometry',
          detail: 'projected footprint has a non-finite vertex',
        });
        continue;
      }

      const area = polygonArea(ring);
      if (!Number.isFinite(area) || area <= 0) {
        stats.invalidGeometry++;
        issues.push({
          rowNumber: row.rowNumber,
          sourceId: part.sourceId,
          reason: 'invalid-geometry',
          detail: 'projected footprint has no area',
        });
        continue;
      }

      if (area < minArea) {
        stats.belowMinimumArea++;
        issues.push({
          rowNumber: row.rowNumber,
          sourceId: part.sourceId,
          reason: 'below-minimum-area',
          detail: `projected area ${area.toFixed(1)} m² is below ${minArea} m²`,
        });
        continue;
      }

      const [cx, cz] = polygonCentroid(ring);
      if (
        cx < bounds.minX - margin ||
        cx > bounds.maxX + margin ||
        cz < bounds.minZ - margin ||
        cz > bounds.maxZ + margin
      ) {
        stats.outsideBounds++;
        issues.push({
          rowNumber: row.rowNumber,
          sourceId: part.sourceId,
          reason: 'outside-bounds',
          detail: 'footprint centroid is outside the world bounds',
        });
        continue;
      }

      if (acceptedIds.has(part.sourceId)) {
        stats.duplicates++;
        issues.push({
          rowNumber: row.rowNumber,
          sourceId: part.sourceId,
          reason: 'duplicate',
          detail: 'duplicate Open Buildings source ID',
        });
        continue;
      }

      const candidateBounds = ringBounds(ring);
      const osmConflict = osmIndex.find((building) => boundsOverlap(candidateBounds, building.bounds) && footprintsOverlap(ring, building.ring));
      if (osmConflict) {
        stats.osmOverlaps++;
        issues.push({
          rowNumber: row.rowNumber,
          sourceId: part.sourceId,
          reason: 'overlaps-osm',
          detail: `overlaps OSM building ${osmConflict.id}; OSM geometry retained`,
        });
        continue;
      }

      const duplicateCandidate = candidates.some((existing, index) => {
        if (!boundsOverlap(candidateBounds, acceptedBounds[index])) return false;
        return footprintsOverlap(ring, existing.ring);
      });
      if (duplicateCandidate) {
        stats.duplicates++;
        issues.push({
          rowNumber: row.rowNumber,
          sourceId: part.sourceId,
          reason: 'duplicate',
          detail: 'overlaps another accepted Open Buildings footprint',
        });
        continue;
      }

      acceptedIds.add(part.sourceId);
      acceptedBounds.push(candidateBounds);
      candidates.push({
        id: `gob-${part.sourceId}`,
        sourceId: part.sourceId,
        ring,
        area,
        confidence: row.confidence,
        ...(row.fullPlusCode ? { fullPlusCode: row.fullPlusCode } : {}),
        source: OPEN_BUILDINGS_SOURCE_ID,
        sourceVersion: source.snapshotDate,
        license: source.license,
        attribution: source.attribution,
        rowNumber: row.rowNumber,
      });
    }
  }

  stats.accepted = candidates.length;
  return { candidates, issues, stats };
}

/**
 * Convert an accepted source candidate into the pack's building contract.
 * The caller may pass a simplified ring; area and inferred floors are derived
 * from that ring so metadata stays consistent with the encoded geometry.
 */
export function openBuildingToGeometry(
  candidate: ImportedOpenBuilding,
  ring: [number, number][] = candidate.ring,
): BuildingGeometry {
  const area = polygonArea(ring);
  const floors = inferFloors(undefined, area, candidate.id);
  return {
    ring,
    meta: {
      id: candidate.id,
      source: OPEN_BUILDINGS_SOURCE_ID,
      sourceId: candidate.sourceId,
      classification: 'unknown',
      height: heightForFloors(floors.floors),
      floors: floors.floors,
      area: Math.round(area * 10) / 10,
      confidence: candidate.confidence,
      geometryStatus: 'inferred',
      heightStatus: 'inferred',
      architectureStatus: 'procedural',
      gameplayStatus: 'designed',
    },
  };
}
