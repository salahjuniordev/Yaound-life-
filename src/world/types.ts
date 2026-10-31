export type DataStatus = 'real' | 'inferred' | 'designed' | 'procedural';

export interface Provenance {
  source: string;
  sourceId?: string;
  sourceVersion: string;
  license: string;
  geometryStatus: DataStatus;
  heightStatus?: DataStatus;
  architectureStatus?: DataStatus;
  gameplayStatus?: DataStatus;
}

export interface ProjectionInfo {
  id: 'EPSG:32632';
  name: string;
  zone: 32;
  hemisphere: 'N';
  datum: 'WGS84';
  centralMeridian: number;
}

export interface WorldOrigin {
  lon: number;
  lat: number;
  east: number;
  north: number;
}

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minEast: number;
  maxEast: number;
  minNorth: number;
  maxNorth: number;
}

export interface WorldSource {
  id: string;
  name: string;
  url: string;
  license: string;
  attribution: string;
  snapshotDate: string;
  usage: string;
}

export interface ChunkRef {
  id: string;
  ix: number;
  iz: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  terrainFile: string;
  roadsFile: string;
  buildingsFile: string;
  buildingsMetaFile: string;
  poisFile: string;
  buildingCount: number;
  roadCount: number;
  hash: string;
}

export interface WorldManifest {
  format: 'yaounde-life-world';
  formatVersion: 1;
  worldVersion: string;
  generatorVersion: string;
  generatedAt: string;
  area: {
    id: string;
    name: string;
    description: string;
  };
  projection: ProjectionInfo;
  origin: WorldOrigin;
  unitsPerMetre: number;
  verticalScale: number;
  verticalOffset: number;
  elevationDatum: string;
  terrainCellSize: number;
  coarseTerrainCellSize: number;
  chunkSize: number;
  bounds: WorldBounds;
  waterLevel: number | null;
  sources: WorldSource[];
  featureCounts: {
    chunks: number;
    roads: number;
    buildings: number;
    pois: number;
    waterPolygons: number;
    terrainSamples: number;
  };
  chunks: ChunkRef[];
  contentHash: string;
  validation: {
    ok: boolean;
    errors: string[];
    warnings: string[];
  };
}

export type RoadClass =
  | 'motorway'
  | 'trunk'
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'unclassified'
  | 'residential'
  | 'service'
  | 'living_street'
  | 'pedestrian'
  | 'footway'
  | 'path'
  | 'cycleway'
  | 'steps'
  | 'track'
  | 'roundabout';

export interface WorldRoad {
  id: string;
  sourceId?: string;
  name?: string;
  roadClass: RoadClass;
  points: [number, number][];
  nodeIds?: number[];
  width: number;
  widthStatus: DataStatus;
  oneway: boolean;
  bridge: boolean;
  tunnel: boolean;
  surface?: string;
  walkable: boolean;
  provenance: Provenance;
}

export type BuildingClass =
  | 'small_house'
  | 'large_house'
  | 'apartment'
  | 'shop'
  | 'restaurant'
  | 'office'
  | 'school'
  | 'hospital'
  | 'church'
  | 'mosque'
  | 'warehouse'
  | 'market'
  | 'public'
  | 'unknown';

export interface BuildingMeta {
  id: string;
  source: string;
  sourceId?: string;
  name?: string;
  classification: BuildingClass;
  height: number;
  floors: number;
  area: number;
  confidence: number;
  geometryStatus: DataStatus;
  heightStatus: DataStatus;
  architectureStatus: DataStatus;
  gameplayStatus: DataStatus;
  tags?: Record<string, string>;
}

export interface BuildingGeometry {
  meta: BuildingMeta;
  ring: [number, number][];
}

export interface WaterFeature {
  id: string;
  name?: string;
  points: [number, number][];
  level: number;
  provenance: Provenance;
}

export interface Poi {
  id: string;
  sourceId?: string;
  name: string;
  nameFr?: string;
  kind: string;
  pos: [number, number];
  district?: string;
  provenance: Provenance;
}

export interface Heightfield {
  width: number;
  height: number;
  cellSize: number;
  originX: number;
  originZ: number;
  minElevation: number;
  maxElevation: number;
  heights: Float32Array;
}

export interface TerrainChunk {
  chunkId: string;
  heightfield: Heightfield;
}

export interface WorldDistrictAnchor {
  id: string;
  name: string;
  nameFr: string;
  lon: number;
  lat: number;
  gameX: number;
  gameZ: number;
  boundary?: [number, number][];
  provenance: Provenance;
}

export interface WorldData {
  manifest: WorldManifest;
  roads: WorldRoad[];
  pois: Poi[];
  water: WaterFeature[];
  districts: WorldDistrictAnchor[];
  coarseTerrain: Heightfield;
}
