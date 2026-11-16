import * as THREE from 'three';
import { findChunkRef, loadChunk, loadManifest, type LoadedChunk } from '../src/world/loader';
import { roadsForChunk } from '../src/world/roads';
import { heightAt } from '../src/world/terrain';
import { polygonCentroid } from '../src/world/buildings';
import {
  buildBuildingGeometry,
  buildPropsGeometry,
  buildRoadGeometry,
  buildTerrainGeometry,
} from '../src/render/geo/geometry';
import type { BuildingGeometry, Heightfield } from '../src/world/types';

type Point2 = [number, number];

const BASE_URL = '/world/v1';
const QUALITY = 'high' as const;
const W = 1400;
const H = 1000;

type ViewName =
  | 'spawn-road'
  | 'spawn-top'
  | 'compound'
  | 'compound-top'
  | 'compound-oblique'
  | 'balcony'
  | 'market'
  | 'parking'
  | 'parking-top'
  | 'bridge'
  | 'bridge-top';

const params = new URLSearchParams(location.search);
const viewName = (params.get('view') ?? 'spawn-road') as ViewName;
const only = params.get('only');
const status = document.getElementById('status')!;
const label = document.getElementById('label')!;
const canvas = document.getElementById('view') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor('#cfe3f0', 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#cfe3f0');
scene.fog = new THREE.Fog('#cfe3f0', 80, 420);

const hemi = new THREE.HemisphereLight(0xcfe3f0, 0x4f5b45, 0.62);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
sun.position.set(155, 82, 90);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xbcd6e8, 0.28);
fill.position.set(-90, 70, -110);
scene.add(fill);

const camera = new THREE.PerspectiveCamera(55, W / H, 0.15, 1800);
const chunks = new Map<string, LoadedChunk>();
let globalRoads: import('../src/world/types').WorldRoad[] = [];


function ground(x: number, z: number): number {
  let best: Heightfield | null = null;
  let bestD = Infinity;
  for (const chunk of chunks.values()) {
    const hf = chunk.terrain;
    const maxX = hf.originX + (hf.width - 1) * hf.cellSize;
    const maxZ = hf.originZ + (hf.height - 1) * hf.cellSize;
    const cx = Math.max(hf.originX, Math.min(maxX, x));
    const cz = Math.max(hf.originZ, Math.min(maxZ, z));
    const d = Math.hypot(cx - x, cz - z);
    if (d < bestD) {
      bestD = d;
      best = hf;
    }
  }
  return best ? heightAt(best, x, z) : 0;
}

function addMesh(geometry: THREE.BufferGeometry | null, material: THREE.Material): void {
  if (!geometry) return;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  scene.add(mesh);
}

