import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Appearance, BagStyle, BottomStyle, ClothPattern, DistrictId } from '../sim/types';
import { HAIR_STYLES, SKIN_TONES } from '../data/backgrounds';

export type CharacterClip = 'idle' | 'walk' | 'run' | 'sit' | 'phone';
export type CharacterSex = 'm' | 'f' | 'x';

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
const hairMatCache = new Map<string, THREE.MeshLambertMaterial>();
const patternTexCache = new Map<ClothPattern, THREE.Texture | null>();

export function skinMaterial(color: string): THREE.MeshLambertMaterial {
  let mat = skinMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color });
    skinMatCache.set(color, mat);
  }
  return mat;
}

function hairMaterial(color: string): THREE.MeshLambertMaterial {
  let mat = hairMatCache.get(color);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color });
    hairMatCache.set(color, mat);
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
    const tex = patternTexture(pattern);
    mat = tex ? new THREE.MeshLambertMaterial({ color, map: tex }) : new THREE.MeshLambertMaterial({ color });
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
      return '#2f1c12';
    case 'natural':
      return '#211812';
    case 'twists':
      return '#1f1710';
    case 'bald':
      return '#5b3a29';
  }
}

const HIP_Y = 1.02;
const HEAD_PIVOT_Y = 0.555;
const HEAD_CENTER_Y = 0.2;
const SHOULDER_X = 0.155;
const SHOULDER_Y = 0.55;
const UPPER_ARM = 0.3;
const FOREARM = 0.26;
const THIGH = 0.45;
const SHIN = 0.45;
const GOLD = '#d9b45b';

const EYE_WHITE = new THREE.MeshBasicMaterial({ color: '#f7f2e8' });
const IRIS = new THREE.MeshBasicMaterial({ color: '#3a2418' });
const PUPIL = new THREE.MeshBasicMaterial({ color: '#141414' });
const GLINT = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const LIP = new THREE.MeshLambertMaterial({ color: '#96574a' });
const PHONE_BODY = new THREE.MeshLambertMaterial({ color: '#20242b' });
const PHONE_SCREEN = new THREE.MeshBasicMaterial({ color: '#77d5f7' });

const HEAD_PROFILE: [number, number][] = [
  [0.04, -0.148],
  [0.068, -0.132],
  [0.088, -0.105],
  [0.098, -0.06],
  [0.103, -0.005],
  [0.105, 0.05],
  [0.1, 0.1],
  [0.078, 0.135],
  [0.04, 0.152],
  [0.001, 0.155],
];

const TORSO_PROFILE: [number, number][] = [
  [0.142, 0.02],
  [0.137, 0.1],
  [0.142, 0.18],
  [0.155, 0.3],
  [0.165, 0.42],
  [0.166, 0.5],
  [0.16, 0.53],
  [0.135, 0.555],
  [0.09, 0.575],
  [0.062, 0.59],
];

const TORSO_PROFILE_M: [number, number][] = [
  [0.14, 0.02],
  [0.135, 0.1],
  [0.141, 0.18],
  [0.16, 0.3],
  [0.176, 0.42],
  [0.178, 0.5],
  [0.17, 0.53],
  [0.143, 0.555],
  [0.094, 0.575],
  [0.065, 0.59],
];

const TORSO_PROFILE_F: [number, number][] = [
  [0.147, 0.02],
  [0.139, 0.1],
  [0.134, 0.18],
  [0.138, 0.28],
  [0.145, 0.38],
  [0.151, 0.47],
  [0.148, 0.52],
  [0.13, 0.55],
  [0.087, 0.575],
  [0.06, 0.59],
];

interface BodyShape {
  shoulderX: number;
  hipX: number;
  pelvisX: number;
  pelvisY: number;
  armRadius: number;
  legRadius: number;
  shoeScale: number;
  headScale: number;
  torsoDepth: number;
  profile: [number, number][];
  bust: boolean;
}

