import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/sim/engine';
import { ACHIEVEMENTS } from '../src/data/goals';
import { RENTAL_PROPERTIES } from '../src/data/properties';
import { makeState } from './helpers';

function takeJob(state: ReturnType<typeof makeState>, jobId: string) {
  state.player.job = {
    jobId,
    hiredDay: 1,
    performance: 60,
    reliability: 60,
    shiftsWorked: 0,
    shiftsMissed: 0,
    shiftsThisWeek: 0,
    lastShiftDay: 0,
  };
}

function workDay(engine: GameEngine, state: ReturnType<typeof makeState>, jobId: string) {
  state.world.minute = 9 * 60;
  const res = engine.dispatch({ type: 'work_shift', jobId });
  assert.equal(res.ok, true);
}

test('work streak counts consecutive days and keeps the best', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  takeJob(state, 'cyber_attendant');

  workDay(engine, state, 'cyber_attendant');
  assert.equal(state.stats.workStreak, 1);
  state.world.day += 1;
  workDay(engine, state, 'cyber_attendant');
  assert.equal(state.stats.workStreak, 2);

  state.world.day += 2;
  workDay(engine, state, 'cyber_attendant');
  assert.equal(state.stats.workStreak, 1, 'gap resets streak');
  assert.equal(state.stats.bestWorkStreak, 2, 'best kept');
});

test('seven straight days unlock the hidden streak achievement', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  takeJob(state, 'cyber_attendant');
  for (let i = 0; i < 7; i += 1) {
    workDay(engine, state, 'cyber_attendant');
    if (i < 6) state.world.day += 1;
  }
  assert.equal(state.stats.workStreak, 7);
  assert.ok(state.achievements.includes('sleepless_hustler'));
});

test('property and business milestones unlock their achievements', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 4000000;
  assert.equal(engine.dispatch({ type: 'property_buy', propertyId: RENTAL_PROPERTIES[0].id }).ok, true);
  assert.ok(state.achievements.includes('landlord'));

  for (const name of ['One', 'Two', 'Three']) {
    assert.equal(engine.dispatch({ type: 'business_open', kind: 'food_stall', name }).ok, true);
  }
  assert.ok(state.achievements.includes('tycoon'));
});

test('three hobbies at level 2 unlock renaissance', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.player.hobbies.football = 25;
  state.player.hobbies.music = 25;
  state.player.hobbies.dance = 25;
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.ok(state.achievements.includes('renaissance'));
});

test('hidden achievements are flagged and masked across the list', () => {
  const hidden = ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.id);
  assert.ok(hidden.length >= 6, 'at least six hidden achievements');
  for (const id of ['sleepless_hustler', 'scholar', 'renaissance', 'festive', 'philanthropist', 'night_owl']) {
    assert.ok(hidden.includes(id), `${id} is hidden`);
  }
});

test('legacy goals complete from property and education state', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.activeGoals.push({ id: 'two_properties', status: 'active', progress: 0, target: 2 });
  state.activeGoals.push({ id: 'education_top', status: 'active', progress: 0, target: 1 });
  state.wallet.cash = 4000000;
  engine.dispatch({ type: 'property_buy', propertyId: RENTAL_PROPERTIES[0].id });
  engine.dispatch({ type: 'property_buy', propertyId: RENTAL_PROPERTIES[1].id });
  assert.equal(state.activeGoals.find((g) => g.id === 'two_properties')!.status, 'completed');

  state.player.education.level = 'Concours réussi';
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(state.activeGoals.find((g) => g.id === 'education_top')!.status, 'completed');
});
