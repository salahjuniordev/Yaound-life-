import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, type NearbyInfo } from '../../state/store';
import { loadChunk, loadManifest, loadWorldData, joinWorldUrl, type LoadedChunk } from '../../world/loader';
import { heightAt } from '../../world/terrain';
import type { Heightfield, WorldData, WorldManifest } from '../../world/types';
import type { QualityTier } from '../controls';
import { Crowd } from '../Crowd';
import { PlayerRig } from '../PlayerRig';
import { GeoCollisionWorld } from './collision';
import { RoadIndex } from './roadIndex';
import { createGeoAdapter } from './adapter';
import type { WorldAdapter } from './types';
import { buildBuildingGeometry, buildPropsGeometry, buildRoadGeometry, buildTerrainGeometry, buildWaterGeometry } from './geometry';

export interface GeoStatus {
  phase: 'loading' | 'ready' | 'error';
  message: string;
}

interface GeoSceneProps {
  quality: QualityTier;
  onInteract: (nearby: NearbyInfo) => void;
  onStatus?: (status: GeoStatus) => void;
  onUnavailable?: (reason: string) => void;
}

interface ChunkVisual {
  id: string;
  ref: LoadedChunk['ref'];
  group: THREE.Group;
  terrain: THREE.Mesh;
  roads: THREE.Mesh | null;
  buildingsNear: THREE.Mesh | null;
  buildingsFar: THREE.Mesh | null;
  props: THREE.Mesh | null;
  heightfield: Heightfield;
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  const list = Array.isArray(material) ? material : [material];
  for (const item of list) item.dispose();
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

function chunkAt(manifest: WorldManifest, x: number, z: number): WorldManifest['chunks'][number] | null {
  const ix = Math.floor((x - manifest.bounds.minX) / manifest.chunkSize);
  const iz = Math.floor((z - manifest.bounds.minZ) / manifest.chunkSize);
  return manifest.chunks.find((chunk) => chunk.ix === ix && chunk.iz === iz) ?? null;
}

function chunkCenter(chunk: WorldManifest['chunks'][number]): [number, number] {
  return [(chunk.bounds.minX + chunk.bounds.maxX) / 2, (chunk.bounds.minZ + chunk.bounds.maxZ) / 2];
}

export function GeoScene({ quality, onInteract, onStatus, onUnavailable }: GeoSceneProps) {
  const collision = useMemo(() => new GeoCollisionWorld(), []);
  const visualGroup = useMemo(() => new THREE.Group(), []);
  const terrainGroup = useMemo(() => new THREE.Group(), []);
  const waterGroup = useMemo(() => new THREE.Group(), []);
  const [adapter, setAdapter] = useState<WorldAdapter | null>(null);
  const [spawn, setSpawn] = useState<[number, number] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const chunkVisuals = useRef(new Map<string, ChunkVisual>());
  const chunkTerrains = useRef(new Map<string, Heightfield>());
  const loading = useRef(new Set<string>());
  const worldRef = useRef<{ baseUrl: string; manifest: WorldManifest; data: WorldData; roads: RoadIndex } | null>(null);
  const qualityRef = useRef(quality);
  const statusRef = useRef(onStatus);
  const unavailableRef = useRef(onUnavailable);
  const ensureRef = useRef<(x: number, z: number) => void>(() => undefined);
  const chunkTimer = useRef(0);
  const lodTimer = useRef(0);
  const initialised = useRef(false);

  qualityRef.current = quality;
  statusRef.current = onStatus;
  unavailableRef.current = onUnavailable;

  useEffect(() => {
    visualGroup.add(terrainGroup);
    visualGroup.add(waterGroup);
    return () => {
      visualGroup.remove(terrainGroup);
      visualGroup.remove(waterGroup);
    };
  }, [visualGroup, terrainGroup, waterGroup]);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    const controller = new AbortController();
    const baseUrl = `${import.meta.env.BASE_URL}world/v1`.replace(/\/{2,}/g, '/').replace(':/', '://');

    const removeChunk = (id: string) => {
      const visual = chunkVisuals.current.get(id);
      if (!visual) return;
      visualGroup.remove(visual.group);
      terrainGroup.remove(visual.terrain);
      disposeObject(visual.terrain);
      disposeObject(visual.group);
      chunkVisuals.current.delete(id);
      chunkTerrains.current.delete(id);
      collision.removeChunk(id);
    };

    const clearChunks = () => {
      for (const id of [...chunkVisuals.current.keys()]) removeChunk(id);
    };

    const buildChunk = (chunk: LoadedChunk): ChunkVisual => {
      const group = new THREE.Group();
      group.name = `chunk-${chunk.ref.id}`;
      const terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
      const terrain = new THREE.Mesh(buildTerrainGeometry(chunk.terrain, qualityRef.current), terrainMaterial);
      terrain.name = `terrain-${chunk.ref.id}`;
      terrain.receiveShadow = qualityRef.current === 'high';
      terrainGroup.add(terrain);

      const roadGeometry = buildRoadGeometry(chunk.roads, chunk.terrain, qualityRef.current);
      const roads = roadGeometry
        ? new THREE.Mesh(roadGeometry, new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 }))
        : null;
      if (roads) {
        roads.name = `roads-${chunk.ref.id}`;
        roads.receiveShadow = qualityRef.current === 'high';
        group.add(roads);
      }

