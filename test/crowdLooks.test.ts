import test from 'node:test';
import assert from 'node:assert/strict';
import { crowdBuildFor, hashUnit } from '../src/render/crowdLooks';

test('crowd builds are deterministic per id', () => {
  for (const id of ['amina', 'brice', 'npc_12', 'crowd_987']) {
    assert.deepEqual(crowdBuildFor(id), crowdBuildFor(id));
  }
});

test('crowd builds cover several body types and heights', () => {
  const ids = Array.from({ length: 80 }, (_, i) => `npc_${i}`);
  const builds = ids.map(crowdBuildFor);
  const types = new Set(builds.map((b) => b.type));
  assert.ok(types.size >= 5, `expected varied body types, got ${[...types].join(',')}`);
  const heights = builds.map((b) => b.height);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.1, 'heights should vary');
  for (const b of builds) {
    for (const key of ['height', 'shoulder', 'hip', 'torso', 'arm', 'leg', 'head'] as const) {
      assert.ok(Number.isFinite(b[key]) && b[key] > 0, `${b.type} ${key}`);
    }
  }
});

test('hash units stay inside the unit interval', () => {
  for (let i = 0; i < 200; i++) {
    const u = hashUnit(`id_${i}`, 'salt');
    assert.ok(u >= 0 && u < 1);
  }
});