const BODY_SHAPES: Record<CharacterSex, BodyShape> = {
  x: {
    shoulderX: SHOULDER_X,
    hipX: 0.072,
    pelvisX: 0.15,
    pelvisY: 0.105,
    armRadius: 1,
    legRadius: 1,
    shoeScale: 1,
    headScale: 1,
    torsoDepth: 0.64,
    profile: TORSO_PROFILE,
    bust: false,
  },
  m: {
    shoulderX: 0.168,
    hipX: 0.069,
    pelvisX: 0.141,
    pelvisY: 0.1,
    armRadius: 1.07,
    legRadius: 1.06,
    shoeScale: 1.04,
    headScale: 1.015,
    torsoDepth: 0.65,
    profile: TORSO_PROFILE_M,
    bust: false,
  },
  f: {
    shoulderX: 0.143,
    hipX: 0.08,
    pelvisX: 0.164,
    pelvisY: 0.112,
    armRadius: 0.91,
    legRadius: 0.94,
    shoeScale: 0.95,
    headScale: 0.97,
    torsoDepth: 0.67,
    profile: TORSO_PROFILE_F,
    bust: true,
  },
};

function headScaleFor(face: Appearance['faceShape']): [number, number, number] {
  switch (face) {
    case 'round':
      return [1.06, 0.96, 1.02];
    case 'square':
      return [1.04, 0.98, 1];
    case 'oval':
    default:
      return [1, 1, 1];
  }
}

const bodyScaleFor = (bodyType: Appearance['bodyType'], sex: CharacterSex): THREE.Vector3 => {
  const width = bodyType === 'slim' ? 0.93 : 1;
  const height = bodyType === 'tall' ? 1.06 : 1;
  const sexWidth = sex === 'f' ? 0.985 : sex === 'm' ? 1.005 : 1;
  const sexHeight = sex === 'f' ? 0.972 : sex === 'm' ? 1.012 : 1;
  return new THREE.Vector3(width * sexWidth, height * sexHeight, width * sexWidth);
};

function ellipsoid(
  rx: number,
  ry: number,
  rz: number,
  material: THREE.Material,
  widthSegments = 14,
  heightSegments = 10,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, widthSegments, heightSegments), material);
  mesh.scale.set(rx, ry, rz);
  return mesh;
}

function capsule(radius: number, length: number, material: THREE.Material, radialSegments = 10): THREE.Mesh {
  return new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, radialSegments), material);
}

function tapered(radiusTop: number, radiusBottom: number, length: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 12), material);
}

function roundedBox(w: number, h: number, d: number, radius: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), material);
}

function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

interface FaceParts {
  meshes: THREE.Object3D[];
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  mouth: THREE.Group;
}

function buildFace(app: Appearance, skinMat: THREE.Material, hairMat: THREE.Material): FaceParts {
  const out: THREE.Object3D[] = [];
  const eyeL = new THREE.Group();
  const eyeR = new THREE.Group();
  const mouth = new THREE.Group();
  for (const side of [-1, 1]) {
    const eye = side > 0 ? eyeL : eyeR;
    eye.position.set(side * 0.042, 0.032, -0.113);
    const white = ellipsoid(0.02, 0.013, 0.009, EYE_WHITE);
    const iris = ellipsoid(0.011, 0.011, 0.005, IRIS);
    iris.position.z = -0.008;
    const pupil = ellipsoid(0.0055, 0.007, 0.003, PUPIL);
    pupil.position.z = -0.011;
    const glint = ellipsoid(0.002, 0.002, 0.0015, GLINT);
    glint.position.set(-0.0035, 0.003, -0.013);
    eye.add(white, iris, pupil, glint);
    out.push(eye);
    const brow = roundedBox(0.043, 0.007, 0.012, 0.0035, hairMat);
    brow.position.set(side * 0.042, 0.063, -0.116);
    brow.rotation.z = -side * 0.12;
    const ear = ellipsoid(0.013, 0.024, 0.016, skinMat);
    ear.position.set(side * 0.1, 0, 0);
    ear.rotation.z = side * 0.12;
    out.push(brow, ear);
  }
  const nose = ellipsoid(0.014, 0.026, 0.018, skinMat);
  nose.position.set(0, -0.022, -0.112);
  out.push(nose);
  mouth.position.set(0, -0.074, -0.108);
  const upper = ellipsoid(0.024, 0.006, 0.007, LIP);
  upper.position.y = 0.003;
  const lower = ellipsoid(0.022, 0.009, 0.008, LIP);
  lower.position.y = -0.006;
  mouth.add(upper, lower);
  out.push(mouth);

  const facialHair = app.facialHair ?? 'none';
  if (facialHair !== 'none') {
    const beardMat =
      facialHair === 'stubble'
        ? new THREE.MeshLambertMaterial({
            color: hairColorFor(app.hair),
            transparent: true,
            opacity: 0.24,
          })
        : hairMat;
    const chin = ellipsoid(0.045, 0.025, 0.018, beardMat);
    chin.position.set(0, -0.125, -0.072);
    out.push(chin);
    for (const side of [-1, 1]) {
      const jaw = ellipsoid(0.022, 0.045, 0.018, beardMat);
      jaw.position.set(side * 0.078, -0.08, -0.055);
      jaw.rotation.z = side * 0.2;
      out.push(jaw);
      const mustache = ellipsoid(0.02, 0.007, 0.008, beardMat);
      mustache.position.set(side * 0.014, -0.062, -0.108);
      mustache.rotation.z = -side * 0.25;
      out.push(mustache);
      if (facialHair === 'beard') {
        const cheek = ellipsoid(0.026, 0.05, 0.02, beardMat);
        cheek.position.set(side * 0.082, -0.045, -0.035);
        out.push(cheek);
      }
    }
  }
  return { meshes: out, eyeL, eyeR, mouth };
}

