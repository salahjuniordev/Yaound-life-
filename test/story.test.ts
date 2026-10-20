import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, qualificationReport } from '../src/sim/engine';
import type { GameState } from '../src/sim/types';
import { makeState } from './helpers';

function withCash(state: GameState, cash: number): GameState {
  state.wallet.cash = cash;
  return state;
}

test('exam registration validates level, academics and fees', () => {
  const state = withCash(makeState(), 50000);
  const engine = new GameEngine(state);

  assert.equal(engine.dispatch({ type: 'exam_register', trackId: 'probatoire' }).ok, false, 'needs academics 1');
  state.player.skills.academics = 1;

  assert.equal(engine.dispatch({ type: 'exam_register', trackId: 'bac' }).ok, false, 'bac needs Probatoire first');

  const before = state.wallet.cash;
  assert.equal(engine.dispatch({ type: 'exam_register', trackId: 'probatoire' }).ok, true);
  assert.equal(before - state.wallet.cash, 5000);
  assert.equal(state.storyFlags['exam_track'], 'probatoire');
  assert.equal(Number(state.storyFlags['exam_day']), state.world.day + 3);

  assert.equal(engine.dispatch({ type: 'exam_register', trackId: 'probatoire' }).ok, false, 'no double registration');
});

test('exam cannot be taken on the wrong day or in the wrong district', () => {
  const state = withCash(makeState(), 50000);
  const engine = new GameEngine(state);
  state.player.skills.academics = 6;
  assert.equal(engine.dispatch({ type: 'exam_register', trackId: 'probatoire' }).ok, true);

  assert.equal(engine.dispatch({ type: 'exam_take' }).ok, false, 'too early');

  state.world.day = Number(state.storyFlags['exam_day']);
  state.player.district = 'bastos';
  assert.equal(engine.dispatch({ type: 'exam_take' }).ok, false, 'wrong district');

  state.player.district = 'mvog_mbi';
  assert.equal(engine.dispatch({ type: 'exam_take' }).ok, true);
});

test('passing an exam raises the education level and unlocks jobs', () => {
  const state = withCash(makeState(), 50000);
  const engine = new GameEngine(state);
  state.player.skills.academics = 6;
  engine.dispatch({ type: 'exam_register', trackId: 'probatoire' });
  state.world.day = Number(state.storyFlags['exam_day']);
  state.player.district = 'mvog_mbi';

  const res = engine.dispatch({ type: 'exam_take' });
  assert.equal(res.ok, true);
  assert.equal(state.player.education.level, 'Probatoire');
  assert.equal(state.player.skills.academics, 7, 'passing teaches something');
  assert.equal(state.storyFlags['exam_result'], 'pass');
  assert.equal(state.storyFlags['exam_track'], undefined);
  assert.equal(state.player.education.examReady, false);
  assert.ok(state.milestones.some((m) => m.includes('Probatoire')));

  const report = qualificationReport(state, 'school_administrator');
  assert.equal(report.missing.some((m) => m.includes('Bac')), true, 'still needs the Bac');
});

test('failing an exam keeps your level and explains recovery', () => {
  const state = withCash(makeState(), 50000);
  const engine = new GameEngine(state);
  state.player.skills.academics = 1;
  engine.dispatch({ type: 'exam_register', trackId: 'probatoire' });
  state.player.skills.academics = 0;
  state.world.day = Number(state.storyFlags['exam_day']);
  state.player.district = 'mvog_mbi';

  const res = engine.dispatch({ type: 'exam_take' });
  assert.equal(res.ok, true);
  assert.equal(state.player.education.level, 'GCE A-Level');
  assert.equal(state.storyFlags['exam_result'], 'fail');
  const notif = state.phone.notifications.find((n) => n.title.includes('not this time'));
  assert.ok(notif, 'failure should explain recovery');
});

