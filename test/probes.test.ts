import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, getTravelPlan, qualificationReport } from '../src/sim/engine';
import { applyRelationDelta, dailyRelationshipDrift, npcDialogueTone, relationshipSummary, stageFor } from '../src/sim/relationships';
import { dayPart } from '../src/sim/needs';
import { RNG } from '../src/sim/rng';
import { BUSINESS_MAP } from '../src/data/businesses';
import { ZONES } from '../src/data/districts';
import type { BusinessState, DistrictId, NPCState, RelationshipState } from '../src/sim/types';
import { makeState } from './helpers';

function otherZone(current: DistrictId): DistrictId {
  const zone = ZONES.find((z) => z.id !== current);
  assert.ok(zone, 'expected at least two districts');
  return zone.id;
}

test('qualificationReport explains missing requirements and successes', () => {
  const state = makeState();
  state.player.skills.tech = 0;
  const notYet = qualificationReport(state, 'freelance_digital');
  assert.equal(notYet.qualifies, false);
  assert.ok(notYet.missing.length > 0);
  assert.ok(notYet.missingFr.length > 0);

  state.player.skills.tech = 3;
  const qualifies = qualificationReport(state, 'freelance_digital');
  assert.equal(qualifies.qualifies, true);
  assert.ok(qualifies.reasons.length > 0);

  const noRequirements = qualificationReport(state, 'restaurant_server');
  assert.equal(noRequirements.qualifies, true);
});

test('learned routes unlock a 5-minute free fast-travel option', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const to = otherZone(state.player.district);
  state.learnedRoutes.push(to);
  const plan = getTravelPlan(state, state.player.district, to);
  const fast = plan.options.find((o) => o.mode === 'fast');
  assert.ok(fast);
  assert.equal(fast!.available, true);
  assert.equal(fast!.cost, 0);
  assert.equal(fast!.minutes, 5);

  const beforeMinute = state.world.minute;
  const beforeCash = state.wallet.cash;
  const res = engine.dispatch({ type: 'travel', to, mode: 'fast' });
  assert.equal(res.ok, true);
  assert.equal(state.world.minute, beforeMinute + 5);
  assert.equal(state.wallet.cash, beforeCash);
});

test('njangi sitting pays the pot when it is your turn', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 20000;
  const join = engine.dispatch({ type: 'njangi_join', groupId: 'njangi_mvog_reliable', turn: 'early' });
  assert.equal(join.ok, true);
  const membership = state.njangi.membership!;
  const contribution = membership.contribution;
  const group = state.njangi.groups.find((g) => g.id === membership.groupId)!;
  const pot = contribution * (group.members.length + 1);

  state.world.day = membership.nextSittingDay;
  state.wallet.cash = 20000;
  engine.onNewDay();

  assert.equal(membership.cyclesPaid, 1);
  if (membership.turnOrder === 1) {
    assert.equal(membership.cyclesReceived, 1);
    assert.equal(state.wallet.cash, 20000 - contribution + pot);
  } else {
    assert.equal(membership.cyclesReceived, 0);
    assert.equal(state.wallet.cash, 20000 - contribution);
  }
  assert.ok(membership.nextSittingDay > state.world.day);
});

test('business day loop charges rent and sells stocked goods', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const def = BUSINESS_MAP['food_stall'];
  const district = state.player.district;
  const biz: BusinessState = {
    id: 'biz_test',
    kind: 'food_stall',
    name: 'Test stall',
    district,
    rentPerDay: def.rentPerDay,
    priceLevel: 1,
    stock: Object.fromEntries(def.stockItems.map((i) => [i, 50])),
    stockQuality: 'ok',
    quality: 8,
    reputation: 60,
    customerSatisfaction: 70,
    hasGenerator: false,
    revenueToday: 0,
    costsToday: 0,
    arrears: 0,
    openToday: true,
    staffIds: [],
    staffInfo: {},
    marketing: null,
    pendingDeliveries: [],
    premises: 0,
    dayOpened: 1,
  };
  state.businesses.push(biz);
  state.wallet.cash = 100000;

  let bestRevenue = 0;
  for (let i = 0; i < 3; i++) {
    state.world.day += 1;
    engine.onNewDay();
    assert.ok(biz.costsToday >= biz.rentPerDay, 'rent must be recorded in costs');
    bestRevenue = Math.max(bestRevenue, biz.revenueToday);
  }
  assert.ok(bestRevenue > 0, 'stocked stall should sell something in three days');
  const stockLeft = Object.values(biz.stock).reduce((a, b) => a + b, 0);
  assert.ok(stockLeft < def.stockItems.length * 50, 'stock should decrease as goods sell');
});

test('momo and bank transfers apply their fees correctly', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 10000;
  state.wallet.momo = 0;
  state.wallet.bank = 0;

  const dep = engine.dispatch({ type: 'deposit_momo', amount: 2000 });
  assert.equal(dep.ok, true);
  assert.equal(state.wallet.cash, 8000);
  assert.equal(state.wallet.momo, 2000 - 50);

  const wd = engine.dispatch({ type: 'withdraw_momo', amount: 1000 });
  assert.equal(wd.ok, true);
  assert.equal(state.wallet.momo, 1950 - 1000 - 50);
  assert.equal(state.wallet.cash, 9000);

  const bankIn = engine.dispatch({ type: 'bank_deposit', amount: 4000 });
  assert.equal(bankIn.ok, true);
  assert.equal(state.wallet.cash, 5000);
  assert.equal(state.wallet.bank, 4000);

  const bankOut = engine.dispatch({ type: 'bank_withdraw', amount: 1500 });
  assert.equal(bankOut.ok, true);
  assert.equal(state.wallet.bank, 2500);
  assert.equal(state.wallet.cash, 6500);
});