function hairMesh(hair: Appearance['hair'], mat: THREE.Material): THREE.Object3D | null {
  switch (hair) {
    case 'bald':
      return null;
    case 'fade': {
      const g = new THREE.Group();
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
        mat,
      );
      cap.position.y = 0.097;
      cap.scale.set(1, 0.61, 1);
      const back = ellipsoid(0.1, 0.075, 0.05, mat);
      back.position.set(0, 0.02, 0.068);
      g.add(cap, back);
      return g;
    }
    case 'natural': {
      const g = new THREE.Group();
      const main = ellipsoid(0.14, 0.13, 0.13, mat);
      main.position.set(0, 0.1, 0.045);
      g.add(main);
      for (const [x, y, z, r] of [
        [-0.1, 0.06, 0.03, 0.048],
        [0.1, 0.06, 0.03, 0.048],
        [0, 0.2, 0.05, 0.042],
        [-0.06, 0.17, 0.07, 0.036],
        [0.06, 0.17, 0.07, 0.036],
      ] as const) {
        const puff = ellipsoid(r, r, r, mat, 10, 8);
        puff.position.set(x, y, z);
        g.add(puff);
      }
      return g;
    }
    case 'braids': {
      const g = new THREE.Group();
      const cap = ellipsoid(0.115, 0.095, 0.115, mat);
      cap.position.set(0, 0.075, 0.03);
      g.add(cap);
      for (let i = 0; i < 7; i++) {
        const braid = capsule(0.011, 0.35, mat, 6);
        braid.position.set(-0.09 + i * 0.03, -0.14, 0.085);
        braid.rotation.x = -0.1;
        g.add(braid);
        const bead = ellipsoid(0.016, 0.016, 0.016, clothMaterial(GOLD), 8, 6);
        bead.position.set(-0.09 + i * 0.03, -0.335, 0.09);
        g.add(bead);
      }
      for (const side of [-1, 1]) {
        const sideBraid = capsule(0.011, 0.27, mat, 6);
        sideBraid.position.set(side * 0.105, -0.09, 0.02);
        g.add(sideBraid);
      }
      return g;
    }
    case 'locks': {
      const g = new THREE.Group();
      const cap = ellipsoid(0.116, 0.098, 0.116, mat);
      cap.position.set(0, 0.075, 0.03);
      g.add(cap);
      for (let i = 0; i < 9; i++) {
        const lock = capsule(0.017, 0.4, mat, 6);
        lock.position.set(-0.11 + i * 0.0275, -0.16, 0.075 + (i % 2) * 0.025);
        lock.rotation.x = -0.08;
        lock.rotation.z = (i - 4) * 0.03;
        g.add(lock);
      }
      for (const side of [-1, 1]) {
        const sideLock = capsule(0.016, 0.3, mat, 6);
        sideLock.position.set(side * 0.108, -0.08, 0.025);
        g.add(sideLock);
      }
      return g;
    }
    case 'wig': {
      const g = new THREE.Group();
      const cap = ellipsoid(0.122, 0.1, 0.122, mat);
      cap.position.set(0, 0.075, 0.03);
      const volume = ellipsoid(0.13, 0.145, 0.11, mat);
      volume.position.set(0, 0.01, 0.05);
      const fringe = ellipsoid(0.095, 0.035, 0.035, mat);
      fringe.position.set(0, 0.115, -0.075);
      g.add(cap, volume, fringe);
      for (const side of [-1, 1]) {
        const sideVolume = ellipsoid(0.045, 0.12, 0.09, mat);
        sideVolume.position.set(side * 0.105, -0.02, 0.02);
        g.add(sideVolume);
      }
      return g;
    }
    case 'twists':
    default: {
      const g = new THREE.Group();
      const cap = ellipsoid(0.116, 0.098, 0.116, mat);
      cap.position.set(0, 0.075, 0.03);
      g.add(cap);
      const rings = [
        { phi: 0.35, count: 6, offset: 0 },
        { phi: 0.7, count: 10, offset: 0.3 },
        { phi: 1.0, count: 12, offset: 0.1 },
        { phi: 1.3, count: 14, offset: 0.2 },
      ];
      for (const ring of rings) {
        for (let i = 0; i < ring.count; i++) {
          const a = (i / ring.count) * Math.PI * 2 + ring.offset;
          const sin = Math.sin(ring.phi);
          const cos = Math.cos(ring.phi);
          const rr = 0.108 * sin;
          const x = Math.cos(a) * rr;
          const z = Math.sin(a) * rr + 0.03;
          const y = 0.075 + 0.095 * cos;
          if (ring.phi > 1.2 && z < 0.03 && Math.abs(x) < 0.075) continue;
          const twist = capsule(0.009, 0.022, mat, 6);
          twist.position.set(Math.cos(a) * (rr + 0.012), y, Math.sin(a) * (rr + 0.012) + 0.03);
          twist.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(Math.cos(a), 0.35, Math.sin(a)).normalize(),
          );
          g.add(twist);
        }
      }
      for (let i = 0; i < 4; i++) {
        const twist = capsule(0.013, 0.16, mat, 6);
        twist.position.set(-0.075 + i * 0.05, 0.01, 0.09);
        twist.rotation.x = -0.08;
        g.add(twist);
      }
      return g;
    }
  }
}

