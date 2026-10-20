import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { buildCharacter, animateCharacter, type CharacterClip, type CharacterParts } from './characters';

const SIT_INTERIORS = new Set(['home_room', 'njangi', 'bank', 'bar', 'restaurant']);

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: string) {
  return { w, h, d, x, y, z, color };
}

interface Furniture {
  w: number; h: number; d: number; x: number; y: number; z: number; color: string;
}

function furnitureFor(interiorId: string): { walls: Furniture[]; floorColor: string } {
  const base: Furniture[] = [
    box(14, 0.3, 10, 0, -0.15, 0, '#8a7a66'),
    box(14, 3.4, 0.3, 0, 1.7, -5, '#b9a98f'),
    box(0.3, 3.4, 10, -7, 1.7, 0, '#b0a089'),
    box(0.3, 3.4, 10, 7, 1.7, 0, '#b0a089'),
    box(3.2, 2.4, 0.18, 0, 1.2, 4.9, '#7a5b3a'),
    box(1.6, 0.35, 1.6, 5.6, 0.18, 3.6, '#6d4c41'),
    box(0.4, 0.5, 0.4, 5.6, 0.55, 3.6, '#2fa05a'),
  ];
  if (interiorId === 'home_room') {
    return {
      floorColor: '#8a7a66',
      walls: [
        ...base,
        box(2.6, 0.45, 1.7, -4.6, 0.25, -3.4, '#5c6b73'),
        box(2.4, 0.12, 0.5, -4.6, 0.55, -4.05, '#e8e2d4'),
        box(1.5, 0.08, 1.2, -1.2, 0.4, -3.6, '#c96f4a'),
        box(0.9, 0.8, 0.9, 2.4, 0.4, -3.8, '#7a5b3a'),
        box(1.4, 0.08, 0.8, 2.4, 0.84, -3.8, '#8c6b45'),
        box(1.6, 1.1, 0.5, -0.4, 0.55, -4.6, '#3f4a55'),
        box(1.3, 0.75, 0.06, -0.4, 1.15, -4.35, '#1a2530'),
        box(2.6, 0.9, 0.8, 5.2, 0.45, -3.9, '#9a8f7f'),
        box(0.6, 0.5, 0.6, 4.6, 0.25, -4.3, '#3a3a3a'),
        box(0.34, 0.28, 0.34, 5.8, 1.05, -4.4, '#2fa05a'),
      ],
    };
  }
  if (interiorId === 'njangi') {
    const stools: Furniture[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      stools.push(box(0.6, 0.45, 0.6, Math.cos(a) * 2.2, 0.22, Math.sin(a) * 2.2 - 1, '#8c6b45'));
    }
    return {
      floorColor: '#7d6b52',
      walls: [
        ...base,
        ...stools,
        box(1.4, 0.5, 1.4, 0, 0.4, -1, '#5c6b73'),
        box(0.8, 0.3, 0.8, 0, 0.75, -1, '#c96f4a'),
        box(2.2, 2.2, 0.12, -0.4, 1.1, -4.8, '#2c3e50'),
        box(2, 0.02, 1.4, 0, 0.02, 1.8, '#3f6f8a'),
      ],
    };
  }
  if (interiorId === 'bank') {
    return {
      floorColor: '#9c9c96',
      walls: [
        ...base,
        box(7, 1.0, 1.1, 0, 0.5, -2.8, '#b9b2a6'),
        box(7, 1.6, 0.06, 0, 1.9, -2.8, '#a8c6d8'),
        box(2.4, 0.75, 1.1, 4.4, 0.38, -3.2, '#7a5b3a'),
        box(1.2, 0.45, 0.6, -4.8, 0.22, -2.6, '#3f4a55'),
        box(0.12, 3.2, 6, 3.4, 1.6, 0.6, '#c9bfa8'),
      ],
    };
  }
  if (interiorId === 'gym') {
    return {
      floorColor: '#5c6b73',
      walls: [
        ...base,
        box(1.8, 0.5, 0.5, -3.4, 0.25, -3.2, '#2c3e50'),
        box(1.8, 0.5, 0.5, -3.4, 0.8, -3.2, '#2c3e50'),
        box(2.2, 0.15, 0.6, 3.6, 0.08, -2.2, '#3a3a3a'),
        box(2.2, 0.15, 0.6, 3.6, 0.75, -2.2, '#3a3a3a'),
        box(0.6, 1.4, 0.6, 4.6, 0.7, -3.6, '#c96f4a'),
        box(0.5, 0.5, 0.5, -5.6, 0.25, 1.4, '#2fa05a'),
        box(0.5, 0.5, 0.5, -5.6, 0.25, -0.4, '#f2b134'),
      ],
    };
  }
  if (interiorId === 'bar' || interiorId === 'restaurant') {
    return {
      floorColor: '#6d5442',
      walls: [
        ...base,
        box(6, 1.05, 1, 0, 0.52, -3.4, '#7a5b3a'),
        box(6, 0.08, 1.2, 0, 1.1, -3.4, '#8c6b45'),
        box(0.6, 0.9, 0.6, -1.6, 0.45, -1.6, '#5c6b73'),
        box(0.6, 0.9, 0.6, 1.6, 0.45, -1.6, '#5c6b73'),
        box(0.6, 0.9, 0.6, -1.6, 0.45, -0.2, '#5c6b73'),
        box(0.6, 0.9, 0.6, 1.6, 0.45, -0.2, '#5c6b73'),
        box(0.34, 0.4, 0.34, -1.6, 1.3, -3.4, '#2fa05a'),
        box(0.34, 0.4, 0.34, 1.6, 1.3, -3.4, '#e0532f'),
      ],
    };
  }
  return { floorColor: '#8a7a66', walls: base };
}

export function InteriorScene({ interiorId }: { interiorId: string }) {
  const engine = useGame((s) => s.engine);
  const partsRef = useRef<CharacterParts | null>(null);
  const { walls, floorColor } = useMemo(() => furnitureFor(interiorId), [interiorId]);
  const appearance = engine?.state.player.appearance;
  const appearanceKey = appearance ? JSON.stringify(appearance) : '';

  useMemo(() => {
    if (!appearance) return;
    partsRef.current = buildCharacter(appearance);
  }, [appearanceKey]);

  const clip: CharacterClip = SIT_INTERIORS.has(interiorId) ? 'sit' : 'idle';

  useFrame(({ clock }, dt) => {
    if (partsRef.current) {
      animateCharacter(partsRef.current, clock.elapsedTime, false, 1, clip, Math.min(dt, 0.1));
    }
  });

  return (
    <group>
      <color attach="background" args={[floorColor]} />
      <ambientLight intensity={0.55} color="#ffe9c9" />
      <pointLight position={[0, 3.4, 2.5]} intensity={1.1} color="#ffd9a0" />
      <directionalLight position={[-3, 5, 4]} intensity={0.35} />
      {walls.map((f, i) => (
        <mesh key={i} position={[f.x, f.y, f.z]}>
          <boxGeometry args={[f.w, f.h, f.d]} />
          <meshLambertMaterial color={f.color} />
        </mesh>
      ))}
      {clip === 'sit' ? (
        <mesh position={[0, 0.18, 0.6]}>
          <boxGeometry args={[0.62, 0.36, 0.62]} />
          <meshLambertMaterial color="#6d4c41" />
        </mesh>
      ) : null}
      {partsRef.current ? (
        <group position={[0, 0, 0.6]} rotation={[0, Math.PI, 0]}>
          <primitive object={partsRef.current.group} />
        </group>
      ) : null}
    </group>
  );
}
