import * as THREE from 'three';
import type { Appearance, BagStyle, BottomStyle, ClothPattern, DistrictId } from '../sim/types';
import { HAIR_STYLES, SKIN_TONES } from '../data/backgrounds';

export type CharacterClip = 'idle' | 'walk' | 'run' | 'sit' | 'phone';

export type CharacterJointName =
  | 'hips'
  | 'spine'
  | 'head'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'
  | 'hipL'
  | 'hipR'
  | 'kneeL'
  | 'kneeR'
  | 'ankleL'
  | 'ankleR';

export interface CharacterParts {
  group: THREE.Group;
  offsetRoot: THREE.Group;
  spine: THREE.Group;
  headPivot: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Mesh;
  armL: THREE.Group;
  armR: THREE.Group;
  foreArmL: THREE.Group;
  foreArmR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  shinL: THREE.Group;
  shinR: THREE.Group;
  footL: THREE.Group;
  footR: THREE.Group;
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  mouth: THREE.Group;
  phone: THREE.Group;
  joints: Record<CharacterJointName, THREE.Object3D>;
  clip: CharacterClip;
}

const skinMatCache = new Map<string, THREE.MeshLambertMaterial>();
const clothMatCache = new Map<string, THREE.MeshLambertMaterial>();
const patternTexCache = new Map<ClothPattern, THREE.Texture | null>();

export function skinMaterial(color: string): THREE.MeshLambertMaterial {
  let mat = skinMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color });
    skinMatCache.set(color, mat);
  }
  return mat;
}

function patternTexture(pattern: ClothPattern): THREE.Texture | null {
  if (pattern === 'none') return null;
  if (patternTexCache.has(pattern)) return patternTexCache.get(pattern) ?? null;
  if (typeof document === 'undefined') {
    patternTexCache.set(pattern, null);
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    patternTexCache.set(pattern, null);
    return null;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 64, 64);
  if (pattern === 'weave') {
    ctx.fillStyle = '#e4e4e4';
    for (let i = 0; i < 64; i += 8) {
      ctx.fillRect(i, 0, 4, 64);
      ctx.fillRect(0, i, 64, 4);
    }
  } else if (pattern === 'geo') {
    ctx.fillStyle = '#d8d8d8';
    for (let y = 0; y < 64; y += 16) {
      for (let x = 0; x < 64; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 1);
        ctx.lineTo(x + 15, y + 8);
        ctx.lineTo(x + 8, y + 15);
        ctx.lineTo(x + 1, y + 8);
        ctx.closePath();
        ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = '#dedede';
    ctx.lineWidth = 5;
    for (let x = -64; x < 128; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 40, 64);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  patternTexCache.set(pattern, tex);
  return tex;
}

export function clothMaterial(color: string, pattern: ClothPattern = 'none'): THREE.MeshLambertMaterial {
  const key = `${color}|${pattern}`;
  let mat = clothMatCache.get(key);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color, map: patternTexture(pattern) ?? undefined });
    clothMatCache.set(key, mat);
  }
  return mat;
}

export function hairColorFor(hair: Appearance['hair']): string {
  switch (hair) {
    case 'fade':
      return '#1c1c1c';
    case 'braids':
      return '#241a12';
    case 'locks':
      return '#2a1c10';
    case 'wig':
      return '#3a2418';
    case 'natural':
      return '#211812';
    case 'twists':
      return '#1f1710';
    case 'bald':
      return '#5b3a29';
  }
}

const HEAD_Y = 1.43;
const TORSO_BASE_Y = 0.31;
const EYE_WHITE = new THREE.MeshBasicMaterial({ color: '#f4efe2' });
const PUPIL = new THREE.MeshBasicMaterial({ color: '#1a1a1a' });
const LIP = new THREE.MeshBasicMaterial({ color: '#7a3b2e' });
const PHONE_BODY = new THREE.MeshLambertMaterial({ color: '#20242b' });
const PHONE_SCREEN = new THREE.MeshBasicMaterial({ color: '#77d5f7' });

function headScaleFor(face: Appearance['faceShape']): [number, number, number] {
  switch (face) {
    case 'round':
      return [1.06, 0.95, 1.02];
    case 'square':
      return [1.02, 0.98, 1];
    case 'oval':
    default:
      return [0.96, 1.05, 0.96];
  }
}

