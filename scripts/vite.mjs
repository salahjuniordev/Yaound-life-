import {
  existsSync,
  mkdirSync,
  copyFileSync,
  chmodSync,
  readdirSync,
  statSync,
  lstatSync,
  symlinkSync,
  readlinkSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const platform = process.platform === 'android' ? 'android' : process.platform;
const arch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : process.arch;
const isFuseRoot = root.startsWith('/storage/') || root.startsWith('/sdcard/');

function findEsbuild() {
  const candidates = [
    join(root, 'node_modules', '@esbuild', `${platform}-${arch}`, 'bin', 'esbuild'),
    join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
    join(root, 'node_modules', 'esbuild', `@esbuild-${platform}-${arch}`, 'bin', 'esbuild'),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

const esbuildSrc = findEsbuild();
if (esbuildSrc && process.platform === 'android') {
  const binDir = join(tmpdir(), 'yaounde-life-bin');
  const esbuildDst = join(binDir, 'esbuild');
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
  let dstReady = false;
  try {
    copyFileSync(esbuildSrc, esbuildDst);
    chmodSync(esbuildDst, 0o755);
    dstReady = true;
    console.log(`[dev-runner] esbuild relocated to ${esbuildDst}`);
  } catch (err) {
    try {
      if (existsSync(esbuildDst) && statSync(esbuildDst).size === statSync(esbuildSrc).size) {
        dstReady = true;
        console.warn(`[dev-runner] esbuild source busy (${err.code ?? err.message}); reusing relocated copy`);
      }
    } catch {}
    if (!dstReady) {
      console.warn('[dev-runner] could not relocate esbuild, using default path', err.message);
    }
  }
  if (dstReady) process.env.ESBUILD_BINARY_PATH = esbuildDst;
}

// ---------------------------------------------------------------------------
// Android/Termux: the esbuild Go binary cannot resolve files on the FUSE
// (/storage) mount, which breaks Vite's dep pre-bundling in dev. For `dev` we
// mirror the project (including node_modules) to internal storage and run Vite
// there, keeping the /storage copy as the source of truth via a sync watcher.
// `build` and `preview` work directly from /storage (rollup uses Node fs).
// ---------------------------------------------------------------------------
const SKIP_TOP = new Set(['dist', '.git', 'scripts', 'test', '.vite']);
const SYNC_INTERVAL_MS = 1500;

function sameFile(srcStat, dstPath) {
  try {
    const dstStat = statSync(dstPath);
    return dstStat.size === srcStat.size && Math.abs(dstStat.mtimeMs - srcStat.mtimeMs) < 1000;
  } catch {
    return false;
  }
}

function syncPath(src, dst, counters, topLevel = false) {
  let st;
  try {
    st = lstatSync(src);
  } catch {
    return;
  }
  if (st.isSymbolicLink()) {
    try {
      const target = readlinkSync(src);
      if (!existsSync(dst)) symlinkSync(target, dst);
    } catch {}
    counters.skipped++;
    return;
  }
  if (st.isDirectory()) {
    if (topLevel && SKIP_TOP.has(src.split('/').pop())) return;
    if (!existsSync(dst)) mkdirSync(dst, { recursive: true });
    let entries;
    try {
      entries = readdirSync(src, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      syncPath(join(src, entry.name), join(dst, entry.name), counters);
    }
    return;
  }
  if (!st.isFile()) return;
  if (sameFile(st, dst)) {
    counters.skipped++;
    return;
  }
  try {
    copyFileSync(src, dst);
    if (st.mode & 0o100) chmodSync(dst, 0o755);
    counters.copied++;
  } catch (err) {
    counters.failed++;
    if (counters.failed <= 3) console.warn(`[dev-runner] sync failed for ${src}: ${err.message}`);
  }
}

function syncProject(srcRoot, dstRoot) {
  const counters = { copied: 0, skipped: 0, failed: 0 };
  syncPath(srcRoot, dstRoot, counters, true);
  return counters;
}

function mirrorCountersSummary(counters) {
  return `${counters.copied} copied, ${counters.skipped} up-to-date${counters.failed ? `, ${counters.failed} failed` : ''}`;
}

const viteEntry = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(viteEntry)) {
  console.error(`[dev-runner] vite not found at ${viteEntry}. Run install first.`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) args.push('dev');
const command = args[0];
const rest = args.slice(1);

let spawnArgs = [viteEntry];
let cwd = root;

if (isFuseRoot && command === 'dev') {
  const mirrorRoot = join(tmpdir(), 'yaounde-life-dev');
  console.log(`[dev-runner] syncing project to ${mirrorRoot} (Android FUSE workaround)...`);
  const started = Date.now();
  const first = syncProject(root, mirrorRoot);
  console.log(`[dev-runner] initial sync: ${mirrorCountersSummary(first)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const syncTargets = ['src', 'public', 'node_modules/.vite', 'index.html', 'package.json', 'vite.config.ts', 'tsconfig.json'];
  let syncing = false;
  const timer = setInterval(() => {
    if (syncing) return;
    syncing = true;
    try {
      for (const rel of syncTargets) {
        const src = join(root, rel);
        if (existsSync(src)) syncPath(src, join(mirrorRoot, rel), { copied: 0, skipped: 0, failed: 0 }, false);
      }
    } finally {
      syncing = false;
    }
  }, SYNC_INTERVAL_MS);
  timer.unref?.();

  spawnArgs.push(command, ...rest);
  cwd = mirrorRoot;
} else if (isFuseRoot) {
  cwd = join(tmpdir(), 'yaounde-life-cwd');
  if (!existsSync(cwd)) mkdirSync(cwd, { recursive: true });
  const configPath = join(root, 'vite.config.ts');
  const postArgs = [root];
  if (existsSync(configPath)) postArgs.push('--config', configPath);
  spawnArgs.push(command, ...rest, ...postArgs);
} else {
  spawnArgs.push(command, ...rest);
}

const result = spawnSync(process.execPath, spawnArgs, {
  stdio: 'inherit',
  cwd,
  env: process.env,
});
process.exit(result.status ?? 1);
