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
import type { DistrictId } from '../sim/types';

interface Person {
  id: string;
  baseX: number;
  baseZ: number;
  shirt: THREE.Color;
  pants: THREE.Color;
  skin: THREE.Color;
  hair: THREE.Color;
  speed: number;
  phase: number;
  moving: boolean;
  named?: boolean;
}

const HAIR_COLORS = ['#1c1c1c', '#241a12', '#2a1c10', '#3a2418', '#211812', '#151515'];

function hashPick(colors: string[], id: string): THREE.Color {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return new THREE.Color(colors[h % colors.length]);
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
    const bodyGeo = new THREE.BoxGeometry(0.5, 0.62, 0.3);
    bodyGeo.translate(0, 0.93, 0);
    const headGeo = new THREE.BoxGeometry(0.4, 0.38, 0.36);
    headGeo.translate(0, 1.43, 0);
    const hairGeo = new THREE.BoxGeometry(0.43, 0.12, 0.45);
    hairGeo.translate(0, 1.5, 0.02);
    const armGeo = new THREE.BoxGeometry(0.13, 0.58, 0.13);
    armGeo.translate(0, -0.29, 0);
    const legGeo = new THREE.BoxGeometry(0.17, 0.6, 0.17);
    legGeo.translate(0, -0.31, 0);

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
      head: mk(headGeo, capacity),
      hair: mk(hairGeo, capacity),
      armL: mk(armGeo, capacity),
      armR: mk(armGeo, capacity),
      legL: mk(legGeo, capacity),
      legR: mk(legGeo, capacity),
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
    const regenKey = `${playerDistrict}_${day}_${Math.floor(minute / 180)}`;

    const zone = DISTRICT_MAP[playerDistrict];
    if (regenKey !== regenKeyRef.current) {
      regenKeyRef.current = regenKey;
      const crowd = crowdForDistrict(playerDistrict, day, minute, tier.crowd, zone.center, zone.radius);
      const persons: Person[] = [];
      for (const npc of Object.values(state.npcs)) {
        const np = npcPositionFor(npc, minute);
        const look = CAST_LOOKS[npc.id];
        persons.push({
          id: npc.id,
          baseX: np.pos[0],
          baseZ: np.pos[1],
          shirt: look ? new THREE.Color(look.shirt) : hashPick(SHIRT_COLORS, npc.id),
          pants: look ? new THREE.Color(look.pants) : hashPick(PANTS_COLORS, npc.id),
          skin: look ? new THREE.Color(look.skin) : hashPick(SKIN_TONES as unknown as string[], npc.id + 's'),
          hair: look ? new THREE.Color(look.headwear ?? look.hair) : hashPick(HAIR_COLORS, npc.id + 'h'),
          speed: 0.8,
          phase: Math.random() * 6.28,
          moving: false,
          named: true,
        });
      }
      for (const m of crowd) {
        persons.push({
          id: m.id,
          baseX: m.pos[0],
          baseZ: m.pos[1],
          shirt: new THREE.Color(m.shirt),
          pants: new THREE.Color(m.pants),
          skin: new THREE.Color(SKIN_TONES[m.skin % SKIN_TONES.length]),
          hair: new THREE.Color(HAIR_COLORS[m.hair % HAIR_COLORS.length]),
          speed: m.speed,
          phase: m.phase,
          moving: m.moving,
        });
      }
      peopleRef.current = persons.slice(0, capacity);
      const { body, head, hair, armL, armR, legL, legR, impostorTorso, impostorLegs, impostorHead, impostorHair } = meshes;
      peopleRef.current.forEach((p, i) => {
        body.setColorAt(i, p.shirt);
        head.setColorAt(i, p.skin);
        hair.setColorAt(i, p.hair);
        armL.setColorAt(i, p.skin);
        armR.setColorAt(i, p.skin);
        legL.setColorAt(i, p.pants);
        legR.setColorAt(i, p.pants);
        impostorTorso.setColorAt(i, p.shirt);
        impostorLegs.setColorAt(i, p.pants);
        impostorHead.setColorAt(i, p.skin);
        impostorHair.setColorAt(i, p.hair);
      });
      const all = [body, head, hair, armL, armR, legL, legR, impostorTorso, impostorLegs, impostorHead, impostorHair];
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
    const { body, head, hair, armL, armR, legL, legR, impostorTorso, impostorLegs, impostorHead, impostorHair } = meshes;

    const zero = (mesh: THREE.InstancedMesh, i: number) => {
      tmp.m.makeScale(0, 0, 0);
      mesh.setMatrixAt(i, tmp.m);
    };
    const setPlane = (mesh: THREE.InstancedMesh, i: number, x: number, y: number, z: number) => {
      tmp.pos.set(x, y, z);
      tmp.m.compose(tmp.pos, tmp.quat, tmp.scale.set(1, 1, 1));
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
        zero(body, i);
        zero(head, i);
        zero(hair, i);
        zero(armL, i);
        zero(armR, i);
        zero(legL, i);
        zero(legR, i);
        zero(impostorTorso, i);
        zero(impostorLegs, i);
        zero(impostorHead, i);
        zero(impostorHair, i);
        continue;
      }

      const groundY = terrainHeight(x, z);
      const lod = crowdLodFor(Math.hypot(x - camX, z - camZ), quality);

      if (lod === 'impostor') {
        zero(body, i);
        zero(head, i);
        zero(hair, i);
        zero(armL, i);
        zero(armR, i);
        zero(legL, i);
        zero(legR, i);
        const yaw = Math.atan2(camX - x, camZ - z);
        tmp.quat.setFromEuler(tmp.euler.set(0, yaw, 0));
        const bob = p.moving ? Math.abs(Math.sin(t * p.speed * 4 + p.phase)) * 0.03 : 0;
        setPlane(impostorTorso, i, x, groundY + 0.93 + bob, z);
        setPlane(impostorLegs, i, x, groundY + 0.34 + bob * 0.5, z);
        setPlane(impostorHead, i, x, groundY + 1.46 + bob, z);
        setPlane(impostorHair, i, x, groundY + 1.58 + bob, z);
      } else {
        zero(impostorTorso, i);
        zero(impostorLegs, i);
        zero(impostorHead, i);
        zero(impostorHair, i);
        const walkPhase = t * p.speed * 6 + p.phase;
        const isMoving = p.named ? false : p.moving;
        const swing = isMoving ? Math.sin(walkPhase) * 0.65 : Math.sin(t * 1.4 + p.phase) * 0.06;
        const bob = isMoving ? Math.abs(Math.sin(walkPhase)) * 0.05 : 0;
        const yaw = isMoving ? Math.atan2(Math.cos(p.phase + t * p.speed * 0.25), -Math.sin(p.phase + t * p.speed * 0.25)) : Math.sin(t * 0.3 + p.phase) * 0.4;
        tmp.euler.set(0, yaw, 0);
        tmp.quat.setFromEuler(tmp.euler);
        tmp.bodyQuat.copy(tmp.quat);

        tmp.pos.set(x, groundY + bob, z);
        tmp.m.compose(tmp.pos, tmp.quat, tmp.scale.set(1, 1, 1));
        body.setMatrixAt(i, tmp.m);
        head.setMatrixAt(i, tmp.m);
        hair.setMatrixAt(i, tmp.m);

        if (lod === 'simple') {
          zero(armL, i);
          zero(armR, i);
          zero(legL, i);
          zero(legR, i);
        } else {
          tmp.axis.set(1, 0, 0);
          tmp.swingQuat.setFromAxisAngle(tmp.axis, swing);
          tmp.limbQuat.copy(tmp.bodyQuat).multiply(tmp.swingQuat);
          tmp.offset.set(0.315, 1.18, 0).applyQuaternion(tmp.bodyQuat);
          tmp.pos.set(x + tmp.offset.x, groundY + bob + tmp.offset.y, z + tmp.offset.z);
          tmp.m.compose(tmp.pos, tmp.limbQuat, tmp.scale.set(1, 1, 1));
          armL.setMatrixAt(i, tmp.m);

          tmp.swingQuat.setFromAxisAngle(tmp.axis, -swing);
          tmp.limbQuat.copy(tmp.bodyQuat).multiply(tmp.swingQuat);
          tmp.offset.set(-0.315, 1.18, 0).applyQuaternion(tmp.bodyQuat);
          tmp.pos.set(x + tmp.offset.x, groundY + bob + tmp.offset.y, z + tmp.offset.z);
          tmp.m.compose(tmp.pos, tmp.limbQuat, tmp.scale.set(1, 1, 1));
          armR.setMatrixAt(i, tmp.m);

          tmp.swingQuat.setFromAxisAngle(tmp.axis, -swing);
          tmp.limbQuat.copy(tmp.bodyQuat).multiply(tmp.swingQuat);
          tmp.offset.set(0.12, 0.62, 0).applyQuaternion(tmp.bodyQuat);
          tmp.pos.set(x + tmp.offset.x, groundY + bob + tmp.offset.y, z + tmp.offset.z);
          tmp.m.compose(tmp.pos, tmp.limbQuat, tmp.scale.set(1, 1, 1));
          legL.setMatrixAt(i, tmp.m);

          tmp.swingQuat.setFromAxisAngle(tmp.axis, swing);
          tmp.limbQuat.copy(tmp.bodyQuat).multiply(tmp.swingQuat);
          tmp.offset.set(-0.12, 0.62, 0).applyQuaternion(tmp.bodyQuat);
          tmp.pos.set(x + tmp.offset.x, groundY + bob + tmp.offset.y, z + tmp.offset.z);
          tmp.m.compose(tmp.pos, tmp.limbQuat, tmp.scale.set(1, 1, 1));
          legR.setMatrixAt(i, tmp.m);
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
        sprite.position.set(x, groundY + 2.05, z);
        sprite.visible = distToPlayer < 34;
        const scale = THREE.MathUtils.clamp(distToPlayer / 14, 1, 2.4);
        sprite.scale.set(3.2 * scale, 0.4 * scale, 1);
      }
    }

    for (const mesh of [body, head, hair, armL, armR, legL, legR, impostorTorso, impostorLegs, impostorHead, impostorHair]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <primitive object={meshes.body} />
      <primitive object={meshes.head} />
      <primitive object={meshes.hair} />
      <primitive object={meshes.armL} />
      <primitive object={meshes.armR} />
      <primitive object={meshes.legL} />
      <primitive object={meshes.legR} />
      <primitive object={meshes.impostorTorso} />
      <primitive object={meshes.impostorLegs} />
      <primitive object={meshes.impostorHead} />
      <primitive object={meshes.impostorHair} />
      <group ref={labelGroupRef} />
    </group>
  );
}
