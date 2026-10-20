import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GameEngine } from '../src/sim/engine';
import { makeState } from './helpers';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Files that may legitimately carry conversational content (player/NPC-authored
// messages, chat fixtures). Keep this list to messaging-only surfaces.
const MESSAGING_CONTENT_ALLOWLIST: string[] = [];

const SCAN_DIRS = ['src', 'public', 'scripts', 'supabase'];
const SCAN_FILES = ['index.html'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.html', '.js', '.mjs', '.json', '.svg', '.webmanifest', '.sql']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/u;

function collectFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(name)) out.push(...collectFiles(path));
    } else if (SCAN_EXTENSIONS.has(extname(name).toLowerCase())) {
      out.push(path);
    }
  }
  return out;
}

test('no decorative emojis or pictographs in game source or system UI', () => {
  const files = [...SCAN_DIRS.flatMap((d) => collectFiles(join(ROOT, d))), ...SCAN_FILES.map((f) => join(ROOT, f))];
  const offenders: string[] = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (MESSAGING_CONTENT_ALLOWLIST.includes(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      EMOJI_RE.lastIndex = 0;
      if (EMOJI_RE.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.equal(
    offenders.length,
    0,
    `Decorative emojis/pictographs are not allowed outside messaging content:\n${offenders.join('\n')}`,
  );
});

test('player-authored messages keep emojis intact', () => {
  const state = makeState();
  const engine = new GameEngine(state);
  const npcId = Object.keys(state.npcs)[0];
  assert.ok(npcId, 'expected seeded NPCs');
  const text = 'See you tonight 😀🎉🇨🇲';
  const res = engine.dispatch({ type: 'message_send', npcId, text });
  assert.equal(res.ok, true);
  const stored = state.messages.find((m) => m.from === 'player');
  assert.ok(stored, 'player message was stored');
  assert.equal(stored.text, text);
});