function hairMesh(hair: Appearance['hair'], mat: THREE.Material): THREE.Object3D | null {
  switch (hair) {
    case 'bald':
      return null;
    case 'fade': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.1, 0.39), mat);
      m.position.y = 0.01;
      return m;
    }
    case 'twists': {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.43), mat);
      cap.position.y = 0.02;
      g.add(cap);
      for (let i = 0; i < 6; i++) {
        const twist = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1 + (i % 3) * 0.03, 0.06), mat);
        twist.position.set(-0.14 + (i % 3) * 0.14, 0.13 + (i > 2 ? 0.02 : 0), -0.11 + Math.floor(i / 3) * 0.22);
        g.add(twist);
      }
      return g;
    }
    case 'braids': {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.42), mat);
      cap.position.y = 0.01;
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.12), mat);
      back.position.set(0, -0.27, -0.18);
      g.add(cap, back);
      return g;
    }
    case 'locks': {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.44), mat);
      cap.position.y = 0.03;
      g.add(cap);
      for (let i = 0; i < 5; i++) {
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.44, 0.07), mat);
        lock.position.set(-0.18 + i * 0.09, -0.23, -0.16 + (i % 2) * 0.34);
        g.add(lock);
      }
      return g;
    }
    case 'wig': {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.48), mat);
      cap.position.y = 0.03;
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.4, 0.2), mat);
      side.position.set(0, -0.13, -0.2);
      g.add(cap, side);
      return g;
    }
    case 'natural':
    default: {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.22, 0.45), mat);
      m.position.y = 0.03;
      return m;
    }
  }
}

function headwrapMesh(baseColor: string, accentColor: string, pattern: ClothPattern): THREE.Group {
  const g = new THREE.Group();
  const base = clothMaterial(baseColor, pattern);
  const accent = clothMaterial(accentColor);
  const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.48), base);
  wrap.position.y = 0.06;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.08, 0.51), accent);
  band.position.y = -0.07;
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.1), base);
  knot.position.set(0.24, 0.05, 0.1);
  g.add(wrap, band, knot);
  return g;
}

function overshirtPanels(color: string): THREE.Group {
  const g = new THREE.Group();
  const mat = clothMaterial(color);
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.05), mat);
  frontL.position.set(-0.17, TORSO_BASE_Y, -0.16);
  const frontR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.05), mat);
  frontR.position.set(0.17, TORSO_BASE_Y, -0.16);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.05), mat);
  back.position.set(0, TORSO_BASE_Y, 0.16);
  const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.32), mat);
  shoulderL.position.set(-0.3, 0.58, 0);
  const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.32), mat);
  shoulderR.position.set(0.3, 0.58, 0);
  g.add(frontL, frontR, back, shoulderL, shoulderR);
  return g;
}

function skirtMesh(color: string, pattern: ClothPattern): THREE.Mesh {
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.45, 6), clothMaterial(color, pattern));
  skirt.position.y = -0.12;
  return skirt;
}

function bagMesh(bag: BagStyle, color: string): THREE.Group | null {
  if (bag === 'none') return null;
  const g = new THREE.Group();
  const mat = clothMaterial(color);
  if (bag === 'crossbody') {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.68, 0.03), mat);
    strap.position.set(0, 0.38, -0.165);
    strap.rotation.z = 0.675;
    strap.userData.outfit = 'bagStrap';
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.1), mat);
    pouch.position.set(0.16, 0.22, -0.235);
    pouch.userData.outfit = 'bagPouch';
    g.add(strap, pouch);
    return g;
  }
  if (bag === 'sling') {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.68, 0.03), mat);
    strap.position.set(0, 0.38, -0.165);
    strap.rotation.z = -0.675;
    strap.userData.outfit = 'bagStrap';
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.12), mat);
    pouch.position.set(-0.16, 0.22, -0.235);
    pouch.userData.outfit = 'bagPouch';
    g.add(strap, pouch);
    return g;
  }
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.6, 0.03), mat);
  strap.position.set(0.38, 0.42, 0.08);
  strap.userData.outfit = 'bagStrap';
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.12), mat);
  pouch.position.set(0.48, -0.17, 0.1);
  pouch.userData.outfit = 'bagPouch';
  g.add(strap, pouch);
  return g;
}

