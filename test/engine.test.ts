import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, getTravelPlan } from '../src/sim/engine';
import type { DistrictId } from '../src/sim/types';
import { ZONES } from '../src/data/districts';
import { makeState } from './helpers';

function otherZone(current: DistrictId): DistrictId {
  const zone = ZONES.find((z) => z.id !== current);
  assert.ok(zone, 'expected at least two districts');
  return zone.id;
}

test('tick advances 2 game minutes per real second and respects pause', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const before = state.world.minute;
  engine.tick(1);
  assert.equal(state.world.minute, before + 2);
  engine.paused = true;
  engine.tick(30);
  assert.equal(state.world.minute, before + 2);
});

test('advanceMinutes rolls over midnight into a new day', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.minute = 1430;
  engine.advanceMinutes(20);
  assert.equal(state.world.day, 2);
  assert.equal(state.world.minute, 10);
  assert.equal(state.stats.daysPlayed, 2);
});

test('walk_enter moves district for free in 3 minutes', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const target = otherZone(state.player.district);
  const beforeMinute = state.world.minute;
  const res = engine.dispatch({ type: 'walk_enter', to: target });
  assert.equal(res.ok, true);
  assert.equal(state.player.district, target);
  assert.equal(state.world.minute, beforeMinute + 3);
});

test('taxi travel charges the fare, advances time, and learns the route', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 100000;
  state.world.strike = false;
  const from = state.player.district;
  const to = otherZone(from);
  const plan = getTravelPlan(state, from, to);
  const taxi = plan.options.find((o) => o.mode === 'taxi');
  assert.ok(taxi && taxi.available);
  const beforeMinute = state.world.minute;
  const beforeCash = state.wallet.cash;
  const res = engine.dispatch({ type: 'travel', to, mode: 'taxi' });
  assert.equal(res.ok, true);
  assert.equal(state.player.district, to);
  assert.equal(state.world.minute, beforeMinute + taxi!.minutes);
  assert.equal(state.wallet.cash, beforeCash - taxi!.cost);
  assert.ok(state.learnedRoutes.includes(to));
  assert.ok(state.travelLog.some((t) => t.mode === 'taxi' && t.to === to));
});

test('taxi is unavailable during a strike', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.strike = true;
  state.wallet.cash = 100000;
  const to = otherZone(state.player.district);
  const plan = getTravelPlan(state, state.player.district, to);
  assert.equal(plan.options.find((o) => o.mode === 'taxi')?.available, false);
  const res = engine.dispatch({ type: 'travel', to, mode: 'taxi' });
  assert.equal(res.ok, false);
});

test('buying food spends cash and adds the item to inventory', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 50000;
  const before = state.wallet.cash;
  const res = engine.dispatch({ type: 'buy', itemId: 'beignets_haricots', qty: 2, vendor: 'street_food' });
  assert.equal(res.ok, true);
  assert.ok(state.wallet.cash < before);
  const inv = state.inventory.find((i) => i.itemId === 'beignets_haricots');
  assert.ok(inv && inv.qty >= 2);
});

test('a work shift pays exactly once per day', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.job = {
    jobId: 'restaurant_server',
    hiredDay: 1,
    performance: 50,
    reliability: 60,
    shiftsWorked: 0,
    shiftsMissed: 0,
    shiftsThisWeek: 0,
    lastShiftDay: 0,
  };
  state.world.minute = 700;
  const before = state.wallet.cash;
  const first = engine.dispatch({ type: 'work_shift', jobId: 'restaurant_server', minutes: 480 });
  assert.equal(first.ok, true);
  assert.equal(state.wallet.cash, before + 4500, 'day 1 is New Year: festive x1.5 pay (3000 -> 4500)');
  assert.equal(state.player.job.lastShiftDay, state.world.day);
  const second = engine.dispatch({ type: 'work_shift', jobId: 'restaurant_server', minutes: 480 });
  assert.equal(second.ok, false);
  assert.equal(state.wallet.cash, before + 4500);
});

test('njangi join assigns a turn and contributions move money', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 20000;
  const join = engine.dispatch({ type: 'njangi_join', groupId: 'njangi_mvog_reliable', turn: 'early' });
  assert.equal(join.ok, true);
  assert.ok(state.njangi.membership);
  assert.ok(state.njangi.membership!.turnOrder >= 1 && state.njangi.membership!.turnOrder <= 2);
  const before = state.wallet.cash;
  const contribute = engine.dispatch({ type: 'njangi_contribute' });
  assert.equal(contribute.ok, true);
  assert.equal(state.wallet.cash, before - state.njangi.membership!.contribution);
});

test('joining the sketchy tontine charges its join fee', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 20000;
  const join = engine.dispatch({ type: 'njangi_join', groupId: 'njangi_digital_fast', turn: 'early' });
  assert.equal(join.ok, true);
  assert.equal(state.wallet.cash, 19000);
});

test('event choices resolve and remove pending events', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.pendingEvents.push({
    templateId: 'unknown_template',
    title: 'Test event',
    body: 'Body',
    kind: 'test',
    choices: [{ id: 'a', label: 'A' }],
  });
  const res = engine.dispatch({ type: 'event_choice', eventIndex: 0, choiceId: 'a' });
  assert.equal(res.ok, true);
  assert.equal(state.pendingEvents.length, 0);

  state.pendingEvents.push({
    templateId: 'unknown_template',
    title: 'Test event 2',
    body: 'Body',
    kind: 'test',
    choices: [],
  });
  engine.dispatch({ type: 'dismiss_event', eventIndex: 0 });
  assert.equal(state.pendingEvents.length, 0);
});

test('income unlocks first_franc and completes the 100k goal', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  engine.giveIncome('cash', 150000, 'gift', 'Test', 'Test windfall');
  assert.ok(state.achievements.includes('first_franc'));
  const goal = state.activeGoals.find((g) => g.id === 'save_100k');
  assert.ok(goal);
  assert.equal(goal!.status, 'completed');
});

test('first wage payment unlocks first_pay and sets the flag', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  assert.equal(state.stats.firstPayReceived, false);
  engine.giveIncome('cash', 3000, 'wage', 'Employer', 'Shift');
  assert.equal(state.stats.firstPayReceived, true);
  assert.ok(state.achievements.includes('first_pay'));
});

test('eating beignets raises fullness and advances the tutorial', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.needs.hunger = 40;
  state.wallet.cash = 5000;
  state.storyFlags['tutorialStep'] = 2;
  const res = engine.dispatch({ type: 'activity', activityId: 'eat_beignets' });
  assert.equal(res.ok, true);
  assert.ok(state.player.needs.hunger > 40);
  assert.equal(state.storyFlags['tutorialStep'], 3);
});
