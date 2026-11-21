import test from 'node:test';
import assert from 'node:assert/strict';
import { cityNewsFor } from '../src/sim/npcsim';
import { makeState } from './helpers';

test('city news prefers the published bulletin', () => {
  const state = makeState();
  state.world.headlines = ['Rain slows the commute.', 'Fuel settles at 887 FCFA.'];

  const news = cityNewsFor(state);

  assert.equal(news.length, 2);
  assert.deepEqual(
    news.map((item) => item.text),
    ['Rain slows the commute.', 'Fuel settles at 887 FCFA.'],
  );
  assert.deepEqual(
    news.map((item) => item.textFr),
    ['Rain slows the commute.', 'Fuel settles at 887 FCFA.'],
  );
});

test('city news falls back to the local newsroom when no bulletin exists', () => {
  const state = makeState();
  state.world.headlines = [];

  const first = cityNewsFor(state);
  const second = cityNewsFor(state);

  assert.equal(first.length, 3);
  assert.ok(first.every((item) => item.text.length > 0 && item.textFr.length > 0));
  assert.deepEqual(first, second);
});
