import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERIORS, PLACES } from '../src/data/places';
import {
  INTERIOR_IDS,
  PROP_SAFE_ZONE,
  SIT_INTERIORS,
  interiorLayout,
  propHalfExtents,
} from '../src/render/interiorProps';

test('every enterable place resolves to a dedicated, furnished interior layout', () => {
  for (const id of Object.keys(INTERIORS)) {
    assert.ok(INTERIOR_IDS.includes(id), `missing dedicated layout for ${id}`);
  }
  for (const place of PLACES) {
    if (place.interior) {
      assert.ok(INTERIOR_IDS.includes(place.interior), `place ${place.id} -> ${place.interior}`);
    }
  }
});

test('each interior type has a distinct and non-trivial prop set', () => {
  const signatures = new Map<string, string>();
  for (const id of INTERIOR_IDS) {
    const { floorColor, props } = interiorLayout(id);
    assert.ok(props.length >= 14, `${id} has only ${props.length} props`);
    const signature = `${floorColor}|${props
      .map((p) => `${p.shape}:${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)},${p.color}`)
      .join(';')}`;
    signatures.set(id, signature);
  }
  assert.equal(new Set(signatures.values()).size, INTERIOR_IDS.length, 'room layouts must be distinct');
});

test('props stay inside the room, off the floor and out of the player lane', () => {
  for (const id of INTERIOR_IDS) {
    for (const prop of interiorLayout(id).props) {
      const { hw, hd, hh } = propHalfExtents(prop);
      if (!prop.structural) {
        assert.ok(prop.x - hw >= -6.85 && prop.x + hw <= 6.85, `${id}: x out of bounds at ${prop.x}`);
        assert.ok(prop.z - hd >= -4.85 && prop.z + hd <= 4.85, `${id}: z out of bounds at ${prop.z}`);
        assert.ok(prop.y - hh >= -0.16, `${id}: prop below the floor at y=${prop.y}`);
        assert.ok(prop.y + hh <= 3.4, `${id}: prop above the walls at y=${prop.y}`);
      }
      if (hw >= 3 || hd >= 3 || prop.structural) continue;
      if (prop.y - hh > PROP_SAFE_ZONE.maxY || hh < 0.1) continue;
      const inLaneX = prop.x + hw > PROP_SAFE_ZONE.minX && prop.x - hw < PROP_SAFE_ZONE.maxX;
      const inLaneZ = prop.z + hd > PROP_SAFE_ZONE.minZ && prop.z - hd < PROP_SAFE_ZONE.maxZ;
      assert.ok(!(inLaneX && inLaneZ), `${id}: prop blocks the player lane at (${prop.x}, ${prop.y}, ${prop.z})`);
    }
  }
});

test('sit interiors match the animated sit set', () => {
  assert.deepEqual([...SIT_INTERIORS].sort(), ['bank', 'bar', 'home_room', 'njangi', 'restaurant']);
});
