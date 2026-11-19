import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ZONES } from '../src/data/districts';
import { PLACES } from '../src/data/places';
import type { DistrictId } from '../src/sim/types';
import { exportSaveJSON, importSaveJSON } from '../src/persistence/idb';
import { createGeoAdapter } from '../src/render/geo/adapter';
import { GeoCollisionWorld } from '../src/render/geo/collision';
import { RoadIndex } from '../src/render/geo/roadIndex';
import { loadChunk, loadManifest, loadWorldData, loadWorldRegistry, WorldLoadError } from '../src/world/loader';
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

test('checked-in registry matches every generated pack and built-in fallback', () => {
  const checkedIn = validateWorldPackRegistry(JSON.parse(readFileSync(new URL('world/registry.json', PUBLIC), 'utf8')));
  const districts = new Set<string>(ZONES.map((zone) => zone.id));
  assert.ok(checkedIn.packs.length >= 2);
  for (const entry of checkedIn.packs) {
    assert.ok(districts.has(entry.districtId), `${entry.districtId} is a gameplay district`);
    const manifest = JSON.parse(readFileSync(new URL(`${entry.basePath}/manifest.json`, PUBLIC), 'utf8'));
    const pack = compatibleWorldPackForDistrict(checkedIn, manifest.area.id);
    assert.ok(pack, `${entry.districtId} has a compatible registered pack`);
    assert.equal(pack.worldVersion, manifest.worldVersion);
    assert.equal(pack.basePath, entry.basePath);
    assert.equal(pack.manifestFormatVersion, manifest.formatVersion);
    assert.deepEqual(
      BUILTIN_WORLD_REGISTRY.packs.find((fallback) => fallback.districtId === entry.districtId),
      entry,
    );
  }
  assert.equal(worldPackForDistrict(checkedIn, 'mvog_mbi')?.id, 'mvog_mbi');
  assert.equal(worldPackForDistrict(checkedIn, 'nlongkak')?.id, 'nlongkak');
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

test('every registered pack manifest matches its registered version and district', async () => {
  const checkedIn = validateWorldPackRegistry(JSON.parse(readFileSync(new URL('world/registry.json', PUBLIC), 'utf8')));
  for (const pack of checkedIn.packs) {
    const manifest = JSON.parse(readFileSync(new URL(`${pack.basePath}/manifest.json`, PUBLIC), 'utf8'));
    const fetchImpl = (async () => new Response(JSON.stringify(manifest), { status: 200 })) as typeof fetch;
    const loaded = await loadManifest(`/app/${pack.basePath}`, {
      fetchImpl,
      expectedWorldVersion: pack.worldVersion,
      expectedAreaId: pack.districtId,
    });
    assert.equal(loaded.area.id, pack.districtId);
    assert.equal(loaded.worldVersion, pack.worldVersion);
    await assert.rejects(
      () => loadManifest(`/app/${pack.basePath}`, { fetchImpl, expectedAreaId: pack.districtId === 'nlongkak' ? 'mvog_mbi' : 'nlongkak' }),
      (error: unknown) => error instanceof WorldLoadError && error.code === 'version',
    );
  }
});

test('every registered pack loads globals and every chunk through the runtime loader', async () => {
  const checkedIn = validateWorldPackRegistry(JSON.parse(readFileSync(new URL('world/registry.json', PUBLIC), 'utf8')));
  for (const pack of checkedIn.packs) {
    const baseUrl = `/app/${pack.basePath}`;
    const fetchImpl = (async (input: string | URL | Request) => {
      const url = String(input).replace(/^https?:\/\/[^/]+/, '');
      const relative = url.replace(/^\/app\//, '');
      assert.ok(relative.startsWith(`${pack.basePath}/`), `unexpected pack URL ${url}`);
      return new Response(readFileSync(new URL(relative, PUBLIC)));
    }) as typeof fetch;

    const manifest = await loadManifest(baseUrl, {
      fetchImpl,
      expectedWorldVersion: pack.worldVersion,
      expectedAreaId: pack.districtId,
    });
    const world = await loadWorldData(baseUrl, manifest, { fetchImpl });
    assert.equal(world.roads.length, manifest.featureCounts.roads);
    assert.equal(world.pois.length, manifest.featureCounts.pois);
    assert.equal(world.water.length, manifest.featureCounts.waterPolygons);
    assert.equal(world.waterways.length, manifest.featureCounts.waterways);
    const anchor = world.districts.find((district) => district.id === pack.districtId);
    assert.ok(anchor);
    assert.ok(anchor.gameX >= manifest.bounds.minX && anchor.gameX <= manifest.bounds.maxX);
    assert.ok(anchor.gameZ >= manifest.bounds.minZ && anchor.gameZ <= manifest.bounds.maxZ);

    const loaded = await Promise.all(manifest.chunks.map((ref) => loadChunk(baseUrl, manifest, ref, { fetchImpl })));
    assert.equal(loaded.reduce((sum, chunk) => sum + chunk.buildings.length, 0), manifest.featureCounts.buildings);
    for (let index = 0; index < loaded.length; index++) {
      assert.equal(loaded[index].buildings.length, manifest.chunks[index].buildingCount);
      assert.equal(loaded[index].roads.length, manifest.chunks[index].roadCount);
      assert.ok(loaded[index].terrain.heights.length > 0);
    }

    const collision = new GeoCollisionWorld();
    for (let index = 0; index < loaded.length; index++) {
      collision.addChunk(manifest.chunks[index].id, loaded[index].buildings);
    }
    const roads = new RoadIndex(world.roads);
    const adapter = createGeoAdapter({ world, collision, roads, terrainHeight: () => 0 });
    const spawn = adapter.spawnForDistrict(pack.districtId as DistrictId);
    assert.ok(Number.isFinite(spawn[0]) && Number.isFinite(spawn[1]));
    assert.equal(collision.isInsideBuilding(spawn[0], spawn[1]), false);
    const nearestRoad = roads.nearest(spawn[0], spawn[1], 10);
    assert.ok(nearestRoad && nearestRoad.distance <= 5, `${pack.name} spawn should sit beside a walkable road`);

    const expectedPlaces = PLACES.filter((place) => place.district === pack.districtId);
    assert.ok(
      expectedPlaces.some((place) => place.kind !== 'taxi'),
      `${pack.name} should expose at least one non-taxi gameplay place`,
    );
    assert.deepEqual(
      adapter.places.map((place) => place.id).sort(),
      expectedPlaces.map((place) => place.id).sort(),
      `${pack.name} should expose every gameplay place in its district`,
    );
    for (const place of adapter.places) {
      const [x, z] = place.worldPos;
      assert.ok(Number.isFinite(x) && Number.isFinite(z), `${pack.name} place ${place.id} has a finite position`);
      assert.ok(x >= manifest.bounds.minX && x <= manifest.bounds.maxX, `${pack.name} place ${place.id} is inside X bounds`);
      assert.ok(z >= manifest.bounds.minZ && z <= manifest.bounds.maxZ, `${pack.name} place ${place.id} is inside Z bounds`);
      assert.equal(collision.isInsideBuilding(x, z), false, `${pack.name} place ${place.id} is clear of buildings`);
      const placeRoad = roads.nearest(x, z, 10);
      assert.ok(
        placeRoad && placeRoad.distance <= 3.5,
        `${pack.name} place ${place.id} should sit beside a walkable road (distance ${placeRoad?.distance.toFixed(1) ?? 'none'} m)`,
      );
    }
  }
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
