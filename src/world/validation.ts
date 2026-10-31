import type { Heightfield, Poi, WaterFeature, WorldData, WorldManifest, WorldRoad } from './types';
import { validateManifest } from './manifest';
import { validateRoad } from './roads';
import { polygonArea, validateBuilding } from './buildings';
import { chunkKey } from './chunks';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  scope: string;
  message: string;
}

export function validateHeightfield(hf: Heightfield): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(hf.cellSize) || hf.cellSize <= 0) issues.push({ severity: 'error', scope: 'terrain', message: 'invalid cell size' });
  if (!Number.isFinite(hf.originX) || !Number.isFinite(hf.originZ)) issues.push({ severity: 'error', scope: 'terrain', message: 'invalid origin' });
  if (hf.heights.length !== hf.width * hf.height) issues.push({ severity: 'error', scope: 'terrain', message: 'sample count mismatch' });
  let nonFinite = 0;
  for (let i = 0; i < hf.heights.length; i++) {
    if (!Number.isFinite(hf.heights[i])) nonFinite++;
  }
  if (nonFinite > 0) issues.push({ severity: 'error', scope: 'terrain', message: `${nonFinite} non-finite elevation samples` });
  if (!Number.isFinite(hf.minElevation) || !Number.isFinite(hf.maxElevation)) issues.push({ severity: 'error', scope: 'terrain', message: 'invalid elevation range' });
  if (hf.maxElevation - hf.minElevation > 3000) issues.push({ severity: 'warning', scope: 'terrain', message: 'extreme elevation range' });
  return issues;
}

export function validatePoi(poi: Poi): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!poi.id) issues.push({ severity: 'error', scope: 'poi', message: 'missing id' });
  if (!poi.name) issues.push({ severity: 'error', scope: 'poi', message: `poi ${poi.id} missing name` });
  if (!Number.isFinite(poi.pos[0]) || !Number.isFinite(poi.pos[1])) {
    issues.push({ severity: 'error', scope: 'poi', message: `poi ${poi.id} has non-finite position` });
  }
  return issues;
}

export function validateWater(feature: WaterFeature): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (feature.points.length < 3) issues.push({ severity: 'error', scope: 'water', message: `water ${feature.id} has fewer than 3 points` });
  if (polygonArea(feature.points) < 1) issues.push({ severity: 'warning', scope: 'water', message: `water ${feature.id} has a tiny area` });
  if (!Number.isFinite(feature.level)) issues.push({ severity: 'error', scope: 'water', message: `water ${feature.id} has invalid level` });
  return issues;
}

export function validateWorldData(world: WorldData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const error of validateManifest(world.manifest)) {
    issues.push({ severity: 'error', scope: 'manifest', message: error });
  }
  issues.push(...validateHeightfield(world.coarseTerrain));
  for (const road of world.roads) {
    for (const roadIssue of validateRoad(road)) {
      issues.push({ severity: 'error', scope: `road ${road.id}`, message: roadIssue.message });
    }
  }
  for (const poi of world.pois) issues.push(...validatePoi(poi));
  for (const water of world.water) issues.push(...validateWater(water));
  return issues;
}

export function validateChunkPayload(
  manifest: WorldManifest,
  chunkId: string,
  roads: WorldRoad[],
  buildings: { ring: [number, number][]; height: number }[],
  terrain: Heightfield,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ref = manifest.chunks.find((c) => c.id === chunkId);
  if (!ref) return [{ severity: 'error', scope: 'chunk', message: `unknown chunk ${chunkId}` }];
  const expected = chunkKey(ref.ix, ref.iz);
  if (chunkId !== expected) issues.push({ severity: 'error', scope: 'chunk', message: `chunk id mismatch: ${chunkId} vs ${expected}` });
  for (const road of roads) {
    for (const roadIssue of validateRoad(road)) {
      issues.push({ severity: 'error', scope: `chunk ${chunkId} road ${road.id}`, message: roadIssue.message });
    }
  }
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (b.ring.length < 3) issues.push({ severity: 'error', scope: `chunk ${chunkId} building ${i}`, message: 'invalid footprint' });
    if (!Number.isFinite(b.height) || b.height <= 0) issues.push({ severity: 'error', scope: `chunk ${chunkId} building ${i}`, message: 'invalid height' });
  }
  issues.push(...validateHeightfield(terrain));
  return issues;
}

export function validateBuildingMeta(meta: { height: number; area: number }, ring: [number, number][]): string[] {
  return validateBuilding(meta as never, ring);
}
