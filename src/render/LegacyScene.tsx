import { useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGame, type NearbyInfo } from '../state/store';
import type { QualityTier } from './controls';
import { useWorld, WorldMeshes } from './World';
import { Crowd } from './Crowd';
import { PlayerRig } from './PlayerRig';
import { createLegacyAdapter } from './geo/adapter';

interface LegacySceneProps {
  quality: QualityTier;
  onInteract: (nearby: NearbyInfo) => void;
}

export function LegacyScene({ quality, onInteract }: LegacySceneProps) {
  const world = useWorld(quality);
  const district = useGame((state) => state.engine?.state.player.district ?? 'mvog_mbi');
  const adapter = useMemo(() => createLegacyAdapter(quality, world.obstacles), [quality, world]);
  const spawn = useMemo(() => adapter.spawnForDistrict(district), [adapter, district]);
  const [terrain, setTerrain] = useState<THREE.Mesh | null>(null);
  const onTerrainReady = useCallback((mesh: THREE.Mesh) => setTerrain(mesh), []);

  return (
    <>
      <WorldMeshes quality={quality} world={world} onTerrainReady={onTerrainReady} />
      <Crowd quality={quality} world={adapter} />
      <PlayerRig
        key={`legacy-${district}`}
        quality={quality}
        onInteract={onInteract}
        terrain={terrain}
        world={adapter}
        spawn={spawn}
      />
    </>
  );
}
