import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/sim/engine';
import { ledgerTotals, weeklyBudgetView } from '../src/sim/budget';
import { districtPrice } from '../src/sim/economy';
import { migrateState } from '../src/sim/state';
import { BUSINESS_MAP, STAFF_DAILY_WAGE } from '../src/data/businesses';
import type { BusinessState, GameState, LedgerEntry } from '../src/sim/types';
import { makeState } from './helpers';

let seq = 0;
function entry(partial: Partial<LedgerEntry>): LedgerEntry {
  seq += 1;
  return {
    id: `l${seq}`,
    day: 1,
    minute: 420,
    kind: 'expense',
    category: 'food',
    amount: -100,
    counterparty: 'test',
    note: 'test entry',
    wallet: 'cash',
    balanceAfter: 0,
    ...partial,
  };
}

function makeBiz(state: GameState, overrides: Partial<BusinessState> = {}): BusinessState {
  const kind = overrides.kind ?? 'food_stall';
  const def = BUSINESS_MAP[kind];
  const biz: BusinessState = {
    id: 'biz_test',
    kind,
    name: 'Test shop',
    district: state.player.district,
    rentPerDay: def.rentPerDay,
    priceLevel: 1,
    stock: {},
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
    ...overrides,
  };
  state.businesses.push(biz);
  return biz;
}

test('ledgerTotals buckets categories and respects the day window', () => {
  const ledger = [
    entry({ day: 2, category: 'food', amount: -500 }),
    entry({ day: 5, category: 'business_revenue', amount: 3000 }),
    entry({ day: 9, category: 'food', amount: -500 }),
  ];
  const totals = ledgerTotals(ledger, 4, 10);
  assert.equal(totals.food.expense, 500);
  assert.equal(totals.business.income, 3000);
});

test('weeklyBudgetView compares planned vs actual and finds the biggest expense', () => {
  const state = makeState();
  state.world.day = 10;
  state.ledger = [
    entry({ day: 2, category: 'food', amount: -900 }),
    entry({ day: 5, category: 'transport', amount: -1200 }),
    entry({ day: 9, category: 'food', amount: -400 }),
    entry({ day: 9, category: 'sales', amount: 2500 }),
  ];
  state.budget.planned = { food: 1000, transport: 500 };
  const view = weeklyBudgetView(state);
  assert.equal(view.sinceDay, 4);
  assert.equal(view.untilDay, 10);
  assert.equal(view.expense, 1600);
  assert.equal(view.income, 2500);
  assert.equal(view.byCategory.food.planned, 1000);
  assert.equal(view.byCategory.food.expense, 400);
  assert.equal(view.byCategory.transport.expense, 1200);
  assert.equal(view.biggestExpense, 'transport');
  assert.equal(view.plannedTotal, 1500);
});

test('savings goals hold, release and complete money', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 10000;

  assert.equal(engine.dispatch({ type: 'savings_goal_add', name: 'Moto', target: 3000 }).ok, true);
  assert.equal(engine.dispatch({ type: 'savings_goal_add', name: 'Bad', target: 500 }).ok, false);
  const goal = state.budget.goals[0];
  assert.ok(goal);

  assert.equal(engine.dispatch({ type: 'savings_goal_deposit', goalId: goal.id, amount: 2000 }).ok, true);
  assert.equal(state.wallet.cash, 8000);
  assert.equal(goal.saved, 2000);
  assert.equal(goal.done, false);

  assert.equal(engine.dispatch({ type: 'savings_goal_deposit', goalId: goal.id, amount: 1000 }).ok, true);
  assert.equal(goal.saved, 3000);
  assert.equal(goal.done, true);
  assert.ok(state.milestones.some((m) => m.includes('Moto')), 'reaching the goal should be a milestone');

  assert.equal(engine.dispatch({ type: 'savings_goal_withdraw', goalId: goal.id, amount: 500 }).ok, true);
  assert.equal(goal.saved, 2500);
  assert.equal(goal.done, false);
  assert.equal(state.wallet.cash, 7500);

  assert.equal(engine.dispatch({ type: 'savings_goal_delete', goalId: goal.id }).ok, true);
  assert.equal(state.budget.goals.length, 0);
  assert.equal(state.wallet.cash, 10000, 'closing a goal returns its balance');
});

