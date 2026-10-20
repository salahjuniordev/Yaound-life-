import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/sim/engine';
import { dayOfYearFor, holidayForDay, monthDayFor, HOLIDAYS } from '../src/data/calendar';
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

test('calendar maps days to 30-day months over a 360-day year', () => {
  assert.deepEqual(monthDayFor(1), { month: 1, dayOfMonth: 1 });
  assert.deepEqual(monthDayFor(30), { month: 1, dayOfMonth: 30 });
  assert.deepEqual(monthDayFor(31), { month: 2, dayOfMonth: 1 });
  assert.deepEqual(monthDayFor(41), { month: 2, dayOfMonth: 11 });
  assert.deepEqual(monthDayFor(355), { month: 12, dayOfMonth: 25 });
  assert.equal(dayOfYearFor(361), 1, 'year wraps after 360 days');
  for (const h of HOLIDAYS) {
    assert.ok(h.month >= 1 && h.month <= 12 && h.dayOfMonth >= 1 && h.dayOfMonth <= 30, `${h.id} date valid`);
  }
});

test('holidayForDay finds holidays and rejects ordinary days', () => {
  assert.equal(holidayForDay(41)?.id, 'youth_day');
  assert.equal(holidayForDay(355)?.id, 'christmas');
  assert.equal(holidayForDay(361)?.id, 'new_year');
  assert.equal(holidayForDay(42), null);
});

test('national holidays queue the parade event and count as seen', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.day = 41;
  engine.onNewDay();
  assert.equal(state.storyFlags['holiday_today'], 'youth_day');
  assert.equal(state.storyFlags['holidays_seen'], 1);
  assert.ok(state.pendingEvents.some((e) => e.templateId === 'holiday_parade'));
  assert.ok(state.phone.notifications.some((n) => n.title === 'Youth Day'));
});

test('religious holidays queue the family feast and clear on ordinary days', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.day = 355;
  engine.onNewDay();
  assert.ok(state.pendingEvents.some((e) => e.templateId === 'holiday_family_feast'));

  state.world.day = 356;
  state.pendingEvents = [];
  engine.onNewDay();
  assert.equal(state.storyFlags['holiday_today'], undefined, 'flag cleared');
  assert.equal(state.storyFlags['holidays_seen'], 1, 'not counted twice');
  assert.equal(state.pendingEvents.length, 0, 'no feast on a normal day');
});

test('holiday shifts pay the festive multiplier', () => {
  const festive = makeState();
  const engine = new GameEngine(festive);
  takeJob(festive, 'cyber_attendant');
  festive.world.day = 41;
  festive.world.minute = 9 * 60;
  const before = festive.wallet.cash;
  engine.dispatch({ type: 'work_shift', jobId: 'cyber_attendant' });
  assert.equal(festive.wallet.cash - before, 3200 * 1.5, 'youth day pays x1.5');

  const normal = makeState();
  const engine2 = new GameEngine(normal);
  takeJob(normal, 'cyber_attendant');
  normal.world.day = 42;
  normal.world.minute = 9 * 60;
  const before2 = normal.wallet.cash;
  engine2.dispatch({ type: 'work_shift', jobId: 'cyber_attendant' });
  assert.equal(normal.wallet.cash - before2, 3200, 'ordinary day pays base');
});
