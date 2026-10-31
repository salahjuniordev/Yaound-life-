import type { ProjectionInfo, WorldManifest, WorldOrigin } from './types';

export interface LonLat {
  lon: number;
  lat: number;
}

export interface ProjectedPoint {
  east: number;
  north: number;
}

export interface GamePoint {
  x: number;
  z: number;
}

const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const WGS84_EP2 = WGS84_E2 / (1 - WGS84_E2);
const UTM_K0 = 0.9996;
const FALSE_EASTING = 500000;

export const DEFAULT_PROJECTION: ProjectionInfo = {
  id: 'EPSG:32632',
  name: 'WGS 84 / UTM zone 32N',
  zone: 32,
  hemisphere: 'N',
  datum: 'WGS84',
  centralMeridian: 9,
};

function meridianArc(lat: number): number {
  return (
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * WGS84_E2 * WGS84_E2) / 64 - (5 * WGS84_E2 ** 3) / 256) * lat -
      ((3 * WGS84_E2) / 8 + (3 * WGS84_E2 * WGS84_E2) / 32 + (45 * WGS84_E2 ** 3) / 1024) * Math.sin(2 * lat) +
      ((15 * WGS84_E2 * WGS84_E2) / 256 + (45 * WGS84_E2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * WGS84_E2 ** 3) / 3072) * Math.sin(6 * lat))
  );
}

export function utmForward(lon: number, lat: number, projection: ProjectionInfo = DEFAULT_PROJECTION): ProjectedPoint {
  const lon0 = (projection.centralMeridian * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  const t = tanPhi * tanPhi;
  const c = WGS84_EP2 * cosPhi * cosPhi;
  const a = cosPhi * (lambda - lon0);
  const m = meridianArc(phi);
  const m0 = meridianArc(0);

  const x =
    UTM_K0 *
      n *
      (a +
        ((1 - t + c) * a ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * WGS84_EP2) * a ** 5) / 120) +
    FALSE_EASTING;
  const y =
    UTM_K0 *
    (m -
      m0 +
      n *
        tanPhi *
        (a * a / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * WGS84_EP2) * a ** 6) / 720));
  return { east: x, north: y };
}

export function utmInverse(east: number, north: number, projection: ProjectionInfo = DEFAULT_PROJECTION): LonLat {
  const x = east - FALSE_EASTING;
  const y = north;
  const m = y / UTM_K0;
  const mu = m / (WGS84_A * (1 - WGS84_E2 / 4 - (3 * WGS84_E2 ** 2) / 64 - (5 * WGS84_E2 ** 3) / 256));
  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinPhi1 = Math.sin(phi1);
  const cosPhi1 = Math.cos(phi1);
  const tanPhi1 = Math.tan(phi1);
  const n1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi1 * sinPhi1);
  const r1 = (WGS84_A * (1 - WGS84_E2)) / (1 - WGS84_E2 * sinPhi1 * sinPhi1) ** 1.5;
  const c1 = WGS84_EP2 * cosPhi1 * cosPhi1;
  const t1 = tanPhi1 * tanPhi1;
  const d = x / (n1 * UTM_K0);
  const lat =
    phi1 -
    ((n1 * tanPhi1) / r1) *
      (d * d / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * WGS84_EP2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * WGS84_EP2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon =
    (projection.centralMeridian * Math.PI) / 180 +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * WGS84_EP2 + 24 * t1 * t1) * d ** 5) / 120) /
      cosPhi1;
  return { lon: (lon * 180) / Math.PI, lat: (lat * 180) / Math.PI };
}

export function projectedToGame(
  point: ProjectedPoint,
  origin: Pick<WorldOrigin, 'east' | 'north'>,
  unitsPerMetre = 1,
): GamePoint {
  const x = (point.east - origin.east) * unitsPerMetre;
  const z = -(point.north - origin.north) * unitsPerMetre;
  return { x: x === 0 ? 0 : x, z: z === 0 ? 0 : z };
}

export function gameToProjected(
  point: GamePoint,
  origin: Pick<WorldOrigin, 'east' | 'north'>,
  unitsPerMetre = 1,
): ProjectedPoint {
  return {
    east: point.x / unitsPerMetre + origin.east,
    north: -point.z / unitsPerMetre + origin.north,
  };
}

export class WorldTransform {
  readonly projection: ProjectionInfo;
  readonly origin: WorldOrigin;
  readonly unitsPerMetre: number;

  constructor(origin: WorldOrigin, unitsPerMetre = 1, projection: ProjectionInfo = DEFAULT_PROJECTION) {
    this.origin = origin;
    this.unitsPerMetre = unitsPerMetre;
    this.projection = projection;
  }

  static fromManifest(manifest: WorldManifest): WorldTransform {
    return new WorldTransform(manifest.origin, manifest.unitsPerMetre, manifest.projection);
  }

  project(lonLat: LonLat): ProjectedPoint {
    return utmForward(lonLat.lon, lonLat.lat, this.projection);
  }

  unproject(point: ProjectedPoint): LonLat {
    return utmInverse(point.east, point.north, this.projection);
  }

  gameFromLonLat(lonLat: LonLat): GamePoint {
    return projectedToGame(this.project(lonLat), this.origin, this.unitsPerMetre);
  }

  lonLatFromGame(point: GamePoint): LonLat {
    return this.unproject(gameToProjected(point, this.origin, this.unitsPerMetre));
  }

  gameFromProjected(point: ProjectedPoint): GamePoint {
    return projectedToGame(point, this.origin, this.unitsPerMetre);
  }

  projectedFromGame(point: GamePoint): ProjectedPoint {
    return gameToProjected(point, this.origin, this.unitsPerMetre);
  }

  metresToGame(metres: number): number {
    return metres * this.unitsPerMetre;
  }

  gameToMetres(units: number): number {
    return units / this.unitsPerMetre;
  }
}

export function makeOrigin(lon: number, lat: number, projection: ProjectionInfo = DEFAULT_PROJECTION): WorldOrigin {
  const projected = utmForward(lon, lat, projection);
  return {
    lon,
    lat,
    east: projected.east,
    north: projected.north,
  };
}