test('depositing more cash than you hold fails cleanly', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.wallet.cash = 0;
  state.wallet.momo = 0;
  state.wallet.bank = 0;
  engine.dispatch({ type: 'savings_goal_add', name: 'Rent', target: 5000 });
  const goal = state.budget.goals[0];
  const res = engine.dispatch({ type: 'savings_goal_deposit', goalId: goal.id, amount: 1000 });
  assert.equal(res.ok, false);
  assert.equal(goal.saved, 0);
});

test('content reports are stored locally and validated', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  assert.equal(engine.dispatch({ type: 'report_content', kind: 'event', refId: 'evt_x', note: '   ' }).ok, false);
  assert.equal(engine.dispatch({ type: 'report_content', kind: 'event', refId: 'evt_x', note: 'The fare is wrong' }).ok, true);
  assert.equal(state.reports.length, 1);
  assert.equal(state.reports[0].kind, 'event');
  assert.equal(state.reports[0].refId, 'evt_x');
  assert.equal(state.reports[0].note, 'The fare is wrong');

  for (let i = 0; i < 110; i++) {
    engine.dispatch({ type: 'report_content', kind: 'glossary', refId: `term_${i}`, note: 'note' });
  }
  assert.equal(state.reports.length, 100, 'reports queue is capped');
});

test('suppliers change stock pricing, minimums and delivery timing', () => {
  const stateA = makeState();
  const engineA = new GameEngine(stateA);
  stateA.wallet.cash = 100000;
  const biz = makeBiz(stateA, { kind: 'grocery', openToday: false, stock: { rice_kg: 0 } });
  const unit = districtPrice(stateA, biz.district, 550);

  const before = stateA.wallet.cash;
  const resNeighbourhood = engineA.dispatch({ type: 'business_buy_stock', businessId: biz.id, itemId: 'rice_kg', qty: 10, supplier: 'neighbourhood' });
  assert.equal(resNeighbourhood.ok, true);
  assert.equal(before - stateA.wallet.cash, unit * 10);
  assert.ok((biz.stock.rice_kg ?? 0) >= 1);

  const beforeHaggle = stateA.wallet.cash;
  const resHaggle = engineA.dispatch({ type: 'business_buy_stock', businessId: biz.id, itemId: 'rice_kg', qty: 10, supplier: 'haggle_market' });
  assert.equal(resHaggle.ok, true);
  assert.equal(beforeHaggle - stateA.wallet.cash, Math.round(unit * 0.82) * 10, 'haggling should be cheaper per unit');

  const resTooSmall = engineA.dispatch({ type: 'business_buy_stock', businessId: biz.id, itemId: 'rice_kg', qty: 10, supplier: 'bulk_order' });
  assert.equal(resTooSmall.ok, false, 'bulk order enforces a minimum quantity');

  const stockBefore = biz.stock.rice_kg ?? 0;
  const beforeBulk = stateA.wallet.cash;
  const resBulk = engineA.dispatch({ type: 'business_buy_stock', businessId: biz.id, itemId: 'rice_kg', qty: 30, supplier: 'bulk_order' });
  assert.equal(resBulk.ok, true);
  assert.equal(beforeBulk - stateA.wallet.cash, Math.round(unit * 0.7) * 30);
  assert.equal(biz.stock.rice_kg, stockBefore, 'bulk orders arrive later, not instantly');
  assert.equal(biz.pendingDeliveries.length, 1);

  stateA.world.day += 1;
  engineA.onNewDay();
  assert.equal(biz.pendingDeliveries.length, 0, 'delivery arrives the next day');
  const delivered = (biz.stock.rice_kg ?? 0) - stockBefore;
  assert.ok(delivered >= 22 && delivered <= 30, `bulk delivery should be 22-30 units, got ${delivered}`);
  assert.equal(biz.stockQuality, 'good');
});

test('perishable stock spoils a forgiving fraction overnight', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const biz = makeBiz(state, { openToday: false, stock: { beignets_haricots: 20 } });
  state.world.day += 1;
  engine.onNewDay();
  assert.equal(biz.stock.beignets_haricots, 14, '30% of day-1 perishables spoil');
  assert.ok(biz.costsToday >= 6 * 180, 'spoilage is tracked in costs');
});

