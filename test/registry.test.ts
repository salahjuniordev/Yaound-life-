import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ZONES } from '../src/data/districts';
import { exportSaveJSON, importSaveJSON } from '../src/persistence/idb';
import { loadManifest, loadWorldRegistry, WorldLoadError } from '../src/world/loader';
import {
  BUILTIN_WORLD_REGISTRY,
  WORLD_REGISTRY_FORMAT,
  WORLD_REGISTRY_VERSION,
  assertWorldPackManifest,
  compatibleWorldPackForDistrict,
  validateWorldPackRegistry,
  worldPackBaseUrl,
  worldPackCompatibilityError,
  worldPackForDistrict,
  type WorldPackRegistry,
} from '../src/world/registry';
import { makeState } from './helpers';

const PUBLIC = new URL('../public/', import.meta.url);

function registry(): WorldPackRegistry {
  return {
    format: WORLD_REGISTRY_FORMAT,
    formatVersion: WORLD_REGISTRY_VERSION,
    generatedAt: '2026-11-16T00:00:00.000Z',
    packs: [{
      id: 'nlongkak',
      districtId: 'nlongkak',
      name: 'Nlongkak',
      basePath: 'world/v1',
      worldVersion: 'nlongkak-test-v1',
      manifestFormatVersion: 1,
      precacheOnInstall: true,
    }],
  };
}

test('registry validates packs, paths and compatibility', () => {
  const valid = registry();
  assert.deepEqual(validateWorldPackRegistry(valid), valid);
  assert.deepEqual(validateWorldPackRegistry({ ...valid, packs: [{ ...valid.packs[0], basePath: '/world/v1/' }] }).packs[0].basePath, 'world/v1');
  assert.throws(() => validateWorldPackRegistry({ ...valid, format: 'other' }));
  assert.throws(() => validateWorldPackRegistry({ ...valid, formatVersion: 2 }));
  assert.throws(() => validateWorldPackRegistry({ ...valid, packs: [valid.packs[0], valid.packs[0]] }));
  assert.throws(() => validateWorldPackRegistry({ ...valid, packs: [{ ...valid.packs[0], id: 'Bad Id' }] }));
  assert.throws(() => validateWorldPackRegistry({ ...valid, packs: [valid.packs[0], { ...valid.packs[0], id: 'other', districtId: 'mokolo' }] }));
  assert.throws(() => validateWorldPackRegistry({ ...valid, packs: [{ ...valid.packs[0], basePath: '../outside' }] }));
  assert.throws(() => validateWorldPackRegistry({ ...valid, packs: [{ ...valid.packs[0], basePath: 'https://evil.test/world' }] }));
  assert.throws(() => validateWorldPackRegistry({ ...valid, packs: [{ ...valid.packs[0], worldVersion: '../escape' }] }));
  assert.throws(() => validateWorldPackRegistry({ ...valid, packs: [{ ...valid.packs[0], precacheOnInstall: 'yes' }] }));
});

test('pack selection is keyed by district and rejects incompatible manifest formats', () => {
  const data = registry();
  assert.equal(worldPackForDistrict(data, 'nlongkak')?.id, 'nlongkak');
  assert.equal(worldPackForDistrict(data, 'mvog_mbi'), null);
  assert.equal(compatibleWorldPackForDistrict(data, 'nlongkak')?.id, 'nlongkak');

  const future = registry();
  future.packs[0].manifestFormatVersion = 2;
  assert.match(worldPackCompatibilityError(future.packs[0]) ?? '', /supports 1/);
  assert.equal(compatibleWorldPackForDistrict(future, 'nlongkak'), null);
  assert.equal(worldPackForDistrict(future, 'nlongkak')?.id, 'nlongkak');
});

test('registered pack manifests must match version and district', () => {
  const pack = registry().packs[0];
  assert.doesNotThrow(() => assertWorldPackManifest({
    worldVersion: 'nlongkak-test-v1',
    area: { id: 'nlongkak' },
  } as never, pack));
  assert.throws(() => assertWorldPackManifest({
    worldVersion: 'other-v1',
    area: { id: 'nlongkak' },
  } as never, pack), /does not match registered/);
  assert.throws(() => assertWorldPackManifest({
    worldVersion: 'nlongkak-test-v1',
    area: { id: 'mokolo' },
  } as never, pack), /does not match registered district/);
});

test('pack base URLs stay below the configured app base', () => {
  const pack = registry().packs[0];
  assert.equal(worldPackBaseUrl('/app/', pack), '/app/world/v1');
  assert.equal(worldPackBaseUrl('/app', pack), '/app/world/v1');
  assert.equal(worldPackBaseUrl('https://game.test/app/', pack), 'https://game.test/app/world/v1');
});

test('checked-in registry matches the generated pack and built-in fallback', () => {
  const checkedIn = validateWorldPackRegistry(JSON.parse(readFileSync(new URL('world/registry.json', PUBLIC), 'utf8')));
  const manifest = JSON.parse(readFileSync(new URL('world/v1/manifest.json', PUBLIC), 'utf8'));
  const pack = compatibleWorldPackForDistrict(checkedIn, manifest.area.id);
  assert.ok(pack);
  assert.equal(pack.worldVersion, manifest.worldVersion);
  assert.equal(pack.basePath, 'world/v1');
  assert.equal(pack.manifestFormatVersion, manifest.formatVersion);
  assert.deepEqual(BUILTIN_WORLD_REGISTRY.packs[0], pack);
  const districts = new Set<string>(ZONES.map((zone) => zone.id));
  for (const entry of checkedIn.packs) assert.ok(districts.has(entry.districtId), `${entry.districtId} is a gameplay district`);
});

test('registry loader joins the app base and validates the payload', async () => {
  const urls: string[] = [];
  const fetchImpl = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response(JSON.stringify(registry()), { status: 200 });
  }) as typeof fetch;
  const loaded = await loadWorldRegistry('/app/', { fetchImpl });
  assert.deepEqual(urls, ['/app/world/registry.json']);
  assert.equal(loaded.packs[0].worldVersion, 'nlongkak-test-v1');
});

test('manifest loading rejects a stale registry version or district', async () => {
  const manifest = JSON.parse(readFileSync(new URL('world/v1/manifest.json', PUBLIC), 'utf8'));
  const fetchImpl = (async () => new Response(JSON.stringify(manifest), { status: 200 })) as typeof fetch;
  await assert.rejects(
    () => loadManifest('/app/world/v1', { fetchImpl, expectedWorldVersion: 'other-v1' }),
    (error: unknown) => error instanceof WorldLoadError && error.code === 'version',
  );
  await assert.rejects(
    () => loadManifest('/app/world/v1', { fetchImpl, expectedAreaId: 'mokolo' }),
    (error: unknown) => error instanceof WorldLoadError && error.code === 'version',
  );
  assert.equal((await loadManifest('/app/world/v1', { fetchImpl, expectedAreaId: 'nlongkak' })).worldVersion, manifest.worldVersion);
});

test('pack selection does not alter district IDs or save round-trips', () => {
  const state = makeState();
  state.player.district = 'nlongkak';
  const loaded = importSaveJSON(exportSaveJSON(state));
  assert.ok(loaded);
  assert.equal(loaded!.player.district, 'nlongkak');
  assert.equal(loaded!.version, state.version);

  state.player.district = 'mvog_mbi';
  const legacy = importSaveJSON(exportSaveJSON(state));
  assert.ok(legacy);
  assert.equal(legacy!.player.district, 'mvog_mbi');
});