function look(eye: THREE.Vector3, target: THREE.Vector3, fov = 55, up?: THREE.Vector3): void {
  camera.fov = fov;
  camera.aspect = W / H;
  camera.up.copy(up ?? new THREE.Vector3(0, 1, 0));
  camera.position.copy(eye);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

function chunkIdsForView(view: ViewName): string[] {
  if (view === 'market') return ['c_1_1', 'c_1_2', 'c_0_2', 'c_2_2'];
  if (view === 'bridge' || view === 'bridge-top') return ['c_1_3', 'c_2_3', 'c_2_2'];
  return ['c_1_0', 'c_1_1', 'c_1_2', 'c_0_1', 'c_2_1'];
}

async function loadAll(): Promise<void> {
  const manifest = await loadManifest(BASE_URL);
  globalRoads = await (await fetch(`${BASE_URL}/roads/network.json`)).json() as import('../src/world/types').WorldRoad[];
  for (const id of chunkIdsForView(viewName)) {
    const ref = findChunkRef(manifest, id);
    if (!ref) throw new Error(`missing chunk ${id}`);
    status.textContent = `Loading ${id}…`;
    const chunk = await loadChunk(BASE_URL, manifest, ref);
    chunks.set(id, chunk);
    const localRoads = roadsForChunk(globalRoads, chunk.ref.bounds);
    if (!only || only === 'terrain') {
      addMesh(buildTerrainGeometry(chunk.terrain, QUALITY), new THREE.MeshLambertMaterial({ vertexColors: true }));
    }
    if (!only || only === 'roads') {
      addMesh(
        buildRoadGeometry(localRoads, chunk.terrain, QUALITY),
        new THREE.MeshLambertMaterial({
          vertexColors: true,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
    }
    if (!only || only === 'buildings') {
      addMesh(
        buildBuildingGeometry(chunk.buildings, chunk.decodedBuildings, chunk.terrain, QUALITY),
        new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }),
      );
    }
    if (!only || only === 'props') {
      const props = buildPropsGeometry(chunk.ref.id, localRoads, chunk.buildings, chunk.terrain, QUALITY, chunk.pois);
      addMesh(
        props.geometry,
        new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      );
    }
  }
}

function findBuilding(id: string): { chunk: LoadedChunk; building: BuildingGeometry } {
  for (const chunk of chunks.values()) {
    const building = chunk.buildings.find((b) => b.meta.id === id);
    if (building) return { chunk, building };
  }
  throw new Error(`building ${id} not found`);
}

function longestEdge(ring: Point2[]): {
  a: Point2;
  b: Point2;
  mx: number;
  mz: number;
  nx: number;
  nz: number;
  dx: number;
  dz: number;
  length: number;
} {
  let index = 0;
  let length = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > length) {
      length = l;
      index = i;
    }
  }
  const a = ring[index];
  const b = ring[(index + 1) % ring.length];
  const [cx, cz] = polygonCentroid(ring);
  const dx = (b[0] - a[0]) / length;
  const dz = (b[1] - a[1]) / length;
  let nx = -dz;
  let nz = dx;
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[1] + b[1]) / 2;
  if ((mx - cx) * nx + (mz - cz) * nz < 0) {
    nx = -nx;
    nz = -nz;
  }
  return { a, b, mx, mz, nx, nz, dx, dz, length };
}


