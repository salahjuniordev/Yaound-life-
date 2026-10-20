import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARACTER_PRESETS } from '../src/data/characterPresets';
import { buildCharacter, animateCharacter } from '../src/render/characters';
import type { Appearance } from '../src/sim/types';

const ASSETS = fileURLToPath(new URL('../public/assets/', import.meta.url));

const LEGACY_APPEARANCE: Appearance = {
  skinTone: 3,
  hair: 'fade',
  bodyType: 'medium',
  shirtColor: '#e0532f',
  pantsColor: '#2c3e50',
};

function meshCount(root: { traverse: (cb: (o: unknown) => void) => void }): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) n++;
  });
  return n;
}

test('three editable presets match the Amina, Brice, and Marie references', () => {
  assert.deepEqual(
    CHARACTER_PRESETS.map((p) => p.id),
    ['amina', 'brice', 'marie'],
  );
  for (const p of CHARACTER_PRESETS) {
    assert.ok(existsSync(`${ASSETS}${p.referenceImage}`), `missing reference image ${p.referenceImage}`);
  }
  const amina = CHARACTER_PRESETS[0].appearance;
  assert.equal(amina.hair, 'twists');
  assert.equal(amina.shirtColor, '#f2b134');
  assert.equal(amina.pantsColor, '#2a7d7b');
  assert.equal(amina.bag, 'crossbody');
  const brice = CHARACTER_PRESETS[1].appearance;
  assert.equal(brice.shirtColor, '#e8e2d4');
  assert.equal(brice.overShirtColor, '#e0532f');
  assert.equal(brice.pantsColor, '#2c3e50');
  const marie = CHARACTER_PRESETS[2].appearance;
  assert.equal(marie.headwear, 'headwrap');
  assert.equal(marie.bottomStyle, 'skirt');
  assert.equal(marie.bag, 'tote');
  for (const p of CHARACTER_PRESETS) {
    assert.notEqual(JSON.stringify(p.appearance), JSON.stringify(LEGACY_APPEARANCE));
  }
});

test('presets assemble into animatable modular characters', () => {
  for (const p of CHARACTER_PRESETS) {
    const parts = buildCharacter(p.appearance);
    assert.ok(parts.torso, `${p.id} torso`);
    assert.ok(parts.head, `${p.id} head`);
    assert.ok(parts.armL && parts.armR && parts.legL && parts.legR, `${p.id} limbs`);
    assert.ok(meshCount(parts.group) >= 10, `${p.id} has enough parts`);
    assert.doesNotThrow(() => animateCharacter(parts, 1.5, true));
    assert.doesNotThrow(() => animateCharacter(parts, 2.5, false));
  }
});

test('new appearance parts are optional and default safely for legacy saves', () => {
  assert.doesNotThrow(() => buildCharacter(LEGACY_APPEARANCE));
  const base = meshCount(buildCharacter(LEGACY_APPEARANCE).group);
  const wrapped = meshCount(buildCharacter({ ...LEGACY_APPEARANCE, headwear: 'headwrap' }).group);
  assert.ok(wrapped > base, 'headwrap replaces the plain hair cap');
  const bagged = meshCount(buildCharacter({ ...LEGACY_APPEARANCE, bag: 'crossbody' }).group);
  assert.equal(bagged, base + 2, 'crossbody adds strap and pouch');
  const shoed = meshCount(buildCharacter({ ...LEGACY_APPEARANCE, shoeColor: '#e0532f' }).group);
  assert.equal(shoed, base + 2, 'shoes are added to both feet');
  const skirted = meshCount(buildCharacter({ ...LEGACY_APPEARANCE, bottomStyle: 'skirt' }).group);
  assert.equal(skirted, base + 1, 'skirt adds one wrap mesh');
});

test('body type scales the assembled character without moving its feet', () => {
  const slim = buildCharacter({ ...LEGACY_APPEARANCE, bodyType: 'slim' });
  const tall = buildCharacter({ ...LEGACY_APPEARANCE, bodyType: 'tall' });
  const medium = buildCharacter({ ...LEGACY_APPEARANCE, bodyType: 'medium' });
  assert.ok(slim.group.scale.x < 1 && slim.group.scale.y < 1);
  assert.ok(tall.group.scale.y > 1);
  assert.deepEqual([medium.group.scale.x, medium.group.scale.y, medium.group.scale.z], [1, 1, 1]);
});