test('staff wages are paid daily and unpaid wages destroy morale', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const biz = makeBiz(state, { openToday: false, staffIds: ['brandon'], staffInfo: { brandon: { morale: 70, skill: 2 } } });
  state.wallet.cash = 100000;
  state.world.day += 1;
  engine.onNewDay();
  assert.equal(biz.staffInfo.brandon.morale, 72, 'paid wages lift morale');
  assert.ok(biz.costsToday >= STAFF_DAILY_WAGE);

  const state2 = makeState();
  const engine2 = new GameEngine(state2);
  const biz2 = makeBiz(state2, { openToday: false, staffIds: ['brandon'], staffInfo: { brandon: { morale: 70, skill: 2 } } });
  state2.wallet.cash = 0;
  state2.wallet.momo = 0;
  state2.wallet.bank = 0;
  state2.world.day += 1;
  engine2.onNewDay();
  assert.equal(biz2.staffInfo.brandon.morale, 50);
  state2.world.day += 1;
  engine2.onNewDay();
  assert.equal(biz2.staffInfo.brandon.morale, 30);
  state2.world.day += 1;
  engine2.onNewDay();
  assert.equal(biz2.staffIds.length, 0, 'employee quits after repeated unpaid wages');
  assert.equal(biz2.staffInfo.brandon, undefined);
});

test('staff bonuses and training raise morale and skill', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const biz = makeBiz(state, { staffIds: ['brandon'], staffInfo: { brandon: { morale: 70, skill: 2 } } });
  state.wallet.cash = 100000;

  assert.equal(engine.dispatch({ type: 'business_staff_bonus', businessId: biz.id, npcId: 'brandon', amount: 1000 }).ok, true);
  assert.equal(biz.staffInfo.brandon.morale, 75);
  assert.equal(engine.dispatch({ type: 'business_staff_bonus', businessId: biz.id, npcId: 'brandon', amount: 100 }).ok, false);

  assert.equal(engine.dispatch({ type: 'business_train_staff', businessId: biz.id, npcId: 'brandon' }).ok, true);
  assert.equal(biz.staffInfo.brandon.skill, 3);
  biz.staffInfo.brandon.skill = 5;
  assert.equal(engine.dispatch({ type: 'business_train_staff', businessId: biz.id, npcId: 'brandon' }).ok, false);
});

test('marketing campaigns cost money, expire, and social needs posts', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const biz = makeBiz(state);
  state.wallet.cash = 100000;

  const blocked = engine.dispatch({ type: 'business_marketing', businessId: biz.id, campaign: 'social' });
  assert.equal(blocked.ok, false, 'social campaign needs prior posts');
  state.stats.socialPosts = 3;
  assert.equal(engine.dispatch({ type: 'business_marketing', businessId: biz.id, campaign: 'social' }).ok, true);
  assert.equal(biz.marketing?.boost, 1.2);

  const before = state.wallet.cash;
  assert.equal(engine.dispatch({ type: 'business_marketing', businessId: biz.id, campaign: 'flyers' }).ok, true);
  assert.equal(before - state.wallet.cash, 2000);
  assert.equal(biz.marketing?.untilDay, state.world.day + 3);

  state.world.day = biz.marketing!.untilDay + 1;
  engine.onNewDay();
  assert.equal(biz.marketing, null, 'expired campaigns clear out');
});

test('migrateState backfills budget, reports and business fields for old saves', () => {
  const base = makeState();
  makeBiz(base);
  const raw = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  const rawBiz = (raw.businesses as Record<string, unknown>[])[0];
  delete rawBiz.stockQuality;
  delete rawBiz.staffInfo;
  delete rawBiz.marketing;
  delete rawBiz.pendingDeliveries;
  delete raw.budget;
  delete raw.reports;

  const migrated = migrateState(raw);
  assert.ok(migrated);
  assert.deepEqual(migrated!.budget, { planned: {}, goals: [] });
  assert.deepEqual(migrated!.reports, []);
  assert.equal(migrated!.businesses[0].stockQuality, 'ok');
  assert.deepEqual(migrated!.businesses[0].pendingDeliveries, []);
  assert.equal(migrated!.businesses[0].marketing, null);
});

test('weekly summary notification fires on Sundays when there is activity', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.ledger.push(entry({ day: 3, category: 'food', amount: -1500 }));
  state.world.day = 7;
  state.world.dayOfWeek = 0;
  engine.onNewDay();
  const notif = state.phone.notifications.find((n) => n.title === 'Weekly budget summary');
  assert.ok(notif, 'weekly summary notification should be sent');
  assert.match(notif!.body, /1,500/);
});
