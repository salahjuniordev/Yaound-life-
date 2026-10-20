import { useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, type NearbyInfo } from '../state/store';
import { qualityTiers, type QualityTier } from './controls';
import { SkyAndWeather } from './Sky';
import { WorldMeshes } from './World';
import { Crowd } from './Crowd';
import { PlayerRig } from './PlayerRig';
import { InteriorScene } from './Interior';

export function GameCanvas({ onInteract }: { onInteract: (n: NearbyInfo) => void }) {
  const engine = useGame((s) => s.engine);
  const modal = useGame((s) => s.modal);
  const dataSaver = engine?.state.settings.dataSaver ?? false;
  const declared = (engine?.state.settings.quality ?? 'mid') as QualityTier;
  const quality: QualityTier = dataSaver ? (declared === 'high' ? 'mid' : 'low') : declared;
  const tier = qualityTiers[quality] ?? qualityTiers.mid;
  const [terrain, setTerrain] = useState<THREE.Mesh | null>(null);
  const onTerrainReady = useCallback((mesh: THREE.Mesh) => setTerrain(mesh), []);

  if (!engine) return null;

  return (
    <Canvas
      dpr={tier.dpr}
      shadows={tier.shadows}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
      camera={{ fov: 55, near: 0.25, far: 900, position: [18, 12, 97] }}
      onCreated={({ gl }) => {
        gl.setClearColor('#cfe3f0');
      }}
    >
      {modal.kind === 'interior' ? (
        <InteriorScene interiorId={modal.interiorId} />
      ) : (
        <>
          <SkyAndWeather quality={quality} />
          <WorldMeshes quality={quality} onTerrainReady={onTerrainReady} />
          <Crowd quality={quality} />
          <PlayerRig quality={quality} onInteract={onInteract} terrain={terrain} />
        </>
      )}
    </Canvas>
  );
}
