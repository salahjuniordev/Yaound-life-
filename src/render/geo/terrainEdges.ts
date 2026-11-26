import type { TerrainEdgeMask } from './geometry';

/**
 * A side is a pack edge only when the manifest has no neighbouring chunk.
 * Missing neighbours at irregular pack boundaries also get a visible slope
 * instead of a hollow cut edge.
 */
export function terrainEdgeMask(
  chunks: ReadonlyArray<{ ix: number; iz: number }>,
  ix: number,
  iz: number,
): TerrainEdgeMask {
  const present = new Set(chunks.map((chunk) => `${chunk.ix},${chunk.iz}`));
  return {
    south: !present.has(`${ix},${iz + 1}`),
    north: !present.has(`${ix},${iz - 1}`),
    west: !present.has(`${ix - 1},${iz}`),
    east: !present.has(`${ix + 1},${iz}`),
  };
}
