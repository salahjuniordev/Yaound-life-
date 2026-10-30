import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { crowdForDistrict } from '../sim/npcsim';
import { npcPositionFor } from '../sim/npcsim';
import { DISTRICT_MAP } from '../data/districts';
import { PANTS_COLORS, SHIRT_COLORS, SKIN_TONES } from '../data/backgrounds';
import { CAST_LOOKS } from '../data/castLooks';
import { terrainHeight } from '../sim/world';
import { npcRuntime, labelSprite } from './runtime';
import { qualityTiers, type QualityTier } from './controls';
import { crowdLodFor } from './lod';
import { crowdBuildFor, type CrowdBuild } from './crowdLooks';
import type { DistrictId } from '../sim/types';

interface BodyMetrics {
  legLen: number;
  torsoLen: number;
  hipY: number;
  torsoCenter: number;
  headR: number;
  headCenter: number;
  shoulderY: number;
  shoulderHalf: number;
  hipHalf: number;
  armLen: number;
  top: number;
}

interface Person {
  id: string;
  baseX: number;
  baseZ: number;
  shirt: THREE.Color;
  pants: THREE.Color;
  skin: THREE.Color;
  hair: THREE.Color;
  shoe: THREE.Color;
  build: CrowdBuild;
  metrics: BodyMetrics;
  speed: number;
  phase: number;
  moving: boolean;
  named?: boolean;
}

const HAIR_COLORS = ['#1c1c1c', '#241a12', '#2a1c10', '#3a2418', '#211812', '#151515'];
const SHOE_COLORS = ['#242424', '#30251e', '#1f2a30', '#4b3a2b', '#5c4a3a'];

function hashPick(colors: string[], id: string): THREE.Color {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return new THREE.Color(colors[h % colors.length]);
}

function metricsFor(build: CrowdBuild): BodyMetrics {
  const height = build.height;
  const legLen = 0.6 * height * build.leg;
  const torsoLen = 0.6 * height * build.torso;
  const hipY = legLen;
  const headR = 0.195 * build.head;
  const headCenter = hipY + torsoLen + headR * 0.8;
  return {
    legLen,
    torsoLen,
    hipY,
    torsoCenter: hipY + torsoLen * 0.5 - 0.01,
    headR,
    headCenter,
    shoulderY: hipY + torsoLen * 0.84,
    shoulderHalf: 0.265 * build.shoulder,
    hipHalf: 0.105 * build.hip,
    armLen: 0.56 * height * build.arm,
    top: headCenter + headR,
  };
}

function normalizedLimb(radius: number, length: number): THREE.CapsuleGeometry {
  const geo = new THREE.CapsuleGeometry(radius, length, 4, 8);
  geo.translate(0, -0.5, 0);
  return geo;
}