interface FaceParts {
  meshes: THREE.Object3D[];
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  mouth: THREE.Group;
}

function faceShapeMeshes(
  app: Appearance,
  skinMat: THREE.Material,
  hairMat: THREE.Material,
): FaceParts {
  const out: THREE.Object3D[] = [];
  const eyeL = new THREE.Group();
  const eyeR = new THREE.Group();
  const mouth = new THREE.Group();
  const faceZ = -0.19;
  for (const side of [-1, 1]) {
    const eye = side > 0 ? eyeL : eyeR;
    eye.position.set(side * 0.085, 0.025, faceZ);
    const white = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.052, 0.014), EYE_WHITE);
    const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.012), PUPIL);
    pupil.position.set(0, -0.002, -0.012);
    eye.add(white, pupil);
    out.push(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.014), hairMat);
    brow.position.set(side * 0.085, 0.085, faceZ + 0.002);
    brow.rotation.z = side * 0.08;
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.085, 0.06), skinMat);
    ear.position.set(side * 0.215, 0.005, 0.005);
    out.push(brow, ear);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.05), skinMat);
  nose.position.set(0, -0.045, faceZ - 0.004);
  out.push(nose);
  mouth.position.set(0, -0.115, faceZ);
  const mouthBar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.012), LIP);
  mouth.add(mouthBar);
  for (const side of [-1, 1]) {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.016, 0.012), LIP);
    corner.position.set(side * 0.067, 0.009, 0);
    corner.rotation.z = side * 0.45;
    mouth.add(corner);
  }
  out.push(mouth);
  const facialHair = app.facialHair ?? 'none';
  if (facialHair !== 'none') {
    const beardMat =
      facialHair === 'stubble'
        ? new THREE.MeshLambertMaterial({ color: hairColorFor(app.hair), transparent: true, opacity: 0.28 })
        : hairMat;
    if (facialHair === 'stubble') {
      const shadow = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), beardMat);
      shadow.position.set(0, -0.15, -0.155);
      out.push(shadow);
    } else if (facialHair === 'goatee') {
      const chin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.05), beardMat);
      chin.position.set(0, -0.19, -0.175);
      out.push(chin);
    } else {
      const chin = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.13, 0.08), beardMat);
      chin.position.set(0, -0.16, -0.15);
      out.push(chin);
      for (const side of [-1, 1]) {
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), beardMat);
        jaw.position.set(side * 0.19, -0.1, -0.11);
        out.push(jaw);
      }
    }
  }
  return { meshes: out, eyeL, eyeR, mouth };
}

function armFor(
  side: 1 | -1,
  skinMat: THREE.Material,
  shirtMat: THREE.Material,
): { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group } {
  const shoulder = new THREE.Group();
  shoulder.name = side > 0 ? 'shoulderL' : 'shoulderR';
  shoulder.position.set(0.325 * side, 0.56, 0);
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), shirtMat);
  sleeve.position.y = -0.06;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.13), skinMat);
  upper.position.y = -0.15;
  upper.userData.limb = side > 0 ? 'armL' : 'armR';
  shoulder.add(sleeve, upper);
  const elbow = new THREE.Group();
  elbow.name = side > 0 ? 'elbowL' : 'elbowR';
  elbow.position.y = -0.3;
  shoulder.add(elbow);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.12), skinMat);
  fore.position.y = -0.14;
  fore.userData.limb = side > 0 ? 'foreArmL' : 'foreArmR';
  elbow.add(fore);
  const wrist = new THREE.Group();
  wrist.name = side > 0 ? 'wristL' : 'wristR';
  wrist.position.y = -0.28;
  elbow.add(wrist);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.1, 0.11), skinMat);
  hand.position.y = -0.05;
  hand.userData.limb = side > 0 ? 'handL' : 'handR';
  wrist.add(hand);
  return { shoulder, elbow, wrist };
}

