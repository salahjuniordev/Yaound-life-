import test from 'node:test';
import assert from 'node:assert/strict';
import { ChunkLru } from '../src/world/chunkManager.ts';

test('chunk LRU tracks load order and unloads cleanly', () => {
  const lru = new ChunkLru(4);
  lru.markLoaded('a');
  lru.markLoaded('b');
  lru.touch('a');
  assert.equal(lru.size, 2);
  assert.deepEqual(lru.snapshot(), ['b', 'a']);
  lru.unload('b');
  assert.equal(lru.has('b'), false);
  assert.deepEqual(lru.snapshot(), ['a']);
});

test('chunk plan evicts chunks outside the keep radius first', () => {
  const lru = new ChunkLru(10);
  for (const id of ['a', 'b', 'c', 'd']) lru.markLoaded(id);
  const plan = lru.plan(new Set(['a', 'b']), new Set(['a', 'b', 'c']));
  assert.deepEqual(plan.evict, ['d']);
  assert.deepEqual(plan.load, []);
});

test('chunk plan respects the memory cap by evicting least-recently-used non-desired chunks', () => {
  const lru = new ChunkLru(2);
  for (const id of ['a', 'b', 'c', 'd']) lru.markLoaded(id);
  const plan = lru.plan(new Set(['c', 'd']), new Set(['a', 'b', 'c', 'd']));
  assert.deepEqual(plan.evict, ['a', 'b']);
  assert.deepEqual(plan.load, []);
});

test('chunk plan only requests missing desired chunks and skips in-flight loads', () => {
  const lru = new ChunkLru(8);
  lru.markLoaded('a');
  const plan = lru.plan(new Set(['a', 'b', 'c']), new Set(['a', 'b', 'c']), new Set(['b']));
  assert.deepEqual(plan.load, ['c']);
  assert.deepEqual(plan.evict, []);
});

test('chunk plan keeps a stable loaded subset when desired exceeds the cap', () => {
  const lru = new ChunkLru(2);
  lru.markLoaded('a');
  lru.markLoaded('b');
  const desired = new Set(['a', 'b', 'c']);
  const plan = lru.plan(desired, desired);
  assert.deepEqual(plan.evict, []);
  assert.deepEqual(plan.load, []);
});

test('chunk plan honours nearest-first order when desired exceeds the cap', () => {
  const lru = new ChunkLru(2);
  const plan = lru.plan(new Set(['c', 'a', 'b']), new Set(['c', 'a', 'b']));
  assert.deepEqual(plan.load, ['c', 'a']);
});

test('chunk plan keeps a separate chunk stable across repeated over-cap plans', () => {
  const lru = new ChunkLru(2);
  const desired = new Set(['a', 'b', 'c']);
  let plan = lru.plan(desired, desired);
  assert.deepEqual(plan.load, ['a', 'b']);
  for (const id of plan.load) lru.markLoaded(id);
  plan = lru.plan(desired, desired);
  assert.deepEqual(plan.load, []);
  assert.deepEqual(plan.evict, []);
  plan = lru.plan(desired, desired);
  assert.deepEqual(plan.load, []);
  assert.deepEqual(plan.evict, []);
});

test('chunk plan never requests more chunks than the memory cap', () => {
  const lru = new ChunkLru(2);
  const plan = lru.plan(new Set(['a', 'b', 'c', 'd']), new Set(['a', 'b', 'c', 'd']));
  assert.deepEqual(plan.load, ['a', 'b']);
  assert.deepEqual(plan.evict, []);
});
