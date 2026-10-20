import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { animateCharacter, buildCharacter } from '../src/render/characters.ts';
import { CHARACTER_PRESETS } from '../src/data/characterPresets.ts';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReaderPolyfill {
    constructor() {
      this.result = null;
      this.onloadend = null;
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const CLIPS = ['idle', 'walk', 'run', 'sit', 'phone'];
const FPS = 30;
const DURATION = 1.2;
const FRAMES = Math.round(FPS * DURATION);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'art');
const OUT_FILE = path.join(OUT_DIR, 'player_rig.glb');

function buildSkinnedParts(parts) {
  const bones = Object.values(parts.joints);
  const boneIndex = new Map(bones.map((bone, index) => [bone, index]));
  const skip = new Set();
  parts.phone.traverse((o) => skip.add(o));

  parts.group.updateMatrixWorld(true);
  const byMaterial = new Map();
  const originals = [];
  parts.group.traverse((object) => {
    if (!object.isMesh || skip.has(object)) return;
    let parent = object.parent;
    let index = -1;
    while (parent && parent !== parts.group) {
      if (boneIndex.has(parent)) {
        index = boneIndex.get(parent);
        break;
      }
      parent = parent.parent;
    }
    if (index < 0) return;
    object.updateWorldMatrix(true, false);
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const count = geometry.attributes.position.count;
    const skinIndex = new Uint16Array(count * 4);
    const skinWeight = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      skinIndex[i * 4] = index;
      skinWeight[i * 4] = 1;
    }
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
    const existing = byMaterial.get(object.material) ?? [];
    existing.push(geometry);
    byMaterial.set(object.material, existing);
    originals.push(object);
  });

  for (const mesh of originals) mesh.removeFromParent();
  const skeleton = new THREE.Skeleton(bones);
  const skinnedMeshes = [];
  let index = 0;
  for (const [material, geometries] of byMaterial) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) continue;
    const mesh = new THREE.SkinnedMesh(merged, material);
    mesh.name = `character_skin_${index++}`;
    mesh.bind(skeleton);
    mesh.updateMatrixWorld(true);
    skinnedMeshes.push(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  return { bones, skeleton, skinnedMeshes };
}

const appearance = { ...CHARACTER_PRESETS[0].appearance, facialHair: 'none' };
const parts = buildCharacter(appearance);
parts.group.name = 'yaounde_character';
const { bones, skeleton, skinnedMeshes } = buildSkinnedParts(parts);
parts.group.updateMatrixWorld(true);
skeleton.calculateInverses();

const joints = Object.values(parts.joints);
const clips = [];
for (const clip of CLIPS) {
  const moving = clip === 'walk' || clip === 'run';
  for (let i = 0; i < 60; i++) animateCharacter(parts, 0, moving, 1, clip, 1 / 60);
  const times = [];
  const rotations = new Map(joints.map((joint) => [joint, []]));
  const roots = [];
  const phoneScales = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    const t = frame / FPS;
    times.push(t);
    animateCharacter(parts, t, moving, 1, clip, 1 / FPS);
    for (const joint of joints) {
      rotations.get(joint).push(joint.quaternion.x, joint.quaternion.y, joint.quaternion.z, joint.quaternion.w);
    }
    roots.push(0, parts.offsetRoot.position.y, 0);
    const phoneScale = clip === 'phone' ? 1 : 0.001;
    phoneScales.push(phoneScale, phoneScale, phoneScale);
  }
  const tracks = [];
  for (const [joint, values] of rotations) {
    tracks.push(new THREE.QuaternionKeyframeTrack(`${joint.name}.quaternion`, times, values));
  }
  tracks.push(new THREE.VectorKeyframeTrack('offsetRoot.position', times, roots));
  tracks.push(new THREE.VectorKeyframeTrack('phone.scale', times, phoneScales));
  clips.push(new THREE.AnimationClip(clip, DURATION, tracks));
}

parts.phone.visible = true;
for (const mesh of skinnedMeshes) mesh.updateMatrixWorld(true);
const scene = new THREE.Scene();
scene.name = 'YaoundeCharacterExport';
scene.add(parts.group, ...skinnedMeshes);

const exporter = new GLTFExporter();
const buffer = await exporter.parseAsync(scene, {
  binary: true,
  trs: true,
  onlyVisible: false,
  animations: clips,
  includeCustomExtensions: false,
});

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, Buffer.from(buffer));
const sizeKb = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
console.log(
  `Exported skinned rig (${bones.length} bones, ${skinnedMeshes.length} meshes, ${CLIPS.length} clips: ${CLIPS.join(', ')}) -> ${path.relative(ROOT, OUT_FILE)} (${sizeKb} KB)`,
);