function legFor(
  side: 1 | -1,
  material: THREE.Material,
  skinMat: THREE.Material,
  shoeColor?: string,
): { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group } {
  const hip = new THREE.Group();
  hip.name = side > 0 ? 'hipL' : 'hipR';
  hip.position.set(0.12 * side, 0, 0);
  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.31, 0.17), material);
  thigh.position.y = -0.155;
  thigh.userData.limb = side > 0 ? 'thighL' : 'thighR';
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.name = side > 0 ? 'kneeL' : 'kneeR';
  knee.position.y = -0.31;
  hip.add(knee);
  const shin = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.31, 0.17), material);
  shin.position.y = -0.155;
  shin.userData.limb = side > 0 ? 'shinL' : 'shinR';
  knee.add(shin);
  const ankle = new THREE.Group();
  ankle.name = side > 0 ? 'ankleL' : 'ankleR';
  ankle.position.y = -0.31;
  knee.add(ankle);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 0.26), skinMat);
  foot.position.set(0, 0.035, -0.04);
  foot.userData.limb = side > 0 ? 'footL' : 'footR';
  ankle.add(foot);
  if (shoeColor) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.09, 0.3), clothMaterial(shoeColor));
    shoe.position.set(0, 0.045, -0.05);
    ankle.add(shoe);
  }
  return { hip, knee, ankle };
}

function buildPhone(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'phone';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 0.016), PHONE_BODY);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.095, 0.004), PHONE_SCREEN);
  screen.position.z = -0.01;
  g.add(body, screen);
  g.position.set(0, -0.1, -0.045);
  g.rotation.x = -0.5;
  g.visible = false;
  return g;
}

const bodyScaleFor = (bodyType: Appearance['bodyType']): THREE.Vector3 =>
  bodyType === 'slim' ? new THREE.Vector3(0.92, 0.98, 0.92) : bodyType === 'tall' ? new THREE.Vector3(1, 1.06, 1) : new THREE.Vector3(1, 1, 1);

const TORSO_Y = 0.93;

export function buildCharacter(app: Appearance): CharacterParts {
  const group = new THREE.Group();
  group.scale.copy(bodyScaleFor(app.bodyType));
  const skin = SKIN_TONES[app.skinTone % SKIN_TONES.length];
  const skinMat = skinMaterial(skin);
  const pattern = app.pattern ?? 'none';
  const shirtMat = clothMaterial(app.shirtColor, pattern);
  const pantsMat = clothMaterial(app.pantsColor);
  const hairMat = new THREE.MeshLambertMaterial({ color: hairColorFor(app.hair) });
  const bottom: BottomStyle = app.bottomStyle ?? 'pants';
  const bag = app.bag ?? 'none';

  const offsetRoot = new THREE.Group();
  offsetRoot.name = 'offsetRoot';
  group.add(offsetRoot);

  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = 0.62;
  offsetRoot.add(hips);

  const spine = new THREE.Group();
  spine.name = 'spine';
  hips.add(spine);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirtMat);
  torso.position.y = TORSO_BASE_Y;
  spine.add(torso);

  const headPivot = new THREE.Group();
  headPivot.name = 'head';
  headPivot.position.y = HEAD_Y - 0.62;
  spine.add(headPivot);

  const headGeo = new THREE.BoxGeometry(0.4, 0.38, 0.36);
  const head = new THREE.Mesh(headGeo, skinMat);
  const [hsx, hsy, hsz] = headScaleFor(app.faceShape);
  head.scale.set(hsx, hsy, hsz);
  headPivot.add(head);

  const face = faceShapeMeshes(app, skinMat, hairMat);
  for (const feature of face.meshes) headPivot.add(feature);

  if ((app.headwear ?? 'none') === 'headwrap') {
    headPivot.add(headwrapMesh(app.headwearColor ?? '#2f6fe0', '#e8e2d4', pattern));
  } else {
    const hair = hairMesh(app.hair, hairMat);
    if (hair) headPivot.add(hair);
  }

  const left = armFor(1, skinMat, shirtMat);
  const right = armFor(-1, skinMat, shirtMat);
  spine.add(left.shoulder, right.shoulder);

  const legMat = bottom === 'skirt' ? skinMat : pantsMat;
  const leftLeg = legFor(1, legMat, skinMat, app.shoeColor);
  const rightLeg = legFor(-1, legMat, skinMat, app.shoeColor);
  hips.add(leftLeg.hip, rightLeg.hip);

  if (bottom === 'skirt') hips.add(skirtMesh(app.pantsColor, pattern));

  if (app.overShirtColor) spine.add(overshirtPanels(app.overShirtColor));

  const bagGroup = bagMesh(bag, app.bagColor ?? '#2b2b2b');
  if (bagGroup) spine.add(bagGroup);

  const phone = buildPhone();
  right.wrist.add(phone);

  const joints: Record<CharacterJointName, THREE.Object3D> = {
    hips,
    spine,
    head: headPivot,
    shoulderL: left.shoulder,
    shoulderR: right.shoulder,
    elbowL: left.elbow,
    elbowR: right.elbow,
    wristL: left.wrist,
    wristR: right.wrist,
    hipL: leftLeg.hip,
    hipR: rightLeg.hip,
    kneeL: leftLeg.knee,
    kneeR: rightLeg.knee,
    ankleL: leftLeg.ankle,
    ankleR: rightLeg.ankle,
  };

  return {
    group,
    offsetRoot,
    spine,
    headPivot,
    torso,
    head,
    armL: left.shoulder,
    armR: right.shoulder,
    foreArmL: left.elbow,
    foreArmR: right.elbow,
    handL: left.wrist,
    handR: right.wrist,
    legL: leftLeg.hip,
    legR: rightLeg.hip,
    shinL: leftLeg.knee,
    shinR: rightLeg.knee,
    footL: leftLeg.ankle,
    footR: rightLeg.ankle,
    eyeL: face.eyeL,
    eyeR: face.eyeR,
    mouth: face.mouth,
    phone,
    joints,
    clip: 'idle',
  };
}