function capture(): void {
  const spawn: Point2 = [678.9930105241164, -995.5936734739117];
  const spawnDir = { x: -0.09067933426868846, z: -0.9958801425556126 };
  const market: Point2 = [833.06, -1152.05];
  const bridge: Point2 = [1021.6780819870764, -1640.5033817023505];

  if (viewName === 'spawn-road') {
    const eye = new THREE.Vector3(
      spawn[0] - spawnDir.x * 10,
      0,
      spawn[1] - spawnDir.z * 10,
    );
    eye.y = ground(eye.x, eye.z) + 3.4;
    const target = new THREE.Vector3(
      spawn[0] + spawnDir.x * 18,
      ground(spawn[0] + spawnDir.x * 18, spawn[1] + spawnDir.z * 18) + 1.1,
      spawn[1] + spawnDir.z * 18,
    );
    look(eye, target, 55);
  } else if (viewName === 'spawn-top') {
    const eye = new THREE.Vector3(spawn[0], ground(spawn[0], spawn[1]) + 58, spawn[1]);
    look(eye, new THREE.Vector3(spawn[0], ground(spawn[0], spawn[1]), spawn[1]), 52, new THREE.Vector3(0, 0, -1));
  } else if (viewName === 'compound' || viewName === 'compound-top' || viewName === 'compound-oblique') {
    // This is one of the eight compound gates that buildPropsGeometry actually
    // places in c_1_1. The earlier frame used a candidate building that never
    // passed the placement checks, so it showed a building wall instead.
    const gate = {
      x: 775.73,
      z: -944.54,
      nx: -0.975,
      nz: 0.223,
      dx: 0.223,
      dz: 0.975,
    };
    if (viewName === 'compound') {
      const eye = new THREE.Vector3(gate.x + gate.nx * 8.5, 0, gate.z + gate.nz * 8.5);
      eye.y = ground(eye.x, eye.z) + 2.1;
      look(
        eye,
        new THREE.Vector3(gate.x, ground(gate.x, gate.z) + 1.2, gate.z),
        55,
      );
    } else if (viewName === 'compound-oblique') {
      const eye = new THREE.Vector3(
        gate.x + gate.nx * 10.5 + gate.dx * 7,
        0,
        gate.z + gate.nz * 10.5 + gate.dz * 7,
      );
      eye.y = ground(eye.x, eye.z) + 3.2;
      look(eye, new THREE.Vector3(gate.x, ground(gate.x, gate.z) + 1.05, gate.z), 50);
    } else {
      const eye = new THREE.Vector3(gate.x + gate.nx * 7, ground(gate.x, gate.z) + 26, gate.z + gate.nz * 7);
      look(eye, new THREE.Vector3(gate.x, ground(gate.x, gate.z) + 1, gate.z), 55, new THREE.Vector3(0, 0, -1));
    }
  } else if (viewName === 'balcony') {
    const { building } = findBuilding('osm-a387923744');
    const edge = longestEdge(building.ring);
    const eye = new THREE.Vector3(
      edge.mx + edge.nx * 10.5 + edge.dx * 2.2,
      0,
      edge.mz + edge.nz * 10.5 + edge.dz * 2.2,
    );
    eye.y = ground(eye.x, eye.z) + 6.6;
    look(
      eye,
      new THREE.Vector3(
        edge.mx + edge.nx * 0.4,
        ground(edge.mx, edge.mz) + Math.max(4.5, building.meta.height * 0.72),
        edge.mz + edge.nz * 0.4,
      ),
      50,
    );
  } else if (viewName === 'market') {
    const eye = new THREE.Vector3(817.5, 0, -1167.5);
    eye.y = ground(eye.x, eye.z) + 7;
    look(eye, new THREE.Vector3(market[0], ground(market[0], market[1]) + 2, market[1]), 55);
  } else if (viewName === 'parking' || viewName === 'parking-top') {
    const [px, pz] = [702.91, -807.22];
    const gy = ground(px, pz);
    if (viewName === 'parking-top') {
      look(new THREE.Vector3(px, gy + 32, pz + 0.01), new THREE.Vector3(px, gy, pz), 52, new THREE.Vector3(0, 0, -1));
    } else {
      look(new THREE.Vector3(px + 13, gy + 11, pz + 13), new THREE.Vector3(px, gy + 1, pz), 50);
    }
  } else if (viewName === 'bridge' || viewName === 'bridge-top') {
    const road = [...chunks.values()].flatMap((c) => c.roads).find((r) => r.id === 'osm-w710637168');
    if (!road) throw new Error('bridge road not found');
    const a = road.points[0];
    const b = road.points[road.points.length - 1];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len;
    const nz = dx / len;
    if (viewName === 'bridge-top') {
      const eye = new THREE.Vector3(bridge[0], ground(bridge[0], bridge[1]) + 38, bridge[1]);
      look(eye, new THREE.Vector3(bridge[0], ground(bridge[0], bridge[1]), bridge[1]), 52, new THREE.Vector3(0, 0, -1));
    } else {
      const eye = new THREE.Vector3(bridge[0] + nx * 15, 0, bridge[1] + nz * 15);
      eye.y = ground(eye.x, eye.z) + 4.2;
      look(eye, new THREE.Vector3(bridge[0], ground(bridge[0], bridge[1]) + 0.8, bridge[1]), 50);
    }
  }

  renderer.render(scene, camera);
  label.innerHTML = `${viewName}<small>${Math.round(renderer.info.render.triangles).toLocaleString()} triangles · ${renderer.info.render.calls} draw calls · production geometry, high tier</small>`;
  status.textContent = `Ready: ${viewName} · chunks ${[...chunks.keys()].join(', ')}`;
  (window as unknown as { __m8SingleView?: unknown }).__m8SingleView = {
    ready: true,
    view: viewName,
    chunks: [...chunks.keys()],
    triangles: renderer.info.render.triangles,
    calls: renderer.info.render.calls,
  };
}

loadAll()
  .then(capture)
  .catch((error: unknown) => {
    const message = error instanceof Error ? `${error.stack || error.message}` : String(error);
    status.textContent = `ERROR: ${message}`;
    label.textContent = 'ERROR';
    (window as unknown as { __m8SingleView?: unknown }).__m8SingleView = { ready: false, error: message };
  });