function headwrapMesh(baseColor: string, accentColor: string, pattern: ClothPattern): THREE.Group {
  const g = new THREE.Group();
  const base = clothMaterial(baseColor, pattern);
  const accent = clothMaterial(accentColor);
  const wrap = new THREE.Mesh(
    new THREE.SphereGeometry(0.118, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    base,
  );
  wrap.position.y = 0.085;
  wrap.scale.set(1, 0.95, 1.08);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 6, 22), accent);
  band.rotation.x = Math.PI / 2;
  band.scale.y = 1.12;
  band.position.y = 0.085;
  const knot = ellipsoid(0.033, 0.048, 0.028, base);
  knot.position.set(0.106, 0.095, 0.01);
  knot.rotation.z = -0.5;
  const tail = ellipsoid(0.02, 0.055, 0.018, accent);
  tail.position.set(0.125, 0.045, 0.02);
  tail.rotation.z = -0.3;
  g.add(wrap, band, knot, tail);
  return g;
}

function overshirtPanels(color: string): THREE.Group {
  const g = new THREE.Group();
  const mat = clothMaterial(color).clone();
  mat.side = THREE.DoubleSide;
  const profile: [number, number][] = [
    [0.153, 0.02],
    [0.155, 0.1],
    [0.168, 0.22],
    [0.18, 0.36],
    [0.178, 0.46],
    [0.165, 0.52],
    [0.15, 0.55],
  ];
  const shell = new THREE.Mesh(
    new THREE.LatheGeometry(
      profile.map(([r, y]) => new THREE.Vector2(r, y)),
      24,
      Math.PI + 0.55,
      Math.PI * 2 - 1.1,
    ),
    mat,
  );
  shell.scale.z = 0.68;
  g.add(shell);
  for (const side of [-1, 1]) {
    const lapel = roundedBox(0.05, 0.5, 0.022, 0.01, mat);
    lapel.position.set(side * 0.075, 0.29, -0.118);
    lapel.rotation.y = -side * 0.22;
    g.add(lapel);
  }
  return g;
}

