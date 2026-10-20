import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, type NearbyInfo } from '../state/store';
import { buildCharacter, animateCharacter, type CharacterClip, type CharacterParts } from './characters';
import { terrainHeight } from '../sim/world';
import { districtAt, DISTRICT_MAP } from '../data/districts';
import { PLACES, type PlaceDef } from '../data/places';
import { npcActivityText } from '../sim/npcsim';
import { iconSprite, npcRuntime } from './runtime';
import { worldGlyphFor } from './worldIcons';
import { cameraState, moveInput, tapState, type QualityTier } from './controls';
import { buildWorldGeometry, type Obstacle } from './worldGeometry';

const KIND_RING: Record<string, string> = {
  home: '#2fa05a', vendor: '#f2b134', activity: '#2f6fe0', taxi: '#e8b02c',
  landmark: '#8e44ad', interior: '#d94f6b', npc_spot: '#ffffff',
};

function placeLabel(p: PlaceDef, fr: boolean): string {
  switch (p.kind) {
    case 'taxi':
      return fr ? `Voyager — ${p.nameFr}` : `Travel — ${p.name}`;
    case 'home':
      return fr ? `Entrer — ${p.nameFr}` : `Enter — ${p.name}`;
    case 'interior':
      return fr ? `Entrer — ${p.nameFr}` : `Enter — ${p.name}`;
    case 'vendor':
      return fr ? `Commerce — ${p.nameFr}` : `Shop — ${p.name}`;
    default:
      return fr ? p.nameFr : p.name;
  }
}

interface PlayerRigProps {
  quality: QualityTier;
  onInteract: (nearby: NearbyInfo) => void;
  terrain: THREE.Mesh | null;
}

