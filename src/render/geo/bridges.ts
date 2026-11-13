import type { WorldRoad } from '../../world/types';

/**
 * How far the bridge deck sits above the road/terrain profile. The whole deck
 * and its approach ramps use the same lift so the player height sampler and
 * the rendered geometry stay aligned.
 */
export const BRIDGE_DECK_LIFT = 0.3;

/** Length of the approach ramp that blends the raised deck back to the road. */
export const BRIDGE_RAMP_LENGTH = 2.4;

/** Extra deck width beyond the carriageway for vehicle bridges. */
export const BRIDGE_SHOULDER = 2.05;

/** Extra deck width beyond the walkway for footbridges. */
export const BRIDGE_FOOT_SHOULDER = 0.85;

const FOOT_BRIDGE_CLASSES = new Set(['footway', 'path', 'cycleway', 'steps', 'pedestrian', 'track']);

export function bridgeDeckHalfWidth(road: WorldRoad): number {
  return road.width / 2 + (FOOT_BRIDGE_CLASSES.has(road.roadClass) ? BRIDGE_FOOT_SHOULDER : BRIDGE_SHOULDER);
}

/**
 * Returns the height of a walkable bridge deck/ramp at `(x, z)`, or `null`
 * when the point is outside every bridge corridor. The terrain height is
 * supplied by the caller so this helper works for both loaded chunk
 * heightfields and the coarse fallback.
 *
 * Bridge interiors use a straight grade between the endpoint terrain heights
 * plus the deck lift. Points just beyond either end follow a short ramp back
 * down to the normal road surface.
 */
export function bridgeSurfaceAt(
  roads: WorldRoad[],
  x: number,
  z: number,
  baseHeight: (x: number, z: number) => number,
): number | null {
  let bestDistanceSq = Infinity;
  let bestHeight: number | null = null;

  for (const road of roads) {
    if (!road.bridge || road.tunnel || road.points.length < 2) continue;
    const half = bridgeDeckHalfWidth(road);
    const reachSq = half * half;
    const lastSegment = road.points.length - 2;

    for (let i = 0; i <= lastSegment; i++) {
      const [ax, az] = road.points[i];
      const [bx, bz] = road.points[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const length = Math.hypot(dx, dz);
      if (length < 0.1) continue;

      // Distance in metres from the start of this segment, not a 0..1 ratio.
      const along = ((x - ax) * dx + (z - az) * dz) / length;
      const t = Math.max(0, Math.min(1, along / length));
      const px = ax + dx * t;
      const pz = az + dz * t;
      const distanceSq = (x - px) * (x - px) + (z - pz) * (z - pz);
      if (distanceSq > reachSq || distanceSq >= bestDistanceSq) continue;

      if (i === 0 && along < 0) {
        const overshoot = -along;
        if (overshoot > BRIDGE_RAMP_LENGTH) continue;
        const ramp = 1 - overshoot / BRIDGE_RAMP_LENGTH;
        bestDistanceSq = distanceSq;
        bestHeight = baseHeight(x, z) + BRIDGE_DECK_LIFT * ramp;
        continue;
      }

      if (i === lastSegment && along > length) {
        const overshoot = along - length;
        if (overshoot > BRIDGE_RAMP_LENGTH) continue;
        const ramp = 1 - overshoot / BRIDGE_RAMP_LENGTH;
        bestDistanceSq = distanceSq;
        bestHeight = baseHeight(x, z) + BRIDGE_DECK_LIFT * ramp;
        continue;
      }

      const heightA = baseHeight(ax, az);
      const heightB = baseHeight(bx, bz);
      bestDistanceSq = distanceSq;
      bestHeight = heightA + (heightB - heightA) * t + BRIDGE_DECK_LIFT;
    }
  }

  return bestHeight;
}
