import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTier, downgradeTier, TIER_ORDER } from '../src/render/perf';

test('data saver forces low tier regardless of hardware', () => {
  const d = classifyTier({ fps: 60, deviceMemoryGb: 8, cores: 8, saveData: true });
  assert.equal(d.tier, 'low');
  assert.match(d.reason, /Data saver/);
  assert.ok(d.reasonFr.length > 0);
});

test('low battery while unplugged forces low tier', () => {
  const d = classifyTier({ fps: 60, deviceMemoryGb: 8, cores: 8, batteryLevel: 0.12, batteryCharging: false });
  assert.equal(d.tier, 'low');
  assert.match(d.reason, /Battery/);
});

test('low battery while charging does not force low tier', () => {
  const d = classifyTier({ fps: 58, deviceMemoryGb: 8, cores: 8, batteryLevel: 0.12, batteryCharging: true });
  assert.equal(d.tier, 'high');
});

test('poor frame rate yields low tier', () => {
  const d = classifyTier({ fps: 22 });
  assert.equal(d.tier, 'low');
});

test('mediocre frame rate yields mid tier', () => {
  const d = classifyTier({ fps: 44 });
  assert.equal(d.tier, 'mid');
});

test('low device memory caps tier at low', () => {
  const d = classifyTier({ fps: 60, deviceMemoryGb: 2, cores: 8 });
  assert.equal(d.tier, 'low');
  assert.match(d.reason, /memory/);
});

test('strong smooth device gets high tier', () => {
  const d = classifyTier({ fps: 58, deviceMemoryGb: 8, cores: 8 });
  assert.equal(d.tier, 'high');
});

test('unknown memory and cores default to mid even when smooth', () => {
  const d = classifyTier({ fps: 58 });
  assert.equal(d.tier, 'mid');
});

test('downgradeTier clamps at low', () => {
  assert.equal(downgradeTier('high'), 'mid');
  assert.equal(downgradeTier('mid'), 'low');
  assert.equal(downgradeTier('low'), 'low');
  assert.equal(downgradeTier('high', 5), 'low');
  assert.deepEqual(TIER_ORDER, ['low', 'mid', 'high']);
});
