import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('the game canvas owns a definite fullscreen box', () => {
  const block = CSS.match(/\.game-canvas\s*\{([^}]*)\}/);
  assert.ok(block, 'expected a .game-canvas rule');
  assert.match(block![1], /position:\s*absolute/);
  assert.match(block![1], /inset:\s*0/);
});
