import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../src/sim/rng';
import { applyNeedEffects, clamp, decayNeeds, formatClock } from '../src/sim/needs';
import { districtPrice, momoFee, spendMoney, totalMoney } from '../src/sim/economy';
import { createGameState, migrateState } from '../src/sim/state';
import { ZONES } from '../src/data/districts';
import { NAMED_NPCS } from '../src/data/npcs';
import { makeState } from './helpers';

test('RNG is deterministic for the same seed and differs across seeds', () => {
  const a = new RNG(4321);
  const b = new RNG(4321);
  const c = new RNG(9876);
  const seqA = Array.from({ length: 6 }, () => a.int(0, 100000));
  const seqB = Array.from({ length: 6 }, () => b.int(0, 100000));
  const seqC = Array.from({ length: 6 }, () => c.int(0, 100000));
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
});

test('RNG int stays within bounds and chance respects 0/1', () => {
  const rng = new RNG(99);
  for (let i = 0; i < 200; i++) {
    const v = rng.int(5, 10);
    assert.ok(v >= 5 && v <= 10, `value ${v} out of range`);
  }
  assert.equal(rng.chance(1), true);
  assert.equal(rng.chance(0), false);
});

test('decayNeeds lowers needs over time and respects relaxed mode', () => {
  const normal = makeState();
  normal.player.needs.energy = 80;
  decayNeeds(normal, 60);
  const relaxed = makeState();
  relaxed.player.needs.energy = 80;
  relaxed.settings.relaxedNeeds = true;
  decayNeeds(relaxed, 60);
  assert.ok(normal.player.needs.energy < 80);
  assert.ok(relaxed.player.needs.energy > normal.player.needs.energy);
  assert.ok(relaxed.player.needs.energy <= 80);
});

test('needs never go below zero or above one hundred', () => {
  const state = makeState();
  state.player.needs.hunger = 1;
  decayNeeds(state, 60 * 24);
  assert.ok(state.player.needs.hunger >= 0);
  applyNeedEffects(state.player.needs, { hunger: 1000 });
  assert.equal(state.player.needs.hunger, 100);
  assert.equal(clamp(-5), 0);
  assert.equal(clamp(120), 100);
});

test('formatClock renders zero-padded 24h time', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(750), '12:30');
  assert.equal(formatClock(1439), '23:59');
});

test('spendMoney falls back to another wallet when cash is short', () => {
  const state = makeState();
  state.wallet.cash = 100;
  state.wallet.momo = 5000;
  state.wallet.bank = 0;
  const ok = spendMoney(state, 'cash', 1000, 'test', 'Test', 'fallback check');
  assert.equal(ok.ok, true);
  assert.equal(state.wallet.cash, 100);
  assert.equal(state.wallet.momo, 4000);
});

test('spendMoney fails cleanly when no wallet can cover the amount', () => {
  const state = makeState();
  state.wallet.cash = 10;
  state.wallet.momo = 10;
  state.wallet.bank = 10;
  const res = spendMoney(state, 'cash', 5000, 'test', 'Test', 'no funds');
  assert.equal(res.ok, false);
  assert.equal(totalMoney(state.wallet), 30);
});

test('momoFee has a 50 FCFA floor and 1% rate', () => {
  assert.equal(momoFee(1000), 50);
  assert.equal(momoFee(10000), 100);
});

test('districtPrice applies the district multiplier', () => {
  const state = makeState();
  const zone = ZONES.find((z) => z.priceMultiplier !== 1);
  assert.ok(zone, 'expected at least one district with a non-default price multiplier');
  assert.notEqual(districtPrice(state, zone.id, 1000), 1000);
});

test('createGameState produces a valid fresh day-one state', () => {
  const state = createGameState({
    name: 'Awa',
    gender: 'f',
    background: 'student',
    appearance: {
      skinTone: 4,
      hair: 'braids',
      bodyType: 'slim',
      shirtColor: '#e0532f',
      pantsColor: '#2c3e50',
    },
  });
  assert.equal(state.version, 1);
  assert.equal(state.world.day, 1);
  assert.equal(state.world.minute, 7 * 60);
  assert.equal(state.player.name, 'Awa');
  assert.ok(state.learnedRoutes.includes(state.player.district));
  assert.equal(Object.keys(state.npcs).length, NAMED_NPCS.length);
  assert.ok(state.activeGoals.some((g) => g.id === 'save_100k'));
  assert.ok(state.wallet.cash >= 0);
});

test('migrateState rejects garbage and restores missing NPCs', () => {
  assert.equal(migrateState(null), null);
  assert.equal(migrateState({}), null);
  assert.equal(migrateState({ version: 2 }), null);

  const state = makeState();
  const raw = JSON.parse(JSON.stringify(state)) as typeof state;
  delete (raw.npcs as Record<string, unknown>)['brandon'];
  raw.settings.language = 'fr';
  const migrated = migrateState(raw);
  assert.ok(migrated);
  assert.ok(migrated!.npcs['brandon'], 'missing named NPC should be restored');
  assert.equal(migrated!.settings.language, 'fr');
  assert.equal(migrated!.settings.quality, 'mid');
  assert.ok(migrated!.relationships['brandon']);
});
