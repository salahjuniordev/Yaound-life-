import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { animateCharacter, buildCharacter, type CharacterClip, type CharacterParts } from '../src/render/characters';
import { CHARACTER_PRESETS } from '../src/data/characterPresets';
import type { Appearance } from '../src/sim/types';

const LEGACY: Appearance = {
  skinTone: 3,
  hair: 'fade',
  bodyType: 'medium',
  shirtColor: '#e0532f',
  pantsColor: '#2c3e50',
};

const CLIPS: CharacterClip[] = ['idle', 'walk', 'run', 'sit', 'phone'];

function poseClip(appearance: Appearance, clip: CharacterClip, t = 1.2): CharacterParts {
  const parts = buildCharacter(appearance);
  for (let i = 0; i < 60; i++) {
    animateCharacter(parts, t, clip === 'walk' || clip === 'run', 1, clip, 1 / 60);
  }
  parts.group.updateMatrixWorld(true);
  return parts;
}

function worldBox(object: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(object);
}

function clippedMeshes(parts: CharacterParts): { limbs: THREE.Object3D[]; pouches: THREE.Object3D[] } {
  const limbs: THREE.Object3D[] = [];
  const pouches: THREE.Object3D[] = [];
  parts.group.traverse((o) => {
    const limb = (o.userData as { limb?: string }).limb;
    if (limb) limbs.push(o);
    if ((o.userData as { outfit?: string }).outfit === 'bagPouch') pouches.push(o);
  });
  return { limbs, pouches };
}

test('shared skeleton exposes every named joint and all five clips pose cleanly', () => {
  const expected = ['hips', 'spine', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];
  for (const clip of CLIPS) {
    const parts = poseClip(LEGACY, clip);
    for (const name of expected) assert.ok(parts.joints[name as keyof typeof parts.joints], `${clip}: ${name} joint`);
    assert.equal(parts.clip, clip);
    assert.equal(parts.phone.visible, clip === 'phone', `${clip}: phone visibility`);
    for (const joint of Object.values(parts.joints)) {
      assert.ok(Number.isFinite(joint.rotation.x) && Number.isFinite(joint.rotation.y) && Number.isFinite(joint.rotation.z));
    }
    assert.ok(Number.isFinite(parts.offsetRoot.position.y));
  }
});

test('sit clip seats the hips, bends both knees and keeps the feet on the ground', () => {
  const parts = poseClip(LEGACY, 'sit');
  assert.ok(parts.offsetRoot.position.y < -0.2, 'hips lower onto the seat');
  assert.ok(parts.legL.rotation.x > 1.2 && parts.legR.rotation.x > 1.2, 'thighs fold forward');
  assert.ok(
    parts.legL.rotation.x - parts.shinL.rotation.x > 1.0 &&
      parts.legR.rotation.x - parts.shinR.rotation.x > 1.0,
    'knees bend',
  );
  for (const foot of [parts.footL, parts.footR]) {
    const box = worldBox(foot);
    assert.ok(box.min.y > -0.03 && box.min.y < 0.06, `foot grounded (min y ${box.min.y.toFixed(3)})`);
  }
});

test('phone clip raises the hand to the head and keeps the device out of the face', () => {
  const parts = poseClip(LEGACY, 'phone');
  const head = parts.head.getWorldPosition(new THREE.Vector3());
  const hand = parts.handR.getWorldPosition(new THREE.Vector3());
  const distance = head.distanceTo(hand);
  assert.ok(distance > 0.18 && distance < 0.55, `hand near the ear (distance ${distance.toFixed(3)})`);
  const phoneBox = worldBox(parts.phone);
  const headBox = worldBox(parts.head);
  assert.equal(phoneBox.intersectsBox(headBox), false, 'phone does not clip through the head');
});

test('idle clip blinks and phone use smiles wider than walking', () => {
  const blinkTime = Math.PI / (2 * 1.7);
  const blinking = poseClip(LEGACY, 'idle', blinkTime);
  assert.ok(blinking.eyeL.scale.y < 0.3, `eyes close (${blinking.eyeL.scale.y.toFixed(2)})`);
  assert.ok(blinking.eyeR.scale.y < 0.3);
  const open = poseClip(LEGACY, 'idle', 0);
  assert.ok(open.eyeL.scale.y > 0.95, 'eyes open at rest');
  const phone = poseClip(LEGACY, 'phone');
  const idle = poseClip(LEGACY, 'idle');
  assert.ok(phone.mouth.scale.x > idle.mouth.scale.x, 'phone pose smiles wider');
});

test('fabric patterns use distinct cloth materials without breaking the rig', () => {
  const plain = buildCharacter(LEGACY);
  const woven = buildCharacter({ ...LEGACY, pattern: 'weave' });
  const geo = buildCharacter({ ...LEGACY, pattern: 'geo' });
  assert.notEqual(plain.torso.material, woven.torso.material);
  assert.notEqual(woven.torso.material, geo.torso.material);
  for (const clip of CLIPS) assert.doesNotThrow(() => animateCharacter(woven, 1.1, clip === 'walk', 1, clip, 1 / 60));
});

test('bag pouches clear the arms across idle, walk, run, sit and phone for all presets', () => {
  const appearances: Appearance[] = [
    LEGACY,
    ...CHARACTER_PRESETS.map((p) => p.appearance),
    { ...LEGACY, bag: 'crossbody', bagColor: '#2b2b2b' },
    { ...LEGACY, bag: 'sling', bagColor: '#2b2b2b' },
    { ...LEGACY, bag: 'tote', bagColor: '#2b2b2b' },
    { ...LEGACY, bottomStyle: 'skirt', overShirtColor: '#e0532f', headwear: 'headwrap' },
  ];
  for (const appearance of appearances) {
    for (const clip of CLIPS) {
      for (const t of [0, 0.4, 0.8, 1.2]) {
        const parts = poseClip(appearance, clip, t);
        const { limbs, pouches } = clippedMeshes(parts);
        for (const pouch of pouches) {
          const pouchBox = worldBox(pouch);
          for (const limb of limbs) {
            const limbBox = worldBox(limb);
            assert.equal(
              pouchBox.intersectsBox(limbBox),
              false,
              `${clip} t=${t}: bag pouch clips ${(limb.userData as { limb?: string }).limb}`,
            );
          }
        }
      }
    }
  }
});
