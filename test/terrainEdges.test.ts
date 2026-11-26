import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainEdgeMask } from '../src/render/geo/terrainEdges.ts';

test('terrain edge mask marks only sides without a manifest neighbour', () => {
  const grid = [
    { ix: 0, iz: 0 },
    { ix: 1, iz: 0 },
    { ix: 0, iz: 1 },
    { ix: 1, iz: 1 },
  ];
  assert.deepEqual(terrainEdgeMask(grid, 0, 0), { south: false, north: true, west: true, east: false });
  assert.deepEqual(terrainEdgeMask(grid, 1, 1), { south: true, north: false, west: false, east: true });
});

test('terrain edge mask also bevels around missing chunks in an irregular pack', () => {
  const sparse = [
    { ix: 0, iz: 0 },
    { ix: 1, iz: 0 },
    { ix: 0, iz: 1 },
  ];
  assert.deepEqual(terrainEdgeMask(sparse, 0, 1), { south: true, north: false, west: true, east: true });
});
