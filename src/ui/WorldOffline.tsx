import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../state/store';
import { loadManifest, loadWorldRegistry } from '../world/loader';
import {
  BUILTIN_WORLD_REGISTRY,
  compatibleWorldPackForDistrict,
  worldPackBaseUrl,
  worldPackCompatibilityError,
  type WorldPackEntry,
  type WorldPackRegistry,
} from '../world/registry';
import {
  formatBytes,
  summarizeWorldOffline,
  worldCacheName,
  type OfflineWorldSnapshot,
  type WorldFileCatalog,
} from '../world/offline';
import {
  WorldCacheError,
  cachedWorldPaths,
  cleanupOldWorldCaches,
  deleteWorldCache,
  downloadWorldPack,
  estimateWorldStorage,
  loadWorldCatalog,
  requestPersistentStorage,
  worldCacheSupported,
  worldCacheVersions,
  type WorldDownloadProgress,
  type WorldStorageEstimate,
} from '../pwa/worldCache';

interface WorldOfflineProps {
  fr: boolean;
}

function notifyWorldCacheUpdated(): void {
  if (typeof navigator === 'undefined') return;
  navigator.serviceWorker?.controller?.postMessage({ type: 'world-cache-updated' });
}

function statusText(fr: boolean, summary: OfflineWorldSnapshot, catalog: WorldFileCatalog | null): string {
  switch (summary.status) {
    case 'checking':
      return fr ? 'Vérification du monde hors ligne…' : 'Checking the offline world…';
    case 'unsupported':
      return fr ? 'Le stockage hors ligne n’est pas disponible dans ce navigateur.' : 'Offline world storage is not available in this browser.';
    case 'unavailable':
      return fr ? 'Le catalogue du monde est indisponible.' : 'The world catalog is unavailable.';
    case 'not-downloaded':
      return fr
        ? `Non téléchargé · ${formatBytes(summary.totalBytes)}`
        : `Not downloaded · ${formatBytes(summary.totalBytes)}`;
    case 'partial':
      return fr
        ? `Partiellement disponible · ${summary.cachedFiles}/${summary.totalFiles} fichiers · ${formatBytes(summary.cachedBytes)} sur ${formatBytes(summary.totalBytes)}`
        : `Partially available · ${summary.cachedFiles}/${summary.totalFiles} files · ${formatBytes(summary.cachedBytes)} of ${formatBytes(summary.totalBytes)}`;
    case 'downloading':
      return fr ? 'Téléchargement du monde…' : 'Downloading the world…';
    case 'ready':
      return fr
        ? `Disponible hors ligne · ${formatBytes(summary.totalBytes)}`
        : `Available offline · ${formatBytes(summary.totalBytes)}`;
    case 'update-available':
      return fr
        ? 'Une nouvelle version du monde est disponible au téléchargement.'
        : 'A new world version is available to download.';
    case 'quota-error':
      return fr ? 'Stockage plein. Libérez de l’espace puis réessayez.' : 'Storage is full. Free some space and try again.';
    default:
      return catalog ? formatBytes(catalog.totalBytes) : '';
  }
}