      const nearGeometry = buildBuildingGeometry(chunk.buildings, chunk.decodedBuildings, chunk.terrain, qualityRef.current);
      const farGeometry =
        qualityRef.current === 'low' ? nearGeometry : buildBuildingGeometry(chunk.buildings, chunk.decodedBuildings, chunk.terrain, 'low');
      const nearMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });
      const farMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true });
      const buildingsNear = nearGeometry ? new THREE.Mesh(nearGeometry, nearMaterial) : null;
      const buildingsFar = farGeometry && farGeometry !== nearGeometry ? new THREE.Mesh(farGeometry, farMaterial) : buildingsNear;
      if (buildingsNear) {
        buildingsNear.name = `buildings-near-${chunk.ref.id}`;
        buildingsNear.castShadow = qualityRef.current === 'high';
        group.add(buildingsNear);
      }
      if (buildingsFar && buildingsFar !== buildingsNear) {
        buildingsFar.name = `buildings-far-${chunk.ref.id}`;
        group.add(buildingsFar);
      }

      const props = buildPropsGeometry(chunk.ref.id, chunk.roads, chunk.buildings, chunk.terrain, qualityRef.current);
      const propsMesh = props.geometry
        ? new THREE.Mesh(props.geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))
        : null;
      if (propsMesh) {
        propsMesh.name = `props-${chunk.ref.id}`;
        propsMesh.castShadow = qualityRef.current === 'high';
        group.add(propsMesh);
      }

      collision.addChunk(chunk.ref.id, chunk.buildings, props.obstacles);
      chunkTerrains.current.set(chunk.ref.id, chunk.terrain);
      const visual: ChunkVisual = {
        id: chunk.ref.id,
        ref: chunk.ref,
        group,
        terrain,
        roads,
        buildingsNear,
        buildingsFar,
        props: propsMesh,
        heightfield: chunk.terrain,
      };
      return visual;
    };

    const loadOne = async (ref: WorldManifest['chunks'][number]) => {
      const world = worldRef.current;
      if (!world || loading.current.has(ref.id) || chunkVisuals.current.has(ref.id) || controller.signal.aborted) return;
      loading.current.add(ref.id);
      try {
        const chunk = await loadChunk(world.baseUrl, world.manifest, ref, { signal: controller.signal });
        if (controller.signal.aborted || !worldRef.current) return;
        const visual = buildChunk(chunk);
        chunkVisuals.current.set(ref.id, visual);
        visualGroup.add(visual.group);
        statusRef.current?.({ phase: 'ready', message: 'Nlongkak' });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Geo chunk failed', ref.id, error);
        statusRef.current?.({ phase: 'error', message: `Could not load ${ref.id}` });
      } finally {
        loading.current.delete(ref.id);
      }
    };

    const ensure = (x: number, z: number) => {
      const world = worldRef.current;
      if (!world) return;
      const radius = qualityRef.current === 'low' ? 0 : qualityRef.current === 'mid' ? 1 : 2;
      const keepRadius = radius + 1;
      const current = chunkAt(world.manifest, x, z);
      if (!current) return;
      const desired = new Set<string>();
      for (const chunk of world.manifest.chunks) {
        const dx = Math.abs(chunk.ix - current.ix);
        const dz = Math.abs(chunk.iz - current.iz);
        if (dx <= radius && dz <= radius) desired.add(chunk.id);
      }
      for (const chunk of world.manifest.chunks) {
        const dx = Math.abs(chunk.ix - current.ix);
        const dz = Math.abs(chunk.iz - current.iz);
        if (dx > keepRadius || dz > keepRadius) removeChunk(chunk.id);
      }
      for (const id of desired) {
        if (chunkVisuals.current.has(id) || loading.current.has(id)) continue;
        const ref = world.manifest.chunks.find((chunk) => chunk.id === id);
        if (ref) void loadOne(ref);
      }
    };
    ensureRef.current = ensure;

    const load = async () => {
      try {
        statusRef.current?.({ phase: 'loading', message: 'Loading Nlongkak geography…' });
        const manifest = await loadManifest(baseUrl, { signal: controller.signal });
        const data = await loadWorldData(baseUrl, manifest, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const roads = new RoadIndex(data.roads);
        const coarse = data.coarseTerrain;
        const terrainHeight = (x: number, z: number): number => {
          const chunk = chunkAt(manifest, x, z);
          const hf = chunk ? chunkTerrains.current.get(chunk.id) : undefined;
          return heightAt(hf ?? coarse, x, z);
        };
        const geoAdapter = createGeoAdapter({ world: data, collision, roads, terrainHeight });
        const spawnPoint = geoAdapter.spawnForDistrict('nlongkak');
        worldRef.current = { baseUrl, manifest, data, roads };
        setAdapter(geoAdapter);
        setSpawn(spawnPoint);
        const water = buildWaterGeometry(data.water, manifest.waterLevel ?? 0);
        if (water) {
          const mesh = new THREE.Mesh(water, new THREE.MeshLambertMaterial({ color: '#3f6f8a', transparent: true, opacity: 0.86 }));
          mesh.name = 'water';
          waterGroup.add(mesh);
        }
        ensure(spawnPoint[0], spawnPoint[1]);
        statusRef.current?.({ phase: 'ready', message: 'Nlongkak' });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : String(error);
        console.error('Geo world unavailable', error);
        setLoadError(message);
        statusRef.current?.({ phase: 'error', message });
        unavailableRef.current?.(message);
      }
    };

    void load();

    return () => {
      controller.abort();
      clearChunks();
      collision.clear();
      for (const child of [...waterGroup.children]) {
        waterGroup.remove(child);
        disposeObject(child);
      }
      ensureRef.current = () => undefined;
      worldRef.current = null;
      initialised.current = false;
    };
  }, [collision, visualGroup, terrainGroup, waterGroup]);

  useFrame((_, dt) => {
    if (!adapter) return;
    const state = useGame.getState();
    const px = state.player.x;
    const pz = state.player.z;
    chunkTimer.current += Math.min(dt, 0.1);
    if (chunkTimer.current > 0.35) {
      chunkTimer.current = 0;
      ensureRef.current(px, pz);
    }
    lodTimer.current += Math.min(dt, 0.1);
    if (lodTimer.current > 0.6) {
      lodTimer.current = 0;
      for (const visual of chunkVisuals.current.values()) {
        const [cx, cz] = chunkCenter(visual.ref);
        const distance = Math.hypot(px - cx, pz - cz);
        const near = distance < 560;
        if (visual.buildingsNear) visual.buildingsNear.visible = near;
        if (visual.buildingsFar && visual.buildingsFar !== visual.buildingsNear) visual.buildingsFar.visible = !near;
        if (visual.props) visual.props.visible = distance < 760;
      }
    }
  });

  if (loadError) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshLambertMaterial color="#6f7a52" />
      </mesh>
    );
  }

  if (!adapter || !spawn) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshLambertMaterial color="#7a845c" />
      </mesh>
    );
  }

  return (
    <>
      <primitive object={visualGroup} />
      <Crowd quality={quality} world={adapter} />
      <PlayerRig key={`geo-${spawn[0].toFixed(1)}-${spawn[1].toFixed(1)}`} quality={quality} onInteract={onInteract} terrain={terrainGroup} world={adapter} spawn={spawn} />
    </>
  );
}