interface Pose {
  rootY: number;
  spineX: number;
  spineY: number;
  headX: number;
  headY: number;
  headZ: number;
  armLX: number;
  armLY: number;
  armLZ: number;
  foreLX: number;
  armRX: number;
  armRY: number;
  armRZ: number;
  foreRX: number;
  legLX: number;
  legRX: number;
  shinLX: number;
  shinRX: number;
  footLX: number;
  footRX: number;
  eyeOpen: number;
  smile: number;
  phone: boolean;
}

const NEUTRAL: Pose = {
  rootY: 0,
  spineX: 0,
  spineY: 0,
  headX: 0,
  headY: 0,
  headZ: 0,
  armLX: 0,
  armLY: 0,
  armLZ: 0,
  foreLX: 0.06,
  armRX: 0,
  armRY: 0,
  armRZ: 0,
  foreRX: 0.06,
  legLX: 0,
  legRX: 0,
  shinLX: 0,
  shinRX: 0,
  footLX: 0,
  footRX: 0,
  eyeOpen: 1,
  smile: 1,
  phone: false,
};

const SIT_ROOT_Y = -0.257;

function poseFor(clip: CharacterClip, t: number, speed: number): Pose {
  const p: Pose = { ...NEUTRAL };
  const blink = Math.pow(Math.max(0, Math.sin(t * 1.7)), 24);
  p.eyeOpen = 1 - blink * 0.88;
  if (clip === 'idle') {
    p.smile = 1.04;
    p.rootY = Math.sin(t * 1.8) * 0.006;
    p.spineY = Math.sin(t * 0.5) * 0.025;
    p.headY = Math.sin(t * 0.6) * 0.25;
    p.armLX = Math.sin(t * 1.6) * 0.05;
    p.armRX = -Math.sin(t * 1.6) * 0.05;
    p.foreLX = 0.08;
    p.foreRX = 0.08;
    return p;
  }
  if (clip === 'walk' || clip === 'run') {
    const run = clip === 'run';
    const rate = (run ? 10.5 : 8) * Math.max(0.7, Math.min(speed, 1.6));
    const phase = t * rate;
    const swing = Math.sin(phase) * (run ? 0.95 : 0.6);
    p.legLX = swing;
    p.legRX = -swing;
    p.shinLX = -Math.max(0, swing) * (run ? 1.2 : 0.72);
    p.shinRX = -Math.max(0, -swing) * (run ? 1.2 : 0.72);
    p.footLX = -(p.legLX + p.shinLX) * 0.75;
    p.footRX = -(p.legRX + p.shinRX) * 0.75;
    p.armLX = -swing * (run ? 0.9 : 0.55);
    p.armRX = swing * (run ? 0.9 : 0.55);
    p.foreLX = run ? 1.15 : 0.3;
    p.foreRX = run ? 1.15 : 0.3;
    p.spineX = run ? 0.17 : 0.035;
    p.headX = run ? -0.06 : 0;
    p.headY = Math.sin(phase * 0.5) * 0.05;
    p.rootY = Math.abs(Math.sin(phase)) * (run ? 0.06 : 0.028);
    return p;
  }
  if (clip === 'sit') {
    p.smile = 1.02;
    p.rootY = SIT_ROOT_Y;
    p.legLX = 1.4;
    p.legRX = 1.4;
    p.shinLX = -1.4;
    p.shinRX = -1.4;
    p.footLX = 0;
    p.footRX = 0;
    p.spineX = 0.04;
    p.headY = Math.sin(t * 0.5) * 0.18;
    p.armLX = 0.18;
    p.armRX = 0.18;
    p.foreLX = 0.55;
    p.foreRX = 0.55;
    return p;
  }
  p.rootY = 0;
  p.smile = 1.08;
  p.headY = Math.sin(t * 0.4) * 0.08;
  p.headZ = -0.06;
  p.spineY = -0.05;
  p.armRX = 1.7;
  p.armRZ = 0.15;
  p.foreRX = 1.9;
  p.armLX = Math.sin(t * 1.6) * 0.04;
  p.foreLX = 0.1;
  p.phone = true;
  return p;
}

