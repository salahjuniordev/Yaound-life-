import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { buildCharacter, animateCharacter, type CharacterClip, type CharacterParts } from './characters';
import { SIT_INTERIORS, interiorLayout, type PropDef } from './interiorProps';

const matCache = new Map<string, THREE.MeshLambertMaterial>();

function matFor(color: string): THREE.MeshLambertMaterial {
  let mat = matCache.get(color);
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, mat);
  }
  return mat;
}

function InteriorCamera({ interiorId }: { interiorId: string }) {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.set(0, 2.75, 6.4);
    camera.lookAt(0, 1.05, -1.0);
    camera.updateMatrixWorld(true);
  }, [camera, interiorId]);
  return null;
}

function InteriorFog() {
  const scene = useThree((s) => s.scene);
  useLayoutEffect(() => {
    const previous = scene.fog;
    scene.fog = null;
    return () => {
      scene.fog = previous;
    };
  }, [scene]);
  return null;
}

function PropMesh({ prop }: { prop: PropDef }) {
  return (
    <mesh
      position={[prop.x, prop.y, prop.z]}
      rotation={[prop.rx ?? 0, prop.ry ?? 0, prop.rz ?? 0]}
      material={matFor(prop.color)}
    >
      {prop.shape === 'box' ? (
        <boxGeometry args={[prop.w, prop.h, prop.d]} />
      ) : prop.shape === 'cyl' ? (
        <cylinderGeometry args={[prop.r, prop.r, prop.h, 8]} />
      ) : (
        <sphereGeometry args={[prop.r, 10, 8]} />
      )}
    </mesh>
  );
}

export function InteriorScene({ interiorId }: { interiorId: string }) {
  const engine = useGame((s) => s.engine);
  const partsRef = useRef<CharacterParts | null>(null);
  const { floorColor, props } = useMemo(() => interiorLayout(interiorId), [interiorId]);
  const appearance = engine?.state.player.appearance;
  const appearanceKey = appearance ? JSON.stringify(appearance) : '';
  const sex = engine?.state.player.gender ?? 'x';

  useMemo(() => {
    if (!appearance) return;
    partsRef.current = buildCharacter(appearance, sex);
  }, [appearanceKey, sex]);

  const clip: CharacterClip = SIT_INTERIORS.has(interiorId) ? 'sit' : 'idle';

  useFrame(({ clock }, dt) => {
    if (partsRef.current) {
      animateCharacter(partsRef.current, clock.elapsedTime, false, 1, clip, Math.min(dt, 0.1));
    }
  });

  return (
    <group>
      <InteriorFog />
      <InteriorCamera interiorId={interiorId} />
      <color attach="background" args={[floorColor]} />
      <ambientLight intensity={0.55} color="#ffe9c9" />
      <pointLight position={[0, 3.4, 2.5]} intensity={1.1} color="#ffd9a0" />
      <directionalLight position={[-3, 5, 4]} intensity={0.35} />
      {props.map((prop, i) => (
        <PropMesh key={i} prop={prop} />
      ))}
      {clip === 'sit' ? (
        <mesh position={[0, 0.225, 0.6]}>
          <boxGeometry args={[0.62, 0.45, 0.62]} />
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