function bagMesh(bag: BagStyle, color: string): THREE.Group | null {
  if (bag === 'none') return null;
  const g = new THREE.Group();
  const mat = clothMaterial(color);
  const accent = clothMaterial(GOLD);
  if (bag === 'crossbody' || bag === 'sling') {
    const side = bag === 'crossbody' ? 1 : -1;
    const from = new THREE.Vector3(-0.14 * side, 0.54, -0.07);
    const to = new THREE.Vector3(0.15 * side, 0.03, -0.02);
    g.add(rod(from, to, 0.012, mat));
    const pouch = roundedBox(0.15, 0.19, 0.08, 0.025, mat);
    pouch.position.set(to.x, 0.1, -0.02);
    const flap = roundedBox(0.14, 0.07, 0.02, 0.01, mat);
    flap.position.set(to.x, 0.17, -0.065);
    const buckle = roundedBox(0.025, 0.025, 0.012, 0.005, accent);
    buckle.position.set(to.x, 0.145, -0.075);
    g.add(pouch, flap, buckle);
    return g;
  }
  const from = new THREE.Vector3(-0.17, 0.54, 0);
  const to = new THREE.Vector3(-0.2, 0.12, 0);
  g.add(rod(from, to, 0.012, mat));
  const pouch = roundedBox(0.14, 0.2, 0.08, 0.025, mat);
  pouch.position.set(-0.215, 0.03, 0);
  const strapDetail = roundedBox(0.03, 0.1, 0.015, 0.006, accent);
  strapDetail.position.set(-0.215, 0.13, -0.045);
  g.add(pouch, strapDetail);
  return g;
}

function armFor(
  side: 1 | -1,
  skinMat: THREE.Material,
  shirtMat: THREE.Material,
  shape: BodyShape,
): { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group } {
  const r = shape.armRadius;
  const shoulder = new THREE.Group();
  shoulder.name = side > 0 ? 'shoulderL' : 'shoulderR';
  shoulder.position.set(shape.shoulderX * side, SHOULDER_Y, -0.06);
  const sleeve = capsule(0.056 * r, 0.4, shirtMat, 14);
  sleeve.scale.y = 0.45;
  sleeve.position.y = -0.115;
  const upper = tapered(0.053 * r, 0.048 * r, UPPER_ARM - 0.05, skinMat);
  upper.position.y = -UPPER_ARM / 2 - 0.025;
  upper.userData.limb = side > 0 ? 'armL' : 'armR';
  shoulder.add(sleeve, upper);
  const elbow = new THREE.Group();
  elbow.name = side > 0 ? 'elbowL' : 'elbowR';
  elbow.position.y = -UPPER_ARM;
  const elbowJoint = ellipsoid(0.049 * r, 0.049 * r, 0.049 * r, skinMat);
  elbow.add(elbowJoint);
  shoulder.add(elbow);
  const fore = tapered(0.048 * r, 0.041 * r, FOREARM, skinMat);
  fore.position.y = -FOREARM / 2;
  fore.userData.limb = side > 0 ? 'foreArmL' : 'foreArmR';
  elbow.add(fore);
  const wrist = new THREE.Group();
  wrist.name = side > 0 ? 'wristL' : 'wristR';
  wrist.position.y = -FOREARM;
  elbow.add(wrist);
  const hand = ellipsoid(0.047 * r, 0.064 * r, 0.037 * r, skinMat);
  hand.position.y = -0.058;
  hand.userData.limb = side > 0 ? 'handL' : 'handR';
  const thumb = ellipsoid(0.014 * r, 0.029 * r, 0.015 * r, skinMat);
  thumb.position.set(side * 0.036, -0.044, -0.011);
  thumb.rotation.z = side * 0.5;
  wrist.add(hand, thumb);
  return { shoulder, elbow, wrist };
}