export function PlayerRig({ quality, onInteract, terrain }: PlayerRigProps) {
  const engine = useGame((s) => s.engine);
  const { camera, gl } = useThree();
  const partsRef = useRef<CharacterParts | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const tapMarkerRef = useRef<THREE.Mesh>(null);
  const markerGroupRef = useRef<THREE.Group>(null);
  const posRef = useRef({ x: useGame.getState().player.x, z: useGame.getState().player.z });
  const yawRef = useRef(Math.PI);
  const keysRef = useRef<Set<string>>(new Set());
  const lastDistrictRef = useRef<string>('');
  const publishTimer = useRef(0);
  const proximityTimer = useRef(0);
  const arrivedTarget = useRef(true);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const pointerDownRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const appearance = engine?.state.player.appearance;
  const appearanceKey = appearance ? JSON.stringify(appearance) : '';

  useMemo(() => {
    if (!appearance) return;
    const parts = buildCharacter(appearance);
    parts.group.traverse((o) => {
      o.castShadow = quality === 'high';
    });
    partsRef.current = parts;
  }, [appearanceKey]);

  useEffect(() => {
    obstaclesRef.current = buildWorldGeometry(quality).obstacles;
    lastDistrictRef.current = engine?.state.player.district ?? 'mvog_mbi';
    const zone = DISTRICT_MAP[lastDistrictRef.current as keyof typeof DISTRICT_MAP];
    if (zone) {
      posRef.current = { x: zone.center[0] + 5, z: zone.center[1] + 5 };
    }
  }, [quality, engine]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key.toLowerCase() === 'e') {
        const n = useGame.getState().nearby;
        if (n) onInteract(n);
      }
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [onInteract]);

  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      pointerDownRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      cameraState.dragging = true;
    };
    const onMove = (e: PointerEvent) => {
      if (!cameraState.dragging || !pointerDownRef.current) return;
      const dx = e.clientX - pointerDownRef.current.x;
      const dy = e.clientY - pointerDownRef.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        cameraState.yaw -= dx * 0.006;
        cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch + dy * 0.004, 0.12, 1.15);
        pointerDownRef.current.x = e.clientX;
        pointerDownRef.current.y = e.clientY;
      }
    };
    const onUp = (e: PointerEvent) => {
      cameraState.dragging = false;
      const start = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!start) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      const dt = performance.now() - start.t;
      if (moved < 8 && dt < 400 && terrain) {
        const rect = el.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObject(terrain, false);
        if (hits.length > 0) {
          tapState.target = { x: hits[0].point.x, z: hits[0].point.z };
          arrivedTarget.current = false;
        }
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, [gl, camera, terrain]);

  const markers = useMemo(
    () =>
      PLACES.map((place) => {
        const sprite = iconSprite(worldGlyphFor(place.icon), KIND_RING[place.kind] ?? '#ffffff');
        return { place, sprite };
      }),
    [],
  );

  useEffect(() => {
    if (!markerGroupRef.current) return;
    for (const m of markers) markerGroupRef.current.add(m.sprite);
  }, [markers]);

  useFrame(({ clock }, dt) => {
    if (!engine) return;
    const parts = partsRef.current;
    const group = groupRef.current;
    if (!parts || !group) return;
    const s = engine.state;
    const fr = s.settings.language === 'fr';
    const dtc = Math.min(dt, 0.1);

    let mx = 0;
    let mz = 0;
    const keys = keysRef.current;
    const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const kz = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
    if (kx || kz) {
      tapState.target = null;
      mx += kx * 0.7 + moveInput.x;
      mz += kz * 0.7 + moveInput.y;
    } else if (Math.abs(moveInput.x) > 0.05 || Math.abs(moveInput.y) > 0.05) {
      tapState.target = null;
      mx = moveInput.x;
      mz = moveInput.y;
    } else if (tapState.target && !arrivedTarget.current) {
      const dx = tapState.target.x - posRef.current.x;
      const dz = tapState.target.z - posRef.current.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8) {
        arrivedTarget.current = true;
        tapState.target = null;
      } else {
        mx = dx / d;
        mz = dz / d;
      }
    }

    const mag = Math.hypot(mx, mz);
    const moving = mag > 0.08;
    const running = moving && (keys.has('shift') || moveInput.run);
    let speed = running ? 7.4 : 4.3;
    if (s.player.needs.energy < 20) speed *= 0.72;
    if (s.player.needs.health < 25) speed *= 0.8;

    if (moving) {
      const nx = mx / mag;
      const nz = mz / mag;
      const camYaw = cameraState.yaw;
      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = -fz;
      const rz = fx;
      const dirX = fx * nz + rx * nx;
      const dirZ = fz * nz + rz * nx;
      const targetYaw = Math.atan2(-dirX, -dirZ);
      let dy = targetYaw - yawRef.current;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      yawRef.current += dy * Math.min(1, dtc * 10);
      posRef.current.x += dirX * speed * dtc;
      posRef.current.z += dirZ * speed * dtc;
    }

    for (const ob of obstaclesRef.current) {
      const dx = posRef.current.x - ob.x;
      const dz = posRef.current.z - ob.z;
      const min = ob.r + 0.4;
      const d = Math.hypot(dx, dz);
      if (d < min && d > 0.001) {
        posRef.current.x = ob.x + (dx / d) * min;
        posRef.current.z = ob.z + (dz / d) * min;
      }
    }
    posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -245, 255);
    posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -235, 185);

    const groundY = terrainHeight(posRef.current.x, posRef.current.z);
    group.position.set(posRef.current.x, groundY, posRef.current.z);
    group.rotation.y = yawRef.current;
    const phoneOpen = useGame.getState().panel === 'phone';
    const clip: CharacterClip = moving ? (running ? 'run' : 'walk') : phoneOpen ? 'phone' : 'idle';
    animateCharacter(parts, clock.elapsedTime, moving, 1 + (running ? 0.35 : 0), clip, dtc);

    const engineDistrict = engine.state.player.district;
    if (lastDistrictRef.current !== engineDistrict) {
      lastDistrictRef.current = engineDistrict;
      const zone = DISTRICT_MAP[engineDistrict];
      if (zone) {
        const distToCenter = Math.hypot(posRef.current.x - zone.center[0], posRef.current.z - zone.center[1]);
        if (distToCenter > zone.radius * 1.15) {
          posRef.current = { x: zone.center[0] + 5, z: zone.center[1] + 5 };
          tapState.target = null;
          arrivedTarget.current = true;
        }
      }
    } else {
      const here = districtAt(posRef.current.x, posRef.current.z);
      if (here !== engineDistrict) {
        useGame.getState().dispatch({ type: 'walk_enter', to: here });
        lastDistrictRef.current = here;
      }
    }

    const camDist = THREE.MathUtils.clamp(cameraState.distance, 7, quality === 'low' ? 10 : 16);
    const offX = Math.sin(cameraState.yaw) * Math.cos(cameraState.pitch) * camDist;
    const offY = Math.sin(cameraState.pitch) * camDist + 1.6;
    const offZ = Math.cos(cameraState.yaw) * Math.cos(cameraState.pitch) * camDist;
    const camTargetX = posRef.current.x + offX;
    const camTargetZ = posRef.current.z + offZ;
    const camFloor = terrainHeight(camTargetX, camTargetZ) + 1.1;
    const camTargetY = Math.max(groundY + offY, camFloor);
    camera.position.lerp(new THREE.Vector3(camTargetX, camTargetY, camTargetZ), Math.min(1, dtc * 7));
    const lookY = groundY + 1.35 + (cameraState.pitch < 0.3 ? -0.4 : 0);
    camera.lookAt(posRef.current.x, lookY, posRef.current.z);

    publishTimer.current += dtc;
    if (publishTimer.current > 0.25) {
      publishTimer.current = 0;
      useGame.getState().setPlayer({ x: posRef.current.x, z: posRef.current.z, yaw: yawRef.current, moving, running });
    }

    proximityTimer.current += dtc;
    if (proximityTimer.current > 0.22) {
      proximityTimer.current = 0;
      let best: NearbyInfo | null = null;
      let bestD = 6.5;
      const px = posRef.current.x;
      const pz = posRef.current.z;
      for (const p of PLACES) {
        const d = Math.hypot(px - p.pos[0], pz - p.pos[1]);
        if (d < bestD) {
          bestD = d;
          best = { kind: 'place', id: p.id, label: placeLabel(p, false), labelFr: placeLabel(p, true), icon: p.icon, placeId: p.id };
        }
      }
      for (const [npcId, rt] of Object.entries(npcRuntime)) {
        const d = Math.hypot(px - rt.x, pz - rt.z);
        if (d < 4.6 && d < bestD) {
          const npc = s.npcs[npcId];
          if (!npc) continue;
          const activity = npcActivityText(npc, s.world.minute, false);
          const activityFr = npcActivityText(npc, s.world.minute, true);
          best = {
            kind: 'npc',
            id: `npc_${npcId}`,
            label: `${npc.name} — ${activity}`,
            labelFr: `${npc.name} — ${activityFr}`,
            icon: 'people',
            npcId,
          };
          bestD = d;
        }
      }
      useGame.getState().setNearby(best);
    }

    const t = clock.elapsedTime;
    for (const m of markers) {
      const d = Math.hypot(posRef.current.x - m.place.pos[0], posRef.current.z - m.place.pos[1]);
      m.sprite.visible = d < 42;
      if (m.sprite.visible) {
        const y = terrainHeight(m.place.pos[0], m.place.pos[1]) + 2.3 + Math.sin(t * 2 + m.place.pos[0]) * 0.12;
        m.sprite.position.set(m.place.pos[0], y, m.place.pos[1]);
        const scale = THREE.MathUtils.clamp(d / 12, 0.9, 2.1);
        m.sprite.scale.set(1.4 * scale, 1.4 * scale, 1);
      }
    }

    if (tapMarkerRef.current) {
      const target = tapState.target;
      tapMarkerRef.current.visible = Boolean(target);
      if (target) {
        const ty = terrainHeight(target.x, target.z) + 0.15;
        tapMarkerRef.current.position.set(target.x, ty, target.z);
        const pulse = 1 + Math.sin(t * 6) * 0.12;
        tapMarkerRef.current.scale.set(pulse, 1, pulse);
      }
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        {partsRef.current ? <primitive object={partsRef.current.group} /> : null}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <circleGeometry args={[0.55, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      </group>
      <group ref={markerGroupRef} />
      <mesh ref={tapMarkerRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[1.1, 0.08, 8, 24]} />
        <meshBasicMaterial color="#f2b134" transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}
