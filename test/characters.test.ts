import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_PRESETS } from '../src/data/characterPresets';
import { buildCharacter, animateCharacter } from '../src/render/characters';
import { normalizeAppearanceForSex } from '../src/sim/appearance';
import type { Appearance } from '../src/sim/types';

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

function featureCount(root: { traverse: (cb: (o: unknown) => void) => void }, feature: string): number {
  let n = 0;
  root.traverse((o) => {
    if ((o as { userData?: { bodyFeature?: string } }).userData?.bodyFeature === feature) n++;
  });
  return n;
}

test('three editable presets match the Amina, Brice, and Marie references', () => {
  assert.deepEqual(
    CHARACTER_PRESETS.map((p) => p.id),
    ['amina', 'brice', 'marie'],
  );
  for (const p of CHARACTER_PRESETS) {
    assert.match(p.referenceImage, /^[a-z_]+\.png$/, `reference image name for ${p.id}`);
  }
  assert.deepEqual(
    CHARACTER_PRESETS.map((p) => p.sex),
    ['f', 'm', 'f'],
  );
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
    const parts = buildCharacter(p.appearance, p.sex);
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
  assert.equal(bagged, base + 4, 'crossbody adds strap, pouch, flap and buckle');
  const shoed = meshCount(buildCharacter({ ...LEGACY_APPEARANCE, shoeColor: '#e0532f' }).group);
  assert.equal(shoed, base, 'shoe color applies to the existing shoes');
  const skirted = meshCount(buildCharacter({ ...LEGACY_APPEARANCE, bottomStyle: 'skirt' }).group);
  assert.equal(skirted, base + 2, 'skirt adds a wrap and hem');
  const dressed = meshCount(buildCharacter({ ...LEGACY_APPEARANCE, bottomStyle: 'dress' }).group);
  assert.equal(dressed, base + 2, 'dress adds a skirt body and hem');
});

test('body type scales the assembled character without moving its feet', () => {
  const slim = buildCharacter({ ...LEGACY_APPEARANCE, bodyType: 'slim' });
  const tall = buildCharacter({ ...LEGACY_APPEARANCE, bodyType: 'tall' });
  const medium = buildCharacter({ ...LEGACY_APPEARANCE, bodyType: 'medium' });
  assert.ok(slim.group.scale.x < 1 && slim.group.scale.z < 1);
  assert.equal(slim.group.scale.y, 1);
  assert.ok(tall.group.scale.y > 1);
  assert.deepEqual([medium.group.scale.x, medium.group.scale.y, medium.group.scale.z], [1, 1, 1]);
});

test('male and female builds have distinct shoulders, hips, chest and height', () => {
  const base = meshCount(buildCharacter(LEGACY_APPEARANCE).group);
  const male = buildCharacter(LEGACY_APPEARANCE, 'm');
  const female = buildCharacter(LEGACY_APPEARANCE, 'f');
  assert.equal(meshCount(male.group), base + 2, 'male build adds two pectoral meshes');
  assert.equal(meshCount(female.group), base + 2, 'female build adds two chest meshes');
  assert.equal(featureCount(male.group, 'pecs'), 2);
  assert.equal(featureCount(male.group, 'bust'), 0);
  assert.equal(featureCount(female.group, 'bust'), 2);
  assert.equal(featureCount(female.group, 'pecs'), 0);
  assert.ok(male.group.scale.y > female.group.scale.y, 'male build stands taller');
  const maleShoulder = male.group.getObjectByName('shoulderL');
  const femaleShoulder = female.group.getObjectByName('shoulderL');
  const maleHip = male.group.getObjectByName('hipL');
  const femaleHip = female.group.getObjectByName('hipL');
  assert.ok(maleShoulder && femaleShoulder && maleHip && femaleHip, 'named joints exist');
  const x = (o: { position: { x: number } }) => Math.abs(o.position.x);
  const maleRatio = x(maleShoulder) / x(maleHip);
  const femaleRatio = x(femaleShoulder) / x(femaleHip);
  assert.ok(x(maleShoulder) > x(femaleShoulder) * 1.2, 'male shoulders are clearly wider');
  assert.ok(x(femaleHip) > x(maleHip) * 1.2, 'female hips are clearly wider');
  assert.ok(maleRatio > femaleRatio * 1.4, 'male shoulder-to-hip ratio is clearly higher');
});

test('male builds cannot render skirts or dresses, but female and other builds can', () => {
  for (const bottomStyle of ['skirt', 'dress'] as const) {
    const male = buildCharacter({ ...LEGACY_APPEARANCE, bottomStyle }, 'm');
    assert.equal(male.group.getObjectByName('skirt'), undefined, `male ${bottomStyle} is rejected`);
    assert.equal(male.group.getObjectByName('skirtHem'), undefined);
    assert.equal(male.group.userData.bottomStyle, 'pants');

    for (const sex of ['f', 'x'] as const) {
      const allowed = buildCharacter({ ...LEGACY_APPEARANCE, bottomStyle }, sex);
      const skirt = allowed.group.getObjectByName('skirt');
      assert.ok(skirt, `${sex} ${bottomStyle} is rendered`);
      assert.equal(skirt?.userData.outfit, bottomStyle);
    }
  }
});

test('appearance normalization enforces the male outfit rule', () => {
  const skirted = { ...LEGACY_APPEARANCE, bottomStyle: 'skirt' as const };
  const dressed = { ...LEGACY_APPEARANCE, bottomStyle: 'dress' as const };
  assert.equal(normalizeAppearanceForSex(skirted, 'm').bottomStyle, 'pants');
  assert.equal(normalizeAppearanceForSex(dressed, 'm').bottomStyle, 'pants');
  assert.equal(normalizeAppearanceForSex(dressed, 'f').bottomStyle, 'dress');
  assert.equal(normalizeAppearanceForSex(skirted, 'x').bottomStyle, 'skirt');
  assert.equal(normalizeAppearanceForSex(LEGACY_APPEARANCE, 'm'), LEGACY_APPEARANCE);
});

test('unknown sex falls back to the neutral legacy build', () => {
  const neutral = meshCount(buildCharacter(LEGACY_APPEARANCE, 'x').group);
  const legacy = meshCount(buildCharacter(LEGACY_APPEARANCE).group);
  assert.equal(neutral, legacy);
});
