import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildWorldGeometry, type Obstacle } from './worldGeometry';
import type { QualityTier } from './controls';

export function useWorld(quality: QualityTier) {
  return useMemo(() => buildWorldGeometry(quality), [quality]);
}

export function WorldMeshes({ quality, world, onTerrainReady }: { quality: QualityTier; world: ReturnType<typeof useWorld>; onTerrainReady?: (mesh: THREE.Mesh) => void }) {
  const terrainRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      <mesh
        ref={(m) => {
          terrainRef.current = m;
          if (m && onTerrainReady) onTerrainReady(m);
        }}
        geometry={world.terrain}
        receiveShadow={quality === 'high'}
      >
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={world.roads}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={world.city} castShadow={quality === 'high'}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={world.water}>
        <meshLambertMaterial color="#3f6f8a" transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

export type { Obstacle };
export { buildWorldGeometry };