function silhouetteTexture(kind: 'body' | 'legs' | 'hair'): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  if (kind === 'body') {
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(46, 2);
    ctx.lineTo(56, 16);
    ctx.lineTo(50, 24);
    ctx.lineTo(48, 62);
    ctx.lineTo(16, 62);
    ctx.lineTo(14, 24);
    ctx.lineTo(8, 16);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'legs') {
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(29, 0);
    ctx.lineTo(27, 63);
    ctx.lineTo(11, 63);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(35, 0);
    ctx.lineTo(54, 0);
    ctx.lineTo(53, 63);
    ctx.lineTo(37, 63);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(6, 36);
    ctx.quadraticCurveTo(6, 4, 32, 4);
    ctx.quadraticCurveTo(58, 4, 58, 36);
    ctx.lineTo(50, 36);
    ctx.quadraticCurveTo(46, 18, 32, 18);
    ctx.quadraticCurveTo(18, 18, 14, 36);
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function Crowd({ quality }: { quality: QualityTier }) {
  const tier = qualityTiers[quality] ?? qualityTiers.mid;
  const capacity = tier.crowd + 14;
  const { camera } = useThree();

  const meshes = useMemo(() => {
    const bodyProfile = [
      [0.15, -0.5],
      [0.145, -0.35],
      [0.155, -0.1],
      [0.19, 0.12],
      [0.225, 0.32],
      [0.23, 0.43],
      [0.205, 0.48],
      [0.145, 0.5],
    ] as const;
    const bodyGeo = new THREE.LatheGeometry(
      bodyProfile.map(([r, y]) => new THREE.Vector2(r, y)),
      10,
    );
    const pelvisGeo = new THREE.SphereGeometry(1, 10, 8);
    const headGeo = new THREE.SphereGeometry(1, 12, 10);
    const hairGeo = new THREE.SphereGeometry(1, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const armGeo = normalizedLimb(0.06, 0.88);
    const legGeo = normalizedLimb(0.075, 0.85);
    const shoeGeo = new THREE.SphereGeometry(1, 8, 6);

    const mk = (geo: THREE.BufferGeometry, count: number) => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      const colors = new Float32Array(count * 3).fill(1);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      mesh.count = 0;
      return mesh;
    };
    const mkImpostor = (geo: THREE.BufferGeometry, count: number, map: THREE.Texture | null) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map,
        transparent: Boolean(map),
        alphaTest: map ? 0.45 : 0,
        side: THREE.DoubleSide,
        depthWrite: true,
      });
      const mesh = new THREE.InstancedMesh(geo, material, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      const colors = new Float32Array(count * 3).fill(1);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
      mesh.count = 0;
      return mesh;
    };
    const torsoTexture = silhouetteTexture('body');
    const legsTexture = silhouetteTexture('legs');
    const hairTexture = silhouetteTexture('hair');
    return {
      body: mk(bodyGeo, capacity),
      pelvis: mk(pelvisGeo, capacity),
      head: mk(headGeo, capacity),
      hair: mk(hairGeo, capacity),
      armL: mk(armGeo, capacity),
      armR: mk(armGeo, capacity),
      legL: mk(legGeo, capacity),
      legR: mk(legGeo, capacity),
      shoeL: mk(shoeGeo, capacity),
      shoeR: mk(shoeGeo, capacity),
      impostorTorso: mkImpostor(new THREE.PlaneGeometry(0.66, 0.84), capacity, torsoTexture),
      impostorLegs: mkImpostor(new THREE.PlaneGeometry(0.46, 0.64), capacity, legsTexture),
      impostorHead: mkImpostor(new THREE.CircleGeometry(0.21, 12), capacity, null),
      impostorHair: mkImpostor(new THREE.PlaneGeometry(0.46, 0.22), capacity, hairTexture),
      textures: [torsoTexture, legsTexture, hairTexture].filter((t): t is THREE.CanvasTexture => Boolean(t)),
    };
  }, [capacity]);

  useEffect(() => {
    return () => {
      for (const tex of meshes.textures) tex.dispose();
      for (const mesh of Object.values(meshes)) {
        if (mesh instanceof THREE.InstancedMesh) {
          mesh.geometry.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const mat of mats) mat.dispose();
        }
      }
    };
  }, [meshes]);

  const peopleRef = useRef<Person[]>([]);
  const regenKeyRef = useRef('');
  const labelGroupRef = useRef<THREE.Group>(null);
  const labelsRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const smoothPosRef = useRef<Map<string, { x: number; z: number }>>(new Map());

  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      bodyQuat: new THREE.Quaternion(),
      limbQuat: new THREE.Quaternion(),
      swingQuat: new THREE.Quaternion(),
      scale: new THREE.Vector3(1, 1, 1),
      offset: new THREE.Vector3(),
      axis: new THREE.Vector3(1, 0, 0),
      m: new THREE.Matrix4(),
      euler: new THREE.Euler(),
      color: new THREE.Color(),
    }),
    [],
  );

  useFrame((_, dt) => {
    const engine = useGame.getState().engine;
    if (!engine) return;
    const state = engine.state;
    const minute = state.world.minute;
    const day = state.world.day;
    const playerDistrict = state.player.district;
    const regenKey = `${playerDistrict}_${day}_${Math.floor(minute / 180)}_${capacity}`;

    const zone = DISTRICT_MAP[playerDistrict];
    if (regenKey !== regenKeyRef.current) {
      regenKeyRef.current = regenKey;
      const crowd = crowdForDistrict(playerDistrict, day, minute, tier.crowd, zone.center, zone.radius);
      const persons: Person[] = [];
      for (const npc of Object.values(state.npcs)) {
        const np = npcPositionFor(npc, minute);
        const look = CAST_LOOKS[npc.id];
        const build = crowdBuildFor(npc.id);
        persons.push({
          id: npc.id,
          baseX: np.pos[0],
          baseZ: np.pos[1],
          shirt: look ? new THREE.Color(look.shirt) : hashPick(SHIRT_COLORS, npc.id),
          pants: look ? new THREE.Color(look.pants) : hashPick(PANTS_COLORS, npc.id),
          skin: look ? new THREE.Color(look.skin) : hashPick(SKIN_TONES as unknown as string[], npc.id + 's'),
          hair: look ? new THREE.Color(look.headwear ?? look.hair) : hashPick(HAIR_COLORS, npc.id + 'h'),
          shoe: hashPick(SHOE_COLORS, npc.id + 'sh'),
          build,
          metrics: metricsFor(build),
          speed: 0.8,
          phase: Math.random() * 6.28,
          moving: false,
          named: true,
        });
      }
      for (const m of crowd) {
        const build = crowdBuildFor(m.id);
        persons.push({
          id: m.id,
          baseX: m.pos[0],
          baseZ: m.pos[1],
          shirt: new THREE.Color(m.shirt),
          pants: new THREE.Color(m.pants),
          skin: new THREE.Color(SKIN_TONES[m.skin % SKIN_TONES.length]),
          hair: new THREE.Color(HAIR_COLORS[m.hair % HAIR_COLORS.length]),
          shoe: hashPick(SHOE_COLORS, m.id + 'sh'),
          build,
          metrics: metricsFor(build),
          speed: m.speed,
          phase: m.phase,
          moving: m.moving,
        });
      }
      peopleRef.current = persons.slice(0, capacity);
      const { body, pelvis, head, hair, armL, armR, legL, legR, shoeL, shoeR, impostorTorso, impostorLegs, impostorHead, impostorHair } = meshes;
      peopleRef.current.forEach((p, i) => {
        body.setColorAt(i, p.shirt);
        pelvis.setColorAt(i, p.pants);
        head.setColorAt(i, p.skin);
        hair.setColorAt(i, p.hair);
        armL.setColorAt(i, p.skin);
        armR.setColorAt(i, p.skin);
        legL.setColorAt(i, p.pants);
        legR.setColorAt(i, p.pants);
        shoeL.setColorAt(i, p.shoe);
        shoeR.setColorAt(i, p.shoe);
        impostorTorso.setColorAt(i, p.shirt);
        impostorLegs.setColorAt(i, p.pants);
        impostorHead.setColorAt(i, p.skin);
        impostorHair.setColorAt(i, p.hair);
      });
      const all = [body, pelvis, head, hair, armL, armR, legL, legR, shoeL, shoeR, impostorTorso, impostorLegs, impostorHead, impostorHair];
      for (const mesh of all) {
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.count = peopleRef.current.length;
      }
    }

    const people = peopleRef.current;
    if (people.length === 0) return;
    const t = performance.now() / 1000;
    const playerX = useGame.getState().player.x;
    const playerZ = useGame.getState().player.z;
    const camX = camera.position.x;
    const camZ = camera.position.z;
    const { body, pelvis, head, hair, armL, armR, legL, legR, shoeL, shoeR, impostorTorso, impostorLegs, impostorHead, impostorHair } = meshes;

    const zero = (mesh: THREE.InstancedMesh, i: number) => {
      tmp.m.makeScale(0, 0, 0);
      mesh.setMatrixAt(i, tmp.m);
    };
    const setPart = (
      mesh: THREE.InstancedMesh,
      i: number,
      x: number,
      y: number,
      z: number,
      quat: THREE.Quaternion,
      sx: number,
      sy: number,
      sz: number,
    ) => {
      tmp.pos.set(x, y, z);
      tmp.scale.set(sx, sy, sz);
      tmp.m.compose(tmp.pos, quat, tmp.scale);
      mesh.setMatrixAt(i, tmp.m);
    };
    const setPlane = (
      mesh: THREE.InstancedMesh,
      i: number,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
    ) => {
      tmp.pos.set(x, y, z);
      tmp.scale.set(sx, sy, 1);
      tmp.m.compose(tmp.pos, tmp.quat, tmp.scale);
      mesh.setMatrixAt(i, tmp.m);
    };

    for (let i = 0; i < people.length; i++) {
      const p = people[i];
      let x = p.baseX;
      let z = p.baseZ;
      if (p.named) {
        const npc = state.npcs[p.id];
        if (npc) {
          const target = npcPositionFor(npc, minute);
          const smooth = smoothPosRef.current.get(p.id) ?? { x: target.pos[0], z: target.pos[1] };
          const dx = target.pos[0] - smooth.x;
          const dz = target.pos[1] - smooth.z;
          const d = Math.hypot(dx, dz);
          if (d > 0.4) {
            const step = Math.min(d, 4.5 * Math.min(dt, 0.05));
            smooth.x += (dx / d) * step;
            smooth.z += (dz / d) * step;
          }
          smoothPosRef.current.set(p.id, smooth);
          x = smooth.x;
          z = smooth.z;
          npcRuntime[p.id] = { x, z };
        }
      } else if (p.moving) {
        const a = p.phase + t * p.speed * 0.25;
        x = p.baseX + Math.cos(a) * 2.6;
        z = p.baseZ + Math.sin(a) * 2.6;
      }
      const distToPlayer = Math.hypot(x - playerX, z - playerZ);
      const visible = distToPlayer < tier.viewDistance * 0.55;

      if (!visible) {
        for (const mesh of [body, pelvis, head, hair, armL, armR, legL, legR, shoeL, shoeR, impostorTorso, impostorLegs, impostorHead, impostorHair]) {
          zero(mesh, i);
        }
        continue;
      }

      const groundY = terrainHeight(x, z);
      const lod = crowdLodFor(Math.hypot(x - camX, z - camZ), quality);
      const m = p.metrics;

      if (lod === 'impostor') {
        for (const mesh of [body, pelvis, head, hair, armL, armR, legL, legR, shoeL, shoeR]) zero(mesh, i);
        const yaw = Math.atan2(camX - x, camZ - z);
        tmp.quat.setFromEuler(tmp.euler.set(0, yaw, 0));
        const bob = p.moving ? Math.abs(Math.sin(t * p.speed * 4 + p.phase)) * 0.03 : 0;
        const base = groundY + bob;
        setPlane(impostorTorso, i, x, base + m.torsoCenter, z, (m.shoulderHalf * 2) / 0.66, m.torsoLen / 0.84);
        setPlane(impostorLegs, i, x, base + m.legLen * 0.5, z, (m.hipHalf * 2 + 0.16) / 0.46, m.legLen / 0.64);
        setPlane(impostorHead, i, x, base + m.headCenter, z, m.headR / 0.21, m.headR / 0.21);
        setPlane(impostorHair, i, x, base + m.headCenter + m.headR * 0.6, z, (m.headR * 2.1) / 0.46, (m.headR * 1.15) / 0.22);
      } else {
        zero(impostorTorso, i);
        zero(impostorLegs, i);
        zero(impostorHead, i);
        zero(impostorHair, i);
        const walkPhase = t * p.speed * 6 + p.phase;
        const isMoving = p.named ? false : p.moving;
        const swing = isMoving ? Math.sin(walkPhase) * 0.42 : Math.sin(t * 1.4 + p.phase) * 0.04;
        const bob = isMoving ? Math.abs(Math.sin(walkPhase)) * 0.05 : 0;
        const yaw = isMoving
          ? Math.atan2(Math.cos(p.phase + t * p.speed * 0.25), -Math.sin(p.phase + t * p.speed * 0.25))
          : Math.sin(t * 0.3 + p.phase) * 0.4;
        tmp.euler.set(0, yaw, 0);
        tmp.quat.setFromEuler(tmp.euler);
        tmp.bodyQuat.copy(tmp.quat);
        const base = groundY + bob;

        setPart(body, i, x, base + m.torsoCenter, z, tmp.bodyQuat, p.build.shoulder, m.torsoLen, p.build.shoulder * 0.66);
        setPart(pelvis, i, x, base + m.hipY + 0.02, z, tmp.bodyQuat, 0.17 * p.build.hip, 0.115, 0.14 * p.build.hip);
        setPart(head, i, x, base + m.headCenter, z, tmp.bodyQuat, m.headR, m.headR * 1.04, m.headR * 1.03);
        setPart(
          hair,
          i,
          x,
          base + m.headCenter + m.headR * 0.07,
          z,
          tmp.bodyQuat,
          m.headR * 1.05,
          m.headR * 1.05,
          m.headR * 1.05,
        );

        if (lod === 'simple') {
          for (const mesh of [armL, armR, legL, legR, shoeL, shoeR]) zero(mesh, i);
        } else {
          tmp.axis.set(1, 0, 0);

          tmp.swingQuat.setFromAxisAngle(tmp.axis, swing);
          tmp.limbQuat.copy(tmp.bodyQuat).multiply(tmp.swingQuat);
          tmp.offset.set(m.shoulderHalf, m.shoulderY, 0).applyQuaternion(tmp.bodyQuat);
          setPart(armL, i, x + tmp.offset.x, base + tmp.offset.y, z + tmp.offset.z, tmp.limbQuat, p.build.arm, m.armLen, p.build.arm);

          tmp.swingQuat.setFromAxisAngle(tmp.axis, -swing);
          tmp.limbQuat.copy(tmp.bodyQuat).multiply(tmp.swingQuat);
          tmp.offset.set(-m.shoulderHalf, m.shoulderY, 0).applyQuaternion(tmp.bodyQuat);
          setPart(armR, i, x + tmp.offset.x, base + tmp.offset.y, z + tmp.offset.z, tmp.limbQuat, p.build.arm, m.armLen, p.build.arm);

          tmp.swingQuat.setFromAxisAngle(tmp.axis, -swing);
          tmp.limbQuat.copy(tmp.bodyQuat).multiply(tmp.swingQuat);
          tmp.offset.set(m.hipHalf, m.hipY, 0).applyQuaternion(tmp.bodyQuat);
          const hipLX = x + tmp.offset.x;
          const hipLY = base + tmp.offset.y;
          const hipLZ = z + tmp.offset.z;
          setPart(legL, i, hipLX, hipLY, hipLZ, tmp.limbQuat, p.build.leg, m.legLen, p.build.leg);
          tmp.offset.set(0, -m.legLen + 0.05, -0.035).applyQuaternion(tmp.limbQuat);
          setPart(shoeL, i, hipLX + tmp.offset.x, hipLY + tmp.offset.y, hipLZ + tmp.offset.z, tmp.bodyQuat, 0.085 * p.build.leg, 0.048, 0.13 * p.build.leg);

          tmp.swingQuat.setFromAxisAngle(tmp.axis, swing);
          tmp.limbQuat.copy(tmp.bodyQuat).multiply(tmp.swingQuat);
          tmp.offset.set(-m.hipHalf, m.hipY, 0).applyQuaternion(tmp.bodyQuat);
          const hipRX = x + tmp.offset.x;
          const hipRY = base + tmp.offset.y;
          const hipRZ = z + tmp.offset.z;
          setPart(legR, i, hipRX, hipRY, hipRZ, tmp.limbQuat, p.build.leg, m.legLen, p.build.leg);
          tmp.offset.set(0, -m.legLen + 0.05, -0.035).applyQuaternion(tmp.limbQuat);
          setPart(shoeR, i, hipRX + tmp.offset.x, hipRY + tmp.offset.y, hipRZ + tmp.offset.z, tmp.bodyQuat, 0.085 * p.build.leg, 0.048, 0.13 * p.build.leg);
        }
      }

      if (p.named) {
        let sprite = labelsRef.current.get(p.id);
        if (!sprite) {
          const npc = state.npcs[p.id];
          sprite = labelSprite(npc?.name ?? p.id);
          labelsRef.current.set(p.id, sprite);
          labelGroupRef.current?.add(sprite);
        }
        sprite.position.set(x, groundY + m.top + 0.25, z);
        sprite.visible = distToPlayer < 34;
        const scale = THREE.MathUtils.clamp(distToPlayer / 14, 1, 2.4);
        sprite.scale.set(3.2 * scale, 0.4 * scale, 1);
      }
    }

    for (const mesh of [body, pelvis, head, hair, armL, armR, legL, legR, shoeL, shoeR, impostorTorso, impostorLegs, impostorHead, impostorHair]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <primitive object={meshes.body} />
      <primitive object={meshes.pelvis} />
      <primitive object={meshes.head} />
      <primitive object={meshes.hair} />
      <primitive object={meshes.armL} />
      <primitive object={meshes.armR} />
      <primitive object={meshes.legL} />
      <primitive object={meshes.legR} />
      <primitive object={meshes.shoeL} />
      <primitive object={meshes.shoeR} />
      <primitive object={meshes.impostorTorso} />
      <primitive object={meshes.impostorLegs} />
      <primitive object={meshes.impostorHead} />
      <primitive object={meshes.impostorHair} />
      <group ref={labelGroupRef} />
    </group>
  );
}
