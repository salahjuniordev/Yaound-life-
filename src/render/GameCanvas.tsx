import { useCallback, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGame, type NearbyInfo } from '../state/store';
import { loadWorldRegistry } from '../world/loader';
import {
  compatibleWorldPackForDistrict,
  worldPackCompatibilityError,
  BUILTIN_WORLD_REGISTRY,
  type WorldPackRegistry,
} from '../world/registry';
import { qualityTiers, type QualityTier } from './controls';
import { SkyAndWeather } from './Sky';
import { InteriorScene } from './Interior';
import { LegacyScene } from './LegacyScene';
import { GeoScene, type GeoStatus } from './geo/GeoScene';
import { isWorldDebugEnabled, readWorldMetrics, type WorldRenderMetrics } from './geo/metrics';
import { isGeographicWorldEnabled, WORLD_MODE_EVENT } from './worldMode';

export function GameCanvas({ onInteract }: { onInteract: (n: NearbyInfo) => void }) {
  const engine = useGame((s) => s.engine);
  const modal = useGame((s) => s.modal);
  const district = useGame((s) => s.engine?.state.player.district ?? 'mvog_mbi');
  const [geoEnabled, setGeoEnabled] = useState(() => isGeographicWorldEnabled());
  const [geoFailed, setGeoFailed] = useState(false);
  const [geoStatus, setGeoStatus] = useState<GeoStatus | null>(null);
  const [registry, setRegistry] = useState<WorldPackRegistry>(BUILTIN_WORLD_REGISTRY);
  const [worldDebug] = useState(() => isWorldDebugEnabled());
  const [worldMetrics, setWorldMetrics] = useState<WorldRenderMetrics | null>(null);
  const pack = useMemo(() => compatibleWorldPackForDistrict(registry, district), [registry, district]);
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
    let live = true;
    loadWorldRegistry(import.meta.env.BASE_URL)
      .then((next) => {
        if (!live) return;
        setRegistry(next);
        for (const entry of next.packs) {
          const issue = worldPackCompatibilityError(entry);
          if (issue) console.warn(issue);
        }
      })
      .catch((error) => {
        if (live) console.warn('World registry unavailable; using the built-in district pack mapping.', error);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    setGeoFailed(false);
    setGeoStatus(null);
  }, [district, pack?.id, pack?.worldVersion]);

  useEffect(() => {
    if (!worldDebug) return;
    const update = () => setWorldMetrics(readWorldMetrics());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [worldDebug]);

  const onUnavailable = useCallback((reason: string) => {
    setGeoFailed(true);
    const label = pack?.name ?? 'geographic world';
    useGame.getState().engine?.toast(
      `Geographic ${label} is unavailable. Using the legacy neighbourhood.`,
      'info',
      `La géographie de ${label} est indisponible. Quartier classique utilisé.`,
    );
    console.warn('Geographic world fallback:', reason);
  }, [pack?.name]);

  if (!engine) return null;
  const useGeo = Boolean(pack) && geoEnabled && !geoFailed;

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
            {useGeo && pack ? (
              <GeoScene
                key={`geo-${pack.id}-${pack.worldVersion}-${quality}`}
                pack={pack}
                quality={quality}
                onInteract={onInteract}
                onStatus={setGeoStatus}
                onUnavailable={onUnavailable}
              />
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
      {worldDebug && worldMetrics && (
        <div className="world-metrics" role="status">
          <strong>world debug</strong>
          <span>
            {Math.round(worldMetrics.fps)} FPS · {worldMetrics.frameMs.toFixed(1)} ms
          </span>
          <span>
            chunks {worldMetrics.loadedChunks} · buildings {worldMetrics.activeBuildings.toLocaleString()}
          </span>
          <span>
            tris {Math.round(worldMetrics.triangles).toLocaleString()} · calls {worldMetrics.drawCalls}
          </span>
          <span>
            geo {worldMetrics.geometries} · tex {worldMetrics.textures}
          </span>
        </div>
      )}
    </div>
  );
}