function damp(current: number, target: number, dt: number): number {
  return THREE.MathUtils.damp(current, target, 14, Math.min(dt, 0.2));
}

function dampRot(obj: THREE.Object3D, x: number, y: number, z: number, dt: number) {
  obj.rotation.x = damp(obj.rotation.x, x, dt);
  obj.rotation.y = damp(obj.rotation.y, y, dt);
  obj.rotation.z = damp(obj.rotation.z, z, dt);
}

export function animateCharacter(
  parts: CharacterParts,
  t: number,
  moving: boolean,
  speed = 1,
  clip?: CharacterClip,
  dt = 1 / 60,
) {
  const active: CharacterClip = clip ?? (moving ? (speed > 1.15 ? 'run' : 'walk') : 'idle');
  const p = poseFor(active, t, speed);
  parts.clip = active;
  parts.offsetRoot.position.y = damp(parts.offsetRoot.position.y, p.rootY, dt);
  parts.offsetRoot.position.x = damp(parts.offsetRoot.position.x, 0, dt);
  parts.offsetRoot.position.z = damp(parts.offsetRoot.position.z, 0, dt);
  dampRot(parts.spine, p.spineX, p.spineY, 0, dt);
  dampRot(parts.headPivot, p.headX, p.headY, p.headZ, dt);
  dampRot(parts.armL, p.armLX, p.armLY, p.armLZ, dt);
  dampRot(parts.foreArmL, p.foreLX, 0, 0, dt);
  dampRot(parts.armR, p.armRX, p.armRY, p.armRZ, dt);
  dampRot(parts.foreArmR, p.foreRX, 0, 0, dt);
  dampRot(parts.legL, p.legLX, 0, 0, dt);
  dampRot(parts.legR, p.legRX, 0, 0, dt);
  dampRot(parts.shinL, p.shinLX, 0, 0, dt);
  dampRot(parts.shinR, p.shinRX, 0, 0, dt);
  dampRot(parts.footL, p.footLX, 0, 0, dt);
  dampRot(parts.footR, p.footRX, 0, 0, dt);
  parts.eyeL.scale.y = damp(parts.eyeL.scale.y, p.eyeOpen, dt);
  parts.eyeR.scale.y = damp(parts.eyeR.scale.y, p.eyeOpen, dt);
  parts.mouth.scale.x = damp(parts.mouth.scale.x, p.smile, dt);
  parts.phone.visible = p.phone;
}

export function districtForCharacter(_id: DistrictId): void {
  /* reserved for per-district appearance overrides */
}

export { TORSO_Y, HAIR_STYLES };
