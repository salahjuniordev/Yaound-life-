import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/sim/engine';
import { RENTAL_PROPERTIES } from '../src/data/properties';
import { makeState } from './helpers';

test('buying a home ends rent forever and caps housing', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 1600000;
  state.storyFlags['housing_stage'] = 3;

  assert.equal(engine.dispatch({ type: 'housing_upgrade', stage: 4 }).ok, true);
  assert.equal(state.storyFlags['housing_stage'], 4);
  assert.equal(state.storyFlags['rent'], 0);
  assert.equal(state.storyFlags['housing_owned'], 1);
  assert.equal(engine.dispatch({ type: 'housing_upgrade', stage: 5 }).ok, false, 'no stage 5');
});

test('rental property buys and pays net rent on Sundays only', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const studio = RENTAL_PROPERTIES[0];

  state.wallet.cash = studio.price - 1000;
  assert.equal(engine.dispatch({ type: 'property_buy', propertyId: studio.id }).ok, false, 'cannot afford');

  state.wallet.cash = studio.price + 5000;
  assert.equal(engine.dispatch({ type: 'property_buy', propertyId: studio.id }).ok, true);
  assert.ok(state.player.properties.includes(studio.id));
  assert.equal(engine.dispatch({ type: 'property_buy', propertyId: studio.id }).ok, false, 'no double buy');

  state.world.day = 7;
  state.world.dayOfWeek = 0;
  const bankBefore = state.wallet.bank;
  engine.onNewDay();
  assert.equal(state.wallet.bank - bankBefore, studio.weeklyRent - studio.maintenance, 'net rent on Sunday');

  state.world.day = 8;
  state.world.dayOfWeek = 1;
  const bankAfterSunday = state.wallet.bank;
  engine.onNewDay();
  assert.equal(state.wallet.bank, bankAfterSunday, 'no rent on Monday');
});

test('business premises upgrade adds rent, demand tier and caps', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 600000;
  assert.equal(engine.dispatch({ type: 'business_open', kind: 'food_stall', name: 'Premises test' }).ok, true);
  const biz = state.businesses[0];
  const baseRent = biz.rentPerDay;
  const cashAfterOpen = state.wallet.cash;

  assert.equal(engine.dispatch({ type: 'business_premises_upgrade', businessId: biz.id }).ok, true);
  assert.equal(biz.premises, 1);
  assert.equal(biz.rentPerDay, baseRent + 1500);
  assert.equal(state.wallet.cash, cashAfterOpen - 120000);

  assert.equal(engine.dispatch({ type: 'business_premises_upgrade', businessId: biz.id }).ok, true);
  assert.equal(biz.premises, 2);
  assert.equal(biz.rentPerDay, baseRent + 1500 + 5000);

  assert.equal(engine.dispatch({ type: 'business_premises_upgrade', businessId: biz.id }).ok, false, 'max tier');
});
