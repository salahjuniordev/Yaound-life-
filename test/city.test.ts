import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, getTravelPlan, getVendorStock } from '../src/sim/engine';
import { activeCityPolicy } from '../src/sim/city';
import { makeState } from './helpers';
import type { DistrictId } from '../src/sim/types';
import { ZONES } from '../src/data/districts';

function otherZone(current: DistrictId): DistrictId {
  const zone = ZONES.find((z) => z.id !== current);
  assert.ok(zone);
  return zone.id;
}

test('fresh city hall starts with a ballot and an election on day 7', () => {
  const state = makeState();
  assert.equal(state.city.electionDay, 7);
  assert.equal(state.city.votingOpenDay, 4);
  assert.ok(state.city.candidates.length >= 4);
  assert.equal(state.city.policy, null);
});

test('voting is locked before the window and accepts one vote once open', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const candidate = state.city.candidates[0];
  assert.equal(engine.dispatch({ type: 'city_vote', candidateId: candidate.id }).ok, false);
  state.world.day = 4;
  const res = engine.dispatch({ type: 'city_vote', candidateId: candidate.id });
  assert.equal(res.ok, true);
  assert.equal(state.city.votedCandidateId, candidate.id);
  assert.equal(state.city.votes[candidate.id], 20);
  assert.equal(engine.dispatch({ type: 'city_vote', candidateId: candidate.id }).ok, false);
});

test('the election resolves on election day and applies a policy', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.day = 7;
  engine.onNewDay();
  assert.ok(state.city.lastResult);
  assert.ok(state.city.policy);
  assert.equal(state.city.electionDay, 14);
  assert.equal(state.city.votingOpenDay, 11);
  assert.ok(state.storyFlags['city_policy_label']);
  assert.equal(activeCityPolicy(state), state.city.policy);
});

test('city hall runs repeating cycles without stalling', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.day = 7;
  engine.onNewDay();
  const first = state.city.lastResult;
  assert.ok(first);
  assert.equal(first!.day, 7);
  state.world.day = 14;
  engine.onNewDay();
  assert.equal(state.city.lastResult?.day, 14);
  assert.equal(state.city.electionDay, 21);
});

test('transport subsidy cuts taxi and moto fares by 25 percent', () => {
  const state = makeState();
  const to = otherZone(state.player.district);
  const before = getTravelPlan(state, state.player.district, to);
  state.city.policy = 'transport_subsidy';
  state.city.policyUntilDay = 30;
  const after = getTravelPlan(state, state.player.district, to);
  const beforeTaxi = before.options.find((o) => o.mode === 'taxi');
  const afterTaxi = after.options.find((o) => o.mode === 'taxi');
  assert.ok(beforeTaxi && afterTaxi);
  assert.equal(afterTaxi!.cost, Math.round(beforeTaxi!.cost * 0.75));
});

test('food discount lowers vendor prices for food but not goods', () => {
  const state = makeState();
  state.city.policy = 'food_discount';
  state.city.policyUntilDay = 30;
  const stock = getVendorStock(state, 'street_food', state.player.district);
  const food = stock.find((s) => s.itemId === 'beignets_haricots');
  assert.ok(food);
  const plain = makeState();
  const base = getVendorStock(plain, 'street_food', plain.player.district).find((s) => s.itemId === 'beignets_haricots');
  assert.ok(base);
  assert.equal(food!.price, Math.round(base!.price * 0.85));
});

test('a player can declare, campaign and vote for themselves', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 100000;
  state.world.day = 4;
  const run = engine.dispatch({ type: 'city_run', policy: 'minimum_wage' });
  assert.equal(run.ok, true);
  assert.equal(state.city.playerRunning, true);
  assert.ok(state.city.candidates.some((c) => c.id === 'player'));
  const before = state.city.candidates.find((c) => c.id === 'player')!.popularity;
  const rally = engine.dispatch({ type: 'city_campaign', amount: 10000 });
  assert.equal(rally.ok, true);
  assert.ok(state.city.candidates.find((c) => c.id === 'player')!.popularity > before);
  assert.equal(engine.dispatch({ type: 'city_vote', candidateId: 'player' }).ok, true);
  assert.equal(state.city.votedCandidateId, 'player');
});

test('home furniture raises comfort and gives a morning mood bonus', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 100000;
  const res = engine.dispatch({ type: 'home_buy', itemId: 'bed_frame' });
  assert.equal(res.ok, true);
  assert.equal(state.home.comfort, 10);
  assert.ok(state.home.items.includes('bed_frame'));
  state.player.needs.mood = 50;
  state.player.needs.energy = 50;
  engine.onNewDay();
  assert.ok(state.player.needs.mood > 50);
  assert.ok(state.player.needs.energy > 50);
  const sold = engine.dispatch({ type: 'home_sell', itemId: 'bed_frame' });
  assert.equal(sold.ok, true);
  assert.equal(state.home.comfort, 0);
});

test('social posts appear in the feed and can be liked', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.phone.dataCreditMb = 100;
  const res = engine.dispatch({ type: 'social_post', text: 'First morning in Yaounde.' });
  assert.equal(res.ok, true);
  const post = state.socialFeed[0];
  assert.equal(post.authorId, 'player');
  assert.equal(post.text, 'First morning in Yaounde.');
  const likesBefore = post.likes;
  const like = engine.dispatch({ type: 'social_like', postId: post.id });
  assert.equal(like.ok, true);
  assert.equal(post.likedByPlayer, true);
  assert.equal(post.likes, likesBefore + 1);
});
