#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(dirname(fileURLToPath(import.meta.url))));
const REGISTRY_PATH = join(ROOT, 'public/world/registry.json');
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

let basePaths = requested;
if (basePaths.length === 0) {
  let registry;
  try {
    registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    console.error(`Could not read ${REGISTRY_PATH}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  if (!Array.isArray(registry.packs) || registry.packs.length === 0) {
    console.error('World registry has no packs to validate');
    process.exit(1);
  }
  basePaths = registry.packs.map((pack) => pack.basePath);
}

const register = join(ROOT, 'scripts/test-register.mjs');
const validator = join(ROOT, 'scripts/world-validate.mjs');
let failed = false;
for (const basePath of basePaths) {
  console.log(`\n== ${basePath} ==`);
  const result = spawnSync(process.execPath, ['--import', register, validator, basePath], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) {
    console.error(result.error.message);
    failed = true;
  } else if (result.status !== 0) {
    failed = true;
  }
}
if (failed) process.exit(1);
console.log('\nworld validation PASS');
