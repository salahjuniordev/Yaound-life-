import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/sim/engine';
import { JOBS, JOB_MAP, SENIOR_JOB_IDS } from '../src/data/jobs';
import { ACTIVITIES, ACTIVITY_MAP } from '../src/data/activities';
import { PLACES } from '../src/data/places';
import { ZONES } from '../src/data/districts';
import { makeState } from './helpers';

const DISTRICT_IDS = new Set(ZONES.map((d) => d.id));

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

test('career job data is consistent', () => {
  const ids = JOBS.map((j) => j.id);
  assert.equal(new Set(ids).size, ids.length, 'job ids unique');
  for (const job of JOBS) {
    assert.ok(DISTRICT_IDS.has(job.district), `${job.id} has valid district`);
    assert.ok(JOB_MAP[job.id], `${job.id} in JOB_MAP`);
    assert.ok(
      PLACES.some((place) => place.district === job.district && place.kind !== 'taxi'),
      `${job.id} district should have a non-taxi place`,
    );
  }
  for (const id of SENIOR_JOB_IDS) assert.ok(JOB_MAP[id], `senior job ${id} exists`);
  for (const a of ACTIVITIES) assert.ok(ACTIVITY_MAP[a.id], `${a.id} in ACTIVITY_MAP`);
  for (const place of PLACES) {
    for (const activityId of place.activities ?? []) {
      assert.ok(ACTIVITY_MAP[activityId], `${place.id} references unknown activity ${activityId}`);
    }
  }
});

test('Boulevard, Lac Municipal and Mont Febe have playable content parity', () => {
  const districts = ['boulevard', 'lac_municipal', 'mont_febe'] as const;
  for (const district of districts) {
    const places = PLACES.filter((place) => place.district === district);
    const jobs = JOBS.filter((job) => job.district === district);
    assert.ok(places.filter((place) => place.kind !== 'taxi').length >= 4, `${district} needs at least four non-taxi places`);
    assert.ok(places.some((place) => place.kind === 'taxi'), `${district} needs a taxi point`);
    assert.ok(jobs.length >= 2, `${district} needs at least two jobs`);
    assert.ok(
      places.some((place) => place.interior || place.vendor || (place.activities?.length ?? 0) > 0),
      `${district} needs at least one enterable, vendor or activity place`,
    );
  }
});

test('working a shift trains the job skill', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  takeJob(state, 'cyber_attendant');
  state.world.minute = 9 * 60;
  const res = engine.dispatch({ type: 'work_shift', jobId: 'cyber_attendant' });
  assert.equal(res.ok, true);
  assert.ok(state.player.skills.tech > 0, 'tech XP from shift');
  assert.equal(state.player.job!.shiftsWorked, 1);
});

test('career gigs are gated by skill level and pay by skill', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.world.minute = 9 * 60;

  state.player.skills.tech = 2;
  assert.equal(engine.dispatch({ type: 'activity', activityId: 'dev_contract' }).ok, false, 'tech 2 locked');

  state.player.skills.tech = 3;
  const before = state.wallet.cash;
  assert.equal(engine.dispatch({ type: 'activity', activityId: 'dev_contract' }).ok, true);
  assert.equal(state.player.skills.tech, 5.5, 'gig trains tech with diminishing returns');
  assert.equal(state.wallet.cash - before, 16650, 'income scales with post-gain skill (5.5 -> +11%)');
  assert.equal(state.stats.gigsDone, 1);
});

test('crossing a skill threshold unlocks gated jobs once', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(state.storyFlags['jobunlock_teacher_assistant'], undefined, 'not qualified at academics 0');

  state.player.skills.academics = 3;
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(state.storyFlags['jobunlock_teacher_assistant'], 1);
  const count = state.phone.notifications.filter((n) => n.title.includes("Teacher's Assistant")).length;
  assert.equal(count, 1);

  engine.dispatch({ type: 'notification_read', id: 'nope' });
  assert.equal(state.phone.notifications.filter((n) => n.title.includes("Teacher's Assistant")).length, 1, 'no duplicate notice');
});

test('senior role goal completes when hired senior', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  state.activeGoals.push({ id: 'senior_role', status: 'active', progress: 0, target: 1 });
  takeJob(state, 'senior_software_engineer');
  engine.dispatch({ type: 'notification_read', id: 'nope' });
  const goal = state.activeGoals.find((g) => g.id === 'senior_role')!;
  assert.equal(goal.status, 'completed');
});
