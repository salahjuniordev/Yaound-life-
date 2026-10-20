import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const BUDGETS = {
  jsGzip: 620 * 1024,
  cssGzip: 24 * 1024,
  htmlGzip: 5 * 1024,
  firstLoadGzip: 1024 * 1024,
};

function gzBytes(path) {
  return gzipSync(readFileSync(path), { level: 9 }).length;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const assets = files.filter((f) => /\.(js|css|html)$/.test(f));
if (assets.length === 0) {
  console.error('No js/css/html assets found in dist/.');
  process.exit(1);
}

const rows = assets.map((f) => ({
  file: f.slice(DIST.length),
  raw: statSync(f).size,
  gz: gzBytes(f),
}));

const sum = (list) => list.reduce((a, r) => a + r.gz, 0);
const js = rows.filter((r) => r.file.endsWith('.js'));
const css = rows.filter((r) => r.file.endsWith('.css'));
const html = rows.filter((r) => r.file.endsWith('.html'));

rows.sort((a, b) => b.gz - a.gz);
console.log('gzip sizes (bytes):');
for (const r of rows) console.log(`  ${String(r.gz).padStart(8)}  ${r.file}`);

const checks = [
  ['JS total', sum(js), BUDGETS.jsGzip],
  ['CSS total', sum(css), BUDGETS.cssGzip],
  ['HTML total', sum(html), BUDGETS.htmlGzip],
  ['First load (js+css+html)', sum(rows), BUDGETS.firstLoadGzip],
];

let failed = false;
console.log('\nbudgets:');
for (const [name, actual, limit] of checks) {
  const ok = actual <= limit;
  if (!ok) failed = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}: ${actual} / ${limit}`);
}

if (failed) {
  console.error('\nSize budget exceeded.');
  process.exit(1);
}
console.log('\nAll size budgets within limits.');
