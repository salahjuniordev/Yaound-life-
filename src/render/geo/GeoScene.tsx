import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, type NearbyInfo } from '../../state/store';
import type { DistrictId } from '../../sim/types';
import { loadChunk, loadManifest, loadWorldData, assertLoadedPackManifest, type LoadedChunk } from '../../world/loader';
import { worldPackBaseUrl, type WorldPackEntry } from '../../world/registry';
import { ChunkLru } from '../../world/chunkManager';
import { heightAt } from '../../world/terrain';
import { roadsForChunk } from '../../world/roads';
import type { Heightfield, WorldData, WorldManifest } from '../../world/types';
import type { QualityTier } from '../controls';
import { Crowd } from '../Crowd';
import { PlayerRig } from '../PlayerRig';
import { GeoCollisionWorld } from './collision';
import { RoadIndex } from './roadIndex';
import { createGeoAdapter } from './adapter';
import { bridgeSurfaceAt } from './bridges';
import type { WorldAdapter } from './types';
import {
  buildBuildingGeometry,
  buildPropsGeometry,
  buildRoadGeometry,
  buildTerrainGeometry,
  buildWaterGeometry,
  buildWaterwaysGeometry,
} from './geometry';
import { publishWorldMetrics } from './metrics';

export interface GeoStatus {
  phase: 'loading' | 'ready' | 'error';
  message: string;
}

interface GeoSceneProps {
  pack: WorldPackEntry;
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

function triangleCount(geometry: THREE.BufferGeometry | undefined): number {
  if (!geometry) return 0;
  return geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
}

export function GeoScene({ pack, quality, onInteract, onStatus, onUnavailable }: GeoSceneProps) {
  const { gl } = useThree();
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
  const chunkLru = useRef(new ChunkLru(16));
  const metricFrames = useRef(0);
  const metricElapsed = useRef(0);
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
    const baseUrl = worldPackBaseUrl(import.meta.env.BASE_URL, pack);

    const removeChunk = (id: string) => {
      const visual = chunkVisuals.current.get(id);
      if (!visual) return;
      visualGroup.remove(visual.group);
      terrainGroup.remove(visual.terrain);
      disposeObject(visual.terrain);
      disposeObject(visual.group);
      chunkVisuals.current.delete(id);
      chunkTerrains.current.delete(id);
      chunkLru.current.unload(id);
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

      // The pack stores each OSM way in the chunk containing its midpoint.
      // Clip the global network to this chunk so long ways do not disappear or
      // sink under a neighbouring heightfield, and so props use the same local
      // road set the player can actually see.
      const localRoads = roadsForChunk(worldRef.current?.data.roads ?? chunk.roads, chunk.ref.bounds);
      const roadGeometry = buildRoadGeometry(localRoads, chunk.terrain, qualityRef.current);
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

      const props = buildPropsGeometry(chunk.ref.id, localRoads, chunk.buildings, chunk.terrain, qualityRef.current, chunk.pois);
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
        chunkLru.current.markLoaded(ref.id);
        visualGroup.add(visual.group);
        statusRef.current?.({ phase: 'ready', message: pack.name });
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
      chunkLru.current.maxLoaded = qualityRef.current === 'low' ? 5 : qualityRef.current === 'mid' ? 10 : 16;
      const current = chunkAt(world.manifest, x, z);
      if (!current) return;
      const desired = new Set<string>();
      const keep = new Set<string>();
      const nearby = world.manifest.chunks
        .map((chunk) => {
          const [cx, cz] = chunkCenter(chunk);
          return {
            chunk,
            dx: Math.abs(chunk.ix - current.ix),
            dz: Math.abs(chunk.iz - current.iz),
            distance: Math.hypot(cx - x, cz - z),
          };
        })
        .filter((entry) => entry.dx <= keepRadius && entry.dz <= keepRadius)
        .sort((a, b) => a.distance - b.distance);
      for (const entry of nearby) {
        if (entry.dx <= radius && entry.dz <= radius) desired.add(entry.chunk.id);
        keep.add(entry.chunk.id);
      }
      const plan = chunkLru.current.plan(desired, keep, loading.current);
      for (const id of plan.evict) removeChunk(id);
      for (const id of desired) {
        if (chunkVisuals.current.has(id)) chunkLru.current.touch(id);
      }
      for (const id of plan.load) {
        const ref = world.manifest.chunks.find((chunk) => chunk.id === id);
        if (ref) void loadOne(ref);
      }
    };
    ensureRef.current = ensure;

    const load = async () => {
      try {
        statusRef.current?.({ phase: 'loading', message: `Loading ${pack.name} geography…` });
        const manifest = await loadManifest(baseUrl, {
          signal: controller.signal,
          expectedWorldVersion: pack.worldVersion,
          expectedAreaId: pack.districtId,
        });
        assertLoadedPackManifest(manifest, pack);
        const data = await loadWorldData(baseUrl, manifest, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const roads = new RoadIndex(data.roads);
        const coarse = data.coarseTerrain;
        const bridgeRoads = data.roads.filter((road) => road.bridge);
        const baseTerrainHeight = (x: number, z: number): number => {
          const chunk = chunkAt(manifest, x, z);
          const hf = chunk ? chunkTerrains.current.get(chunk.id) : undefined;
          return heightAt(hf ?? coarse, x, z);
        };
        const terrainHeight = (x: number, z: number): number =>
          bridgeSurfaceAt(bridgeRoads, x, z, baseTerrainHeight) ?? baseTerrainHeight(x, z);
        const geoAdapter = createGeoAdapter({ world: data, collision, roads, terrainHeight });
        const spawnPoint = geoAdapter.spawnForDistrict(pack.districtId as DistrictId);
        worldRef.current = { baseUrl, manifest, data, roads };
        setAdapter(geoAdapter);
        setSpawn(spawnPoint);
        const water = buildWaterGeometry(data.water, manifest.waterLevel ?? 0);
        if (water) {
          const mesh = new THREE.Mesh(water, new THREE.MeshLambertMaterial({ color: '#3f6f8a', transparent: true, opacity: 0.86 }));
          mesh.name = 'water';
          waterGroup.add(mesh);
        }
        const waterways = buildWaterwaysGeometry(data.waterways);
        if (waterways) {
          const mesh = new THREE.Mesh(
            waterways,
            new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }),
          );
          mesh.name = 'waterways';
          waterGroup.add(mesh);
        }
        ensure(spawnPoint[0], spawnPoint[1]);
        statusRef.current?.({ phase: 'ready', message: pack.name });
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
    metricFrames.current += 1;
    metricElapsed.current += Math.min(dt, 0.25);
    if (metricElapsed.current >= 1) {
      let activeBuildings = 0;
      let triangles = 0;
      for (const visual of chunkVisuals.current.values()) {
        activeBuildings += visual.ref.buildingCount;
        triangles += triangleCount(visual.terrain.geometry);
        triangles += triangleCount(visual.roads?.geometry);
        const buildings = visual.buildingsNear?.visible ? visual.buildingsNear : visual.buildingsFar;
        triangles += triangleCount(buildings?.geometry);
        if (visual.props?.visible) triangles += triangleCount(visual.props.geometry);
      }
      publishWorldMetrics({
        fps: metricFrames.current / Math.max(0.001, metricElapsed.current),
        frameMs: (metricElapsed.current * 1000) / Math.max(1, metricFrames.current),
        loadedChunks: chunkVisuals.current.size,
        activeBuildings,
        triangles,
        drawCalls: gl.info.render.calls,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        updatedAt: Date.now(),
      });
      metricFrames.current = 0;
      metricElapsed.current = 0;
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
