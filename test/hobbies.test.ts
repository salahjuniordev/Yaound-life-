import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/sim/engine';
import { hobbyLevelFor, hobbyProgressFor } from '../src/data/hobbies';
import { makeState } from './helpers';

test('practice activities grant hobby XP with thresholds', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.minute = 9 * 60;
  assert.equal(engine.dispatch({ type: 'activity', activityId: 'football_pitch' }).ok, true);
  assert.ok(state.player.hobbies.football > 3.6 && state.player.hobbies.football < 3.8, '110 min practice gives ~3.7 XP');
  assert.equal(hobbyLevelFor('football', state.player.hobbies.football), 0);
  assert.equal(hobbyLevelFor('football', 10), 1);
  assert.equal(hobbyLevelFor('football', 25), 2);
  assert.equal(hobbyLevelFor('football', 140), 5);
});

test('gear purchase doubles down on practice gain', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.minute = 9 * 60;
  state.wallet.cash = 50000;
  assert.equal(engine.dispatch({ type: 'hobby_buy_gear', hobbyId: 'football' }).ok, true);
  assert.equal(state.storyFlags['hobbygear_football'], 1);
  assert.equal(state.wallet.cash, 38000);
  assert.equal(engine.dispatch({ type: 'hobby_buy_gear', hobbyId: 'football' }).ok, false, 'no double gear');

  state.player.hobbies.football = 0;
  engine.dispatch({ type: 'activity', activityId: 'football_pitch' });
  assert.ok(state.player.hobbies.football > 5.4, 'gear applies 1.5x to 3.67 XP');
});

test('photographs train the photography hobby', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  engine.dispatch({ type: 'photo_taken', landmarkId: 'university_gate' });
  assert.equal(state.player.hobbies.photography, 2);
  assert.equal(state.stats.photosTaken, 1);
});

test('crossing a threshold announces the hobby level', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.minute = 9 * 60;
  state.player.hobbies.football = 24.9;
  engine.dispatch({ type: 'activity', activityId: 'football_pitch' });
  assert.equal(hobbyLevelFor('football', state.player.hobbies.football), 2);
  assert.ok(state.phone.notifications.some((n) => n.title.includes('Football level 2')));
});

test('competitions gate on level, pay a prize, then cool down', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.minute = 9 * 60;
  state.wallet.cash = 10000;

  state.player.hobbies.football = 5;
  assert.equal(engine.dispatch({ type: 'hobby_compete', hobbyId: 'football' }).ok, false, 'level 1 locked');

  state.player.hobbies.football = 140;
  const before = state.wallet.cash;
  assert.equal(engine.dispatch({ type: 'hobby_compete', hobbyId: 'football' }).ok, true);
  assert.ok(state.wallet.cash > before, 'prize exceeds entry fee');
  assert.ok(state.milestones.some((m) => m.includes('Quartier tournament')));
  assert.equal(state.storyFlags['hobbycomp_football'], state.world.day);

  assert.equal(engine.dispatch({ type: 'hobby_compete', hobbyId: 'football' }).ok, false, 'cooldown holds');
});

test('hobby progress view stays consistent at max level', () => {
  const p = hobbyProgressFor('music', 500);
  assert.equal(p.level, 5);
  assert.equal(p.levelSpan, null);
});