test('relationship stages respond to dimension changes', () => {
  const base: RelationshipState = {
    npcId: 'x',
    stage: 'stranger',
    trust: 0,
    affection: 0,
    respect: 0,
    compatibility: 0,
    metDay: 1,
    lastTalkDay: 1,
    memory: [],
  };
  assert.equal(stageFor({ ...base }, false), 'stranger');
  assert.equal(stageFor({ ...base, trust: 50 }, false), 'acquaintance');
  assert.equal(stageFor({ ...base, trust: 60, affection: 40, respect: 30 }, false), 'friend');
  assert.equal(stageFor({ ...base, trust: 70, affection: 80 }, false), 'dating');
  assert.equal(stageFor({ ...base, trust: -30 }, false), 'rival');
  assert.equal(stageFor({ ...base, trust: 40 }, true), 'colleague');
});

test('applyRelationDelta clamps values and bounds NPC memory', () => {
  const state = makeState();
  applyRelationDelta(state, 'brandon', { trust: 500, affection: -500 });
  const rel = state.relationships['brandon'];
  assert.equal(rel.trust, 100);
  assert.equal(rel.affection, -100);
  for (let i = 0; i < 30; i++) {
    applyRelationDelta(state, 'brandon', { trust: 1, memory: { kind: 'met', note: `note ${i}` } });
  }
  assert.equal(rel.memory.length, 20);
  assert.equal(rel.memory[rel.memory.length - 1].note, 'note 29');
});

test('relationships drift when days pass without talking (wired into onNewDay)', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const rel = state.relationships['brandon'];
  rel.trust = 10;
  rel.affection = 10;
  rel.lastTalkDay = 1;
  state.world.day = 8;
  engine.onNewDay();
  assert.ok(rel.affection < 10, 'affection should decay after a week of silence');
  assert.ok(rel.trust < 10, 'trust should drift down slowly');

  const rng = new RNG(7);
  const rel2 = state.relationships['brandon'];
  rel2.lastTalkDay = state.world.day;
  rel2.trust = 10;
  dailyRelationshipDrift(state, rng);
  assert.equal(rel2.trust, 10, 'no drift when you talked recently');
});

test('relationshipSummary describes bonds in both languages', () => {
  const state = makeState();
  assert.match(relationshipSummary(state, 'nobody_here'), /not met/i);

  const rel = state.relationships['brandon'];
  rel.trust = 50;
  rel.affection = 50;
  rel.respect = 50;
  rel.memory.push({ day: 2, kind: 'met', note: 'shared beignets' });

  const en = relationshipSummary(state, 'brandon');
  assert.match(en, /trusts you/);
  assert.match(en, /enjoys your company/);
  assert.match(en, /remembers: shared beignets/);

  const fr = relationshipSummary(state, 'brandon', true);
  assert.match(fr, /fait confiance/);
  assert.match(fr, /se souvient : shared beignets/);
});

test('npcDialogueTone reflects schedule and relationship', () => {
  const state = makeState();
  const npc = {
    id: 'tester',
    name: 'Tester',
    role: 'test',
    homeDistrict: state.player.district,
    district: state.player.district,
    traits: [],
    schedule: [{ from: 0, to: 1440, activity: 'idle', place: state.player.district }],
  } as unknown as NPCState;
  state.relationships['tester'] = {
    npcId: 'tester',
    stage: 'stranger',
    trust: 0,
    affection: 0,
    respect: 0,
    compatibility: 0,
    metDay: 1,
    lastTalkDay: 1,
    memory: [],
  };
  assert.equal(npcDialogueTone(state, npc), 'greeting');
  state.relationships['tester'].trust = 100;
  assert.equal(npcDialogueTone(state, npc), 'friendly');
  state.relationships['tester'].trust = 0;
  npc.schedule = [{ from: 0, to: 1440, activity: 'managing', place: state.player.district }];
  assert.equal(npcDialogueTone(state, npc), 'busy');
});

test('rng pick, weighted and dayPart behave at boundaries', () => {
  const rng = new RNG(123);
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 50; i++) assert.ok(arr.includes(rng.pick(arr)));
  assert.equal(rng.weighted([]), null);
  assert.equal(rng.weighted([{ item: 'only', weight: 0 }]), null);
  assert.equal(rng.weighted([{ item: 'only', weight: 2 }]), 'only');
  assert.equal(rng.weighted([{ item: 'a', weight: 1 }, { item: 'b', weight: 0 }]), 'a');

  assert.equal(dayPart(300), 'morning');
  assert.equal(dayPart(719), 'morning');
  assert.equal(dayPart(720), 'afternoon');
  assert.equal(dayPart(1019), 'afternoon');
  assert.equal(dayPart(1020), 'evening');
  assert.equal(dayPart(1259), 'evening');
  assert.equal(dayPart(1260), 'night');
  assert.equal(dayPart(0), 'night');
});
