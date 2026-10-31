import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGame, type NearbyInfo } from '../state/store';
import { qualityTiers, type QualityTier } from './controls';
import { SkyAndWeather } from './Sky';
import { InteriorScene } from './Interior';
import { LegacyScene } from './LegacyScene';
import { GeoScene, type GeoStatus } from './geo/GeoScene';
import { isGeographicWorldEnabled, WORLD_MODE_EVENT } from './worldMode';

export function GameCanvas({ onInteract }: { onInteract: (n: NearbyInfo) => void }) {
  const engine = useGame((s) => s.engine);
  const modal = useGame((s) => s.modal);
  const district = useGame((s) => s.engine?.state.player.district ?? 'mvog_mbi');
  const [geoEnabled, setGeoEnabled] = useState(() => isGeographicWorldEnabled());
  const [geoFailed, setGeoFailed] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeoStatus | null>(null);
  const dataSaver = engine?.state.settings.dataSaver ?? false;
  const declared = (engine?.state.settings.quality ?? 'mid') as QualityTier;
  const quality: QualityTier = dataSaver ? (declared === 'high' ? 'mid' : 'low') : declared;
  const tier = qualityTiers[quality] ?? qualityTiers.mid;

  useEffect(() => {
    const sync = () => setGeoEnabled(isGeographicWorldEnabled());
    window.addEventListener(WORLD_MODE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(WORLD_MODE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (district !== 'nlongkak') setGeoFailed(false);
  }, [district]);

  const onUnavailable = useCallback((reason: string) => {
    setGeoFailed(true);
    useGame.getState().engine?.toast(
      'Geographic Nlongkak is unavailable. Using the legacy neighbourhood.',
      'info',
      'La géographie de Nlongkak est indisponible. Quartier classique utilisé.',
    );
    console.warn('Geographic world fallback:', reason);
  }, []);

  if (!engine) return null;
  const useGeo = district === 'nlongkak' && geoEnabled && !geoFailed;

  return (
    <div className="game-canvas">
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
            {useGeo ? (
              <GeoScene quality={quality} onInteract={onInteract} onStatus={setGeoStatus} onUnavailable={onUnavailable} />
            ) : (
              <LegacyScene quality={quality} onInteract={onInteract} />
            )}
          </>
        )}
      </Canvas>
      {useGeo && geoStatus && geoStatus.phase !== 'ready' && (
        <div className="world-loading" role="status">
          <span>{geoStatus.message}</span>
          <small>{geoStatus.phase === 'error' ? 'Falling back to the legacy neighbourhood…' : 'Real OSM + Copernicus data'}</small>
        </div>
      )}
    </div>
  );
}