function legFor(
  side: 1 | -1,
  material: THREE.Material,
  shape: BodyShape,
  shoeColor?: string,
): { hip: THREE.Group; knee: THREE.Group; ankle: THREE.Group } {
  const r = shape.legRadius;
  const hip = new THREE.Group();
  hip.name = side > 0 ? 'hipL' : 'hipR';
  hip.position.set(shape.hipX * side, 0, 0);
  const thigh = tapered(0.08 * r, 0.064 * r, THIGH, material);
  thigh.position.y = -THIGH / 2;
  thigh.userData.limb = side > 0 ? 'thighL' : 'thighR';
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.name = side > 0 ? 'kneeL' : 'kneeR';
  knee.position.y = -THIGH;
  const kneeJoint = ellipsoid(0.064 * r, 0.064 * r, 0.064 * r, material);
  knee.add(kneeJoint);
  hip.add(knee);
  const shin = tapered(0.064 * r, 0.047 * r, SHIN, material);
  shin.position.y = -SHIN / 2;
  shin.userData.limb = side > 0 ? 'shinL' : 'shinR';
  knee.add(shin);
  const ankle = new THREE.Group();
  ankle.name = side > 0 ? 'ankleL' : 'ankleR';
  ankle.position.y = -SHIN;
  knee.add(ankle);
  const shoeMat = clothMaterial(shoeColor ?? '#2b2b2b');
  const shoe = roundedBox(0.088, 0.065, 0.2, 0.02, shoeMat);
  shoe.position.set(0, -0.048, -0.035);
  shoe.scale.set(shape.shoeScale, 1, shape.shoeScale);
  shoe.userData.limb = side > 0 ? 'footL' : 'footR';
  const toe = ellipsoid(0.043, 0.028, 0.042, shoeMat);
  toe.position.set(0, -0.06, -0.125);
  const sole = roundedBox(0.094, 0.038, 0.215, 0.01, clothMaterial('#161616'));
  sole.position.set(0, -0.101, -0.035);
  sole.scale.set(shape.shoeScale, 1, shape.shoeScale);
  ankle.add(shoe, toe, sole);
  return { hip, knee, ankle };
}

function buildPhone(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'phone';
  const body = roundedBox(0.075, 0.14, 0.018, 0.008, PHONE_BODY);
  const screen = roundedBox(0.062, 0.11, 0.004, 0.004, PHONE_SCREEN);
  screen.position.z = -0.01;
  g.add(body, screen);
  g.position.set(0, -0.08, -0.02);
  g.rotation.x = -0.4;
  g.visible = false;
  return g;
}

export function buildCharacter(app: Appearance, sex: CharacterSex = 'x'): CharacterParts {
  const shape = BODY_SHAPES[sex];
  const group = new THREE.Group();
  group.scale.copy(bodyScaleFor(app.bodyType, sex));
  const skin = SKIN_TONES[app.skinTone % SKIN_TONES.length];
  const skinMat = skinMaterial(skin);
  const pattern = app.pattern ?? 'none';
  const shirtMat = clothMaterial(app.shirtColor, pattern);
  const pantsMat = clothMaterial(app.pantsColor);
  const hairMat = hairMaterial(hairColorFor(app.hair));
  const bottom: BottomStyle = app.bottomStyle ?? 'pants';
  const bag = app.bag ?? 'none';
  const overMat = app.overShirtColor ? clothMaterial(app.overShirtColor) : null;
  const sleeveMat = overMat ?? shirtMat;

  const offsetRoot = new THREE.Group();
  offsetRoot.name = 'offsetRoot';
  group.add(offsetRoot);

  const hips = new THREE.Group();
  hips.name = 'hips';
  hips.position.y = HIP_Y;
  offsetRoot.add(hips);

  const spine = new THREE.Group();
  spine.name = 'spine';
  hips.add(spine);

  const pelvis = ellipsoid(shape.pelvisX, shape.pelvisY, 0.108, pantsMat);
  pelvis.position.y = -0.005;
  hips.add(pelvis);

  const shirtHem = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.025, 20), shirtMat);
  shirtHem.position.y = 0.04;
  shirtHem.scale.z = 0.64;
  spine.add(shirtHem);

  const torso = new THREE.Mesh(
    new THREE.LatheGeometry(
      shape.profile.map(([r, y]) => new THREE.Vector2(r, y)),
      24,
    ),
    shirtMat,
  );
  torso.scale.z = shape.torsoDepth;
  spine.add(torso);

  if (shape.bust) {
    for (const side of [-1, 1]) {
      const chest = ellipsoid(0.058, 0.052, 0.045, shirtMat);
      chest.position.set(side * 0.061, 0.392, -0.073);
      spine.add(chest);
    }
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.01, 8, 20), shirtMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.585;
  spine.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.11, 14), skinMat);
  neck.position.y = 0.555;
  spine.add(neck);

  const headPivot = new THREE.Group();
  headPivot.name = 'head';
  headPivot.position.y = HEAD_PIVOT_Y;
  spine.add(headPivot);

  const headGroup = new THREE.Group();
  headGroup.position.y = HEAD_CENTER_Y;
  headGroup.scale.set(...headScaleFor(app.faceShape)).multiplyScalar(shape.headScale);
  headPivot.add(headGroup);

  const head = new THREE.Mesh(
    new THREE.LatheGeometry(
      HEAD_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      24,
    ),
    skinMat,
  );
  head.scale.z = 1.14;
  headGroup.add(head);

  const face = buildFace(app, skinMat, hairMat);
  for (const feature of face.meshes) headGroup.add(feature);

  if ((app.headwear ?? 'none') === 'headwrap') {
    headGroup.add(headwrapMesh(app.headwearColor ?? '#2f6fe0', '#e8e2d4', pattern));
  } else {
    const hair = hairMesh(app.hair, hairMat);
    if (hair) headGroup.add(hair);
  }

  const left = armFor(1, skinMat, sleeveMat, shape);
  const right = armFor(-1, skinMat, sleeveMat, shape);
  spine.add(left.shoulder, right.shoulder);

  const legMat = bottom === 'skirt' ? skinMat : pantsMat;
  const leftLeg = legFor(1, legMat, shape, app.shoeColor);
  const rightLeg = legFor(-1, legMat, shape, app.shoeColor);
  hips.add(leftLeg.hip, rightLeg.hip);

  if (bottom === 'skirt') {
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.235, 0.38, 16, 1, true),
      clothMaterial(app.pantsColor, pattern),
    );
    skirt.position.y = -0.16;
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.008, 6, 24), clothMaterial(app.pantsColor));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = -0.35;
    hips.add(skirt, hem);
  }

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
  armLZ: 0.03,
  foreLX: 0.1,
  armRX: 0,
  armRY: 0,
  armRZ: -0.03,
  foreRX: 0.1,
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

