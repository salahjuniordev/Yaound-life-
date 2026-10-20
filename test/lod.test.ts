import test from 'node:test';
import assert from 'node:assert/strict';
import { crowdLodFor, LOD_DISTANCES } from '../src/render/lod';
import { qualityTiers, type QualityTier } from '../src/render/controls';

const TIERS: QualityTier[] = ['low', 'mid', 'high'];

test('crowd LOD degrades full -> simple -> impostor at tier thresholds', () => {
  for (const tier of TIERS) {
    const d = LOD_DISTANCES[tier];
    assert.equal(crowdLodFor(1, tier), 'full');
    assert.equal(crowdLodFor(d.full, tier), 'full');
    assert.equal(crowdLodFor(d.full + 0.01, tier), 'simple');
    assert.equal(crowdLodFor(d.simple, tier), 'simple');
    assert.equal(crowdLodFor(d.simple + 0.01, tier), 'impostor');
    assert.equal(crowdLodFor(d.impostor + 50, tier), 'impostor');
  }
});

test('higher quality tiers keep characters detailed further away', () => {
  for (let i = 1; i < TIERS.length; i++) {
    const lower = LOD_DISTANCES[TIERS[i - 1]];
    const higher = LOD_DISTANCES[TIERS[i]];
    assert.ok(higher.full >= lower.full);
    assert.ok(higher.simple >= lower.simple);
    assert.ok(higher.impostor >= lower.impostor);
  }
});

test('invalid distances fall back to the full-detail crowd', () => {
  assert.equal(crowdLodFor(Number.NaN, 'mid'), 'full');
  assert.equal(crowdLodFor(-4, 'mid'), 'full');
  assert.equal(crowdLodFor(0, 'mid'), 'full');
});

test('impostor distances stay inside each tier view distance', () => {
  for (const tier of TIERS) {
    assert.ok(LOD_DISTANCES[tier].impostor <= qualityTiers[tier].viewDistance);
    assert.ok(LOD_DISTANCES[tier].simple <= LOD_DISTANCES[tier].impostor);
  }
});