test('missing the exam day loses the fee and clears registration', () => {
  const state = withCash(makeState(), 50000);
  const engine = new GameEngine(state);
  state.player.skills.academics = 1;
  engine.dispatch({ type: 'exam_register', trackId: 'probatoire' });
  const examDay = Number(state.storyFlags['exam_day']);

  state.world.day = examDay + 1;
  engine.onNewDay();
  assert.equal(state.storyFlags['exam_result'], 'missed');
  assert.equal(state.storyFlags['exam_track'], undefined);
  const notif = state.phone.notifications.find((n) => n.title.includes('missed'));
  assert.ok(notif);
});

test('the Concours gates the public service job', () => {
  const state = makeState();
  state.player.skills.academics = 4;
  assert.equal(qualificationReport(state, 'public_service').qualifies, false);
  assert.ok(qualificationReport(state, 'public_service').missing.some((m) => m.includes('Concours')));

  state.player.education.level = 'Concours réussi';
  assert.equal(qualificationReport(state, 'public_service').qualifies, true);

  state.player.education.level = 'Bac';
  state.player.skills.management = 2;
  assert.equal(qualificationReport(state, 'school_administrator').qualifies, true, 'Bac unlocks the school office');
});

test('story chain A completes through the tutorial flags', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.storyFlags['tutorialStep'] = 5;
  state.learnedRoutes.push('mokolo');
  state.ledger.push({
    id: 'l_story_a',
    day: 1,
    minute: 500,
    kind: 'income',
    category: 'gig',
    amount: 1500,
    counterparty: 'test',
    note: 'gig pay',
    wallet: 'cash',
    balanceAfter: 1500,
  });
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(Number(state.storyFlags['chain_A_step']), 4);
  assert.equal(state.storyFlags['chain_A_done'], 1);
  assert.ok(state.milestones.some((m) => m.includes('Story complete')));
});

test('story chain D tracks opening, stocking and selling', () => {
  const state = withCash(makeState(), 100000);
  const engine = new GameEngine(state);
  assert.equal(engine.dispatch({ type: 'business_open', kind: 'food_stall', name: 'Story stall' }).ok, true);
  assert.equal(Number(state.storyFlags['chain_D_step']), 1);

  const biz = state.businesses[0];
  assert.equal(engine.dispatch({ type: 'business_buy_stock', businessId: biz.id, itemId: 'soya', qty: 10 }).ok, true);
  assert.ok(Number(state.storyFlags['chain_D_step']) >= 2);

  state.ledger.push({
    id: 'l_story_d',
    day: state.world.day,
    minute: 700,
    kind: 'income',
    category: 'business_revenue',
    amount: 2400,
    counterparty: 'Story stall',
    note: 'customers',
    wallet: 'cash',
    balanceAfter: 0,
  });
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(Number(state.storyFlags['chain_D_step']), 3);
  assert.equal(state.storyFlags['chain_D_done'], 1);
});

test('story chain F advances on njangi join and first cycle', () => {
  const state = withCash(makeState(), 50000);
  const engine = new GameEngine(state);
  assert.equal(engine.dispatch({ type: 'njangi_join', groupId: 'njangi_mvog_reliable', turn: 'middle' }).ok, true);
  assert.equal(Number(state.storyFlags['chain_F_step']), 1);
  state.njangi.membership!.cyclesPaid = 1;
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(state.storyFlags['chain_F_done'], 1);
});

test('story chain G completes after three outage days, milestone once', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.storyFlags['outage_days_seen'] = 3;
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(state.storyFlags['chain_G_done'], 1);
  const count = state.milestones.filter((m) => m.includes('power cuts')).length;
  assert.equal(count, 1);
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(state.milestones.filter((m) => m.includes('power cuts')).length, 1, 'milestone only once');
});

test('story chain H completes only on a passed exam', () => {
  const state = withCash(makeState(), 50000);
  const engine = new GameEngine(state);
  state.player.skills.academics = 6;
  engine.dispatch({ type: 'exam_register', trackId: 'probatoire' });
  assert.equal(Number(state.storyFlags['chain_H_step']), 1);
  assert.equal(state.storyFlags['chain_H_done'], undefined);

  state.world.day = Number(state.storyFlags['exam_day']);
  state.player.district = 'mvog_mbi';
  engine.dispatch({ type: 'exam_take' });
  assert.equal(state.storyFlags['chain_H_done'], 1);
});