export function WorldOffline({ fr }: WorldOfflineProps) {
  const district = useGame((s) => s.engine?.state.player.district ?? 'mvog_mbi');
  const [registry, setRegistry] = useState<WorldPackRegistry>(BUILTIN_WORLD_REGISTRY);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(district);
  const [catalog, setCatalog] = useState<WorldFileCatalog | null>(null);
  const [summary, setSummary] = useState<OfflineWorldSnapshot>(() =>
    summarizeWorldOffline(null, [], { supported: worldCacheSupported() }),
  );
  const [estimate, setEstimate] = useState<WorldStorageEstimate | null>(null);
  const [progress, setProgress] = useState<WorldDownloadProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const packs = registry.packs.filter((pack) => worldPackCompatibilityError(pack) === null);
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? packs[0] ?? null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    let live = true;
    loadWorldRegistry(import.meta.env.BASE_URL)
      .then((next) => {
        if (!live) return;
        setRegistry(next);
        const current = compatibleWorldPackForDistrict(next, district);
        const first = next.packs.find((pack) => worldPackCompatibilityError(pack) === null);
        setSelectedPackId(current?.id ?? first?.id ?? null);
      })
      .catch(() => {
        if (!live) return;
        const current = compatibleWorldPackForDistrict(BUILTIN_WORLD_REGISTRY, district);
        const first = BUILTIN_WORLD_REGISTRY.packs.find((pack) => worldPackCompatibilityError(pack) === null);
        setSelectedPackId(current?.id ?? first?.id ?? null);
      });
    return () => {
      live = false;
    };
  }, [district]);

  const refresh = useCallback(async (pack: WorldPackEntry) => {
    setChecking(true);
    const baseUrl = import.meta.env.BASE_URL;
    const worldBase = worldPackBaseUrl(baseUrl, pack);
    if (!worldCacheSupported()) {
      if (mounted.current) {
        setSummary(summarizeWorldOffline(null, [], { supported: false }));
        setChecking(false);
      }
      return;
    }
    try {
      const nextCatalog = await loadWorldCatalog(worldBase);
      const manifest = await loadManifest(worldBase, {
        expectedWorldVersion: pack.worldVersion,
        expectedAreaId: pack.districtId,
      });
      const versions = await worldCacheVersions();
      const cacheNames = versions.map((version) => worldCacheName(version));
      const cachedPaths = await cachedWorldPaths(worldCacheName(nextCatalog.worldVersion), baseUrl);
      const nextEstimate = await estimateWorldStorage();
      if (!mounted.current) return;
      setCatalog(nextCatalog);
      setEstimate(nextEstimate);
      setSummary(
        summarizeWorldOffline(nextCatalog, cachedPaths, {
          activeVersion: manifest.worldVersion,
          cacheNames,
          supported: true,
        }),
      );
    } catch {
      if (!mounted.current) return;
      setCatalog(null);
      setSummary(summarizeWorldOffline(null, [], { supported: true }));
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPack) {
      setCatalog(null);
      setSummary(summarizeWorldOffline(null, [], { supported: worldCacheSupported() }));
      setChecking(false);
      return;
    }
    void refresh(selectedPack);
  }, [refresh, selectedPack]);

  const download = async () => {
    if (!catalog || !selectedPack || busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(null);
    setSummary((current) => ({ ...current, status: 'downloading' }));
    try {
      await requestPersistentStorage();
      await downloadWorldPack({
        baseUrl: import.meta.env.BASE_URL,
        catalog,
        signal: controller.signal,
        onProgress: (next) => {
          if (mounted.current) setProgress(next);
        },
      });
      const keepVersions = packs.map((pack) => pack.worldVersion);
      if (!keepVersions.includes(catalog.worldVersion)) keepVersions.push(catalog.worldVersion);
      await cleanupOldWorldCaches(keepVersions);
      notifyWorldCacheUpdated();
      if (mounted.current) {
        const label = selectedPack.name;
        useGame.getState().engine?.toast(
          `${label} is available offline`,
          'success',
          `${label} est disponible hors ligne`,
        );
      }
    } catch (error) {
      if (mounted.current && !(error instanceof WorldCacheError && error.code === 'aborted')) {
        const quota = error instanceof WorldCacheError && error.code === 'quota';
        useGame.getState().engine?.toast(
          quota ? 'Not enough storage for the offline world' : 'Offline world download failed',
          'info',
          quota ? 'Stockage insuffisant pour le monde hors ligne' : 'Échec du téléchargement du monde hors ligne',
        );
      }
    } finally {
      abortRef.current = null;
      if (mounted.current) {
        setBusy(false);
        if (selectedPack) await refresh(selectedPack);
      }
    }
  };

  const remove = async () => {
    if (!catalog || !selectedPack || busy) return;
    setBusy(true);
    try {
      await deleteWorldCache(catalog.worldVersion);
      notifyWorldCacheUpdated();
      await refresh(selectedPack);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const percent = progress ? Math.round(progress.fraction * 100) : 0;
  const canDownload = Boolean(catalog) && !busy && summary.status !== 'ready' && summary.status !== 'unsupported';
  const canRemove = summary.cachedFiles > 0 && !busy;

  return (
    <div className="world-offline">
      <div className="world-offline-head">
        <strong>{fr ? 'Monde hors ligne' : 'Offline world'}</strong>
        {packs.length > 1 ? (
          <select
            aria-label={fr ? 'Quartier géographique' : 'Geographic district'}
            value={selectedPack?.id ?? ''}
            onChange={(event) => setSelectedPackId(event.target.value)}
            disabled={busy}
          >
            {packs.map((pack) => (
              <option key={pack.id} value={pack.id}>{pack.name}</option>
            ))}
          </select>
        ) : (
          <span className="muted small">{selectedPack?.name ?? (fr ? 'Indisponible' : 'Unavailable')}</span>
        )}
      </div>
      <div className={`world-offline-status world-offline-${summary.status}`} role="status">
        {checking
          ? fr
            ? 'Vérification du monde hors ligne…'
            : 'Checking the offline world…'
          : statusText(fr, summary, catalog)}
      </div>
      {progress && summary.status === 'downloading' && (
        <div className="world-progress" aria-label={fr ? 'Progression du téléchargement' : 'Download progress'}>
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      {estimate && (
        <div className="muted small">
          {fr
            ? `Stockage utilisé : ${formatBytes(estimate.usage)}${estimate.quota ? ` sur ${formatBytes(estimate.quota)}` : ''}${estimate.persisted ? ' · persistant' : ''}`
            : `Storage used: ${formatBytes(estimate.usage)}${estimate.quota ? ` of ${formatBytes(estimate.quota)}` : ''}${estimate.persisted ? ' · persistent' : ''}`}
        </div>
      )}
      <div className="world-offline-actions">
        {canDownload && (
          <button onClick={() => void download()} disabled={busy}>
            {busy
              ? fr
                ? 'Téléchargement…'
                : 'Downloading…'
              : summary.status === 'update-available'
                ? fr
                  ? 'Mettre à jour hors ligne'
                  : 'Update offline world'
                : fr
                  ? `Télécharger ${selectedPack?.name ?? 'le monde'} hors ligne`
                  : `Download ${selectedPack?.name ?? 'world'} offline`}
          </button>
        )}
        {busy && abortRef.current && (
          <button onClick={() => abortRef.current?.abort()}>
            {fr ? 'Annuler' : 'Cancel'}
          </button>
        )}
        {canRemove && (
          <button className="muted" onClick={() => void remove()} disabled={busy}>
            {fr ? 'Supprimer les données hors ligne' : 'Remove offline data'}
          </button>
        )}
      </div>
      <div className="muted small">
        {fr
          ? 'Les données déjà téléchargées restent disponibles sans internet. Les sauvegardes ne sont jamais supprimées.'
          : 'Downloaded data stays available without internet. Game saves are never deleted.'}
      </div>
    </div>
  );
}
