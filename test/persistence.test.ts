import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportSaveJSON, importSaveJSON } from '../src/persistence/idb';
import { makeState } from './helpers';

test('export/import save round-trips a full state', () => {
  const state = makeState();
  const json = exportSaveJSON(state);
  assert.ok(json.includes('yaounde-life-save'));
  const loaded = importSaveJSON(json);
  assert.ok(loaded);
  assert.equal(loaded!.characterId, state.characterId);
  assert.equal(loaded!.world.day, state.world.day);
  assert.equal(loaded!.player.name, state.player.name);
});

test('import accepts a raw state object and rejects invalid payloads', () => {
  const state = makeState();
  const raw = importSaveJSON(JSON.stringify(state));
  assert.ok(raw);
  assert.equal(raw!.characterId, state.characterId);

  assert.equal(importSaveJSON('not json at all'), null);
  assert.equal(importSaveJSON(JSON.stringify({ hello: 'world' })), null);
  assert.equal(importSaveJSON(JSON.stringify({ kind: 'other-game', state })), null);
});
