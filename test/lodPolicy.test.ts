import test from 'node:test';
import assert from 'node:assert/strict';
import { GEO_LOD_POLICY, shouldBuildNear, shouldRetainNear } from '../src/render/geo/lodPolicy.ts';
import type { QualityTier } from '../src/render/controls.ts';

const TIERS: QualityTier[] = ['low', 'mid', 'high'];

test('high building detail is limited to the nearby chunk bounds', () => {
  const policy = GEO_LOD_POLICY.high;
  assert.ok(policy.building < 560, 'high should not keep near facades across the old wide ring');
  assert.equal(shouldBuildNear('high', policy.building - 1), true);
  assert.equal(shouldBuildNear('high', policy.building), false);
  assert.equal(shouldBuildNear('high', policy.building + 1), false);
  assert.equal(shouldBuildNear('low', 10_000), true, 'low has one detail tier and always builds it');
});

test('near geometry has a retention band but is eventually released', () => {
  for (const tier of TIERS) {
    const policy = GEO_LOD_POLICY[tier];
    assert.ok(policy.retainNear >= policy.building);
    assert.equal(shouldRetainNear(tier, policy.building), true);
    assert.equal(shouldRetainNear(tier, policy.retainNear), true);
    assert.equal(shouldRetainNear(tier, policy.retainNear + 1), tier === 'low');
  }
});

test('high shares the mobile-sized streaming ring instead of the old 4 x 4 set', () => {
  for (const tier of TIERS) {
    const policy = GEO_LOD_POLICY[tier];
    assert.ok(policy.chunkCap <= 10, `${tier} chunk cap ${policy.chunkCap}`);
    assert.ok(policy.shadowCasters <= policy.props);
  }
  assert.ok(GEO_LOD_POLICY.high.shadowCasters < GEO_LOD_POLICY.high.building);
});
