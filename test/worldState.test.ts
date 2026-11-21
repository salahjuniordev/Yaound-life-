import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSharedWorldState } from '../src/persistence/worldState';
import { GameEngine } from '../src/sim/engine';
import { makeState } from './helpers';

test('shared world state parses validated server rows', () => {
  const parsed = parseSharedWorldState({
    game_day: 321,
    weather: 'rain',
    fuel_price: 873.4,
    strike: { active: true },
    delestage: {
      nlongkak: { start: 600, end: 750 },
      not_a_district: { start: 0, end: 60 },
      mokolo: { start: 1440, end: 1500 },
    },
    events: {
      headlines: ['Rain slows the commute.', 'Fuel is up.'],
      headlinesFr: ['La pluie ralentit les trajets.', 'Le carburant monte.'],
    },
  });

  assert.ok(parsed);
  assert.equal(parsed.gameDay, 321);
  assert.equal(parsed.weather, 'rain');
  assert.equal(parsed.fuelPrice, 873);
  assert.equal(parsed.strike, true);
  assert.deepEqual(parsed.outages, { nlongkak: { start: 600, end: 750 } });
  assert.deepEqual(parsed.headlines, ['Rain slows the commute.', 'Fuel is up.']);
  assert.deepEqual(parsed.headlinesFr, ['La pluie ralentit les trajets.', 'Le carburant monte.']);
});

test('shared world state parser ignores malformed values and keeps a valid day', () => {
  assert.equal(parseSharedWorldState(null), null);
  assert.equal(parseSharedWorldState({ game_day: 0 }), null);
  assert.equal(parseSharedWorldState({ game_day: 3.5 }), null);

  const parsed = parseSharedWorldState({
    game_day: 4,
    weather: 'dust',
    fuel_price: '900',
    strike: { reason: 'missing active' },
    delestage: 'not-an-object',
    events: { headlines: ['ok', 42] },
  });
  assert.deepEqual(parsed, { gameDay: 4, headlines: ['ok'] });
});

test('engine applies shared city state without changing the local calendar', () => {
  const state = makeState();
  state.settings.language = 'fr';
  const engine = new GameEngine(state);
  const beforeDay = state.world.day;
  const beforeMinute = state.world.minute;

  const changed = engine.applySharedWorldState({
    gameDay: 12,
    weather: 'rain',
    fuelPrice: 930,
    strike: true,
    outages: { nlongkak: { start: 600, end: 720 } },
    headlines: ['English bulletin'],
    headlinesFr: ['Bulletin français'],
  });

  assert.equal(changed, true);
  assert.equal(state.world.weather, 'rain');
  assert.equal(state.world.fuelPrice, 930);
  assert.equal(state.world.strike, true);
  assert.deepEqual(state.world.outages, { nlongkak: { start: 600, end: 720 } });
  assert.deepEqual(state.world.headlines, ['Bulletin français']);
  assert.equal(state.world.day, beforeDay);
  assert.equal(state.world.minute, beforeMinute);
});

test('engine clamps shared fuel and drops invalid outage entries', () => {
  const state = makeState();
  const engine = new GameEngine(state);

  const changed = engine.applySharedWorldState({
    gameDay: 5,
    fuelPrice: 5000,
    outages: {
      nlongkak: { start: 0, end: 30 },
      mokolo: { start: 1440, end: 1500 },
    },
  });

  assert.equal(changed, true);
  assert.equal(state.world.fuelPrice, 1000);
  assert.deepEqual(state.world.outages, { nlongkak: { start: 0, end: 30 } });
});

test('engine ignores an older shared row but accepts same-day updates', () => {
  const state = makeState();
  state.world.weather = 'sun';
  const engine = new GameEngine(state);

  assert.equal(engine.applySharedWorldState({ gameDay: 20, weather: 'rain' }), true);
  assert.equal(engine.applySharedWorldState({ gameDay: 19, weather: 'sun' }), false);
  assert.equal(state.world.weather, 'rain');
  assert.equal(engine.applySharedWorldState({ gameDay: 20, weather: 'sun' }), true);
  assert.equal(state.world.weather, 'sun');
});