const SIT_ROOT_Y = -0.465;

function poseFor(clip: CharacterClip, t: number, speed: number): Pose {
  const p: Pose = { ...NEUTRAL };
  const blink = Math.pow(Math.max(0, Math.sin(t * 1.7)), 24);
  p.eyeOpen = 1 - blink * 0.88;
  if (clip === 'idle') {
    p.smile = 1.04;
    p.rootY = Math.sin(t * 1.8) * 0.005;
    p.spineY = Math.sin(t * 0.5) * 0.02;
    p.headY = Math.sin(t * 0.6) * 0.22;
    p.armLX = Math.sin(t * 1.6) * 0.04;
    p.armRX = -Math.sin(t * 1.6) * 0.04;
    p.foreLX = 0.12;
    p.foreRX = 0.12;
    return p;
  }
  if (clip === 'walk' || clip === 'run') {
    const run = clip === 'run';
    const rate = (run ? 10.5 : 8) * Math.max(0.7, Math.min(speed, 1.6));
    const phase = t * rate;
    const swing = Math.sin(phase) * (run ? 0.9 : 0.55);
    p.legLX = swing;
    p.legRX = -swing;
    p.shinLX = -Math.max(0, swing) * (run ? 1.2 : 0.72);
    p.shinRX = -Math.max(0, -swing) * (run ? 1.2 : 0.72);
    p.footLX = -(p.legLX + p.shinLX) * 0.75;
    p.footRX = -(p.legRX + p.shinRX) * 0.75;
    p.armLX = -swing * (run ? 0.85 : 0.5);
    p.armRX = swing * (run ? 0.85 : 0.5);
    p.foreLX = run ? 1.1 : 0.32;
    p.foreRX = run ? 1.1 : 0.32;
    p.spineX = run ? 0.16 : 0.035;
    p.headX = run ? -0.06 : 0;
    p.headY = Math.sin(phase * 0.5) * 0.05;
    p.rootY = Math.abs(Math.sin(phase)) * (run ? 0.055 : 0.026);
    return p;
  }
  if (clip === 'sit') {
    p.smile = 1.02;
    p.rootY = SIT_ROOT_Y;
    p.legLX = 1.5;
    p.legRX = 1.5;
    p.shinLX = -1.04;
    p.shinRX = -1.04;
    p.footLX = -0.46;
    p.footRX = -0.46;
    p.spineX = 0.04;
    p.headY = Math.sin(t * 0.5) * 0.18;
    p.armLX = 0.35;
    p.armRX = 0.35;
    p.foreLX = 0.65;
    p.foreRX = 0.65;
    return p;
  }
  p.rootY = 0;
  p.smile = 1.08;
  p.headY = Math.sin(t * 0.4) * 0.08;
  p.headZ = -0.06;
  p.spineY = -0.05;
  p.armRX = 1.55;
  p.armRZ = 0.12;
  p.foreRX = 1.95;
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

export { HAIR_STYLES };
