import type { Heightfield } from './types';
import type { ChunkBounds } from './chunks';

const HEIGHTFIELD_MAGIC = 'YLT1';
const HEIGHTFIELD_VERSION = 1;
const HEIGHTFIELD_HEADER_BYTES = 36;

export function createHeightfield(
  width: number,
  height: number,
  cellSize: number,
  originX: number,
  originZ: number,
  heights: Float32Array,
  minElevation = Infinity,
  maxElevation = -Infinity,
): Heightfield {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
    throw new Error('Heightfield dimensions must be integers >= 2');
  }
  if (heights.length !== width * height) {
    throw new Error(`Heightfield expected ${width * height} samples, received ${heights.length}`);
  }
  let min = minElevation;
  let max = maxElevation;
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = Infinity;
    max = -Infinity;
    for (let i = 0; i < heights.length; i++) {
      const v = heights[i];
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 0;
  return { width, height, cellSize, originX, originZ, minElevation: min, maxElevation: max, heights };
}

export function heightAt(hf: Heightfield, x: number, z: number): number {
  const fx = (x - hf.originX) / hf.cellSize;
  const fz = (z - hf.originZ) / hf.cellSize;
  const cx = Math.max(0, Math.min(hf.width - 1, fx));
  const cz = Math.max(0, Math.min(hf.height - 1, fz));
  const x0 = Math.floor(cx);
  const z0 = Math.floor(cz);
  const x1 = Math.min(hf.width - 1, x0 + 1);
  const z1 = Math.min(hf.height - 1, z0 + 1);
  const tx = cx - x0;
  const tz = cz - z0;
  const h00 = hf.heights[z0 * hf.width + x0];
  const h10 = hf.heights[z0 * hf.width + x1];
  const h01 = hf.heights[z1 * hf.width + x0];
  const h11 = hf.heights[z1 * hf.width + x1];
  const a = h00 + (h10 - h00) * tx;
  const b = h01 + (h11 - h01) * tx;
  return a + (b - a) * tz;
}

export function sampleChunkHeightfield(
  global: Heightfield,
  bounds: ChunkBounds,
  cellSize: number,
): Heightfield {
  const width = Math.max(2, Math.round((bounds.maxX - bounds.minX) / cellSize) + 1);
  const height = Math.max(2, Math.round((bounds.maxZ - bounds.minZ) / cellSize) + 1);
  const heights = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;
  for (let iz = 0; iz < height; iz++) {
    const z = bounds.minZ + iz * cellSize;
    for (let ix = 0; ix < width; ix++) {
      const x = bounds.minX + ix * cellSize;
      const value = heightAt(global, x, z);
      heights[iz * width + ix] = value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  return createHeightfield(width, height, cellSize, bounds.minX, bounds.minZ, heights, min, max);
}

export function heightfieldEdgeMatches(a: Heightfield, b: Heightfield, axis: 'x' | 'z'): boolean {
  if (axis === 'x') {
    if (Math.abs(a.originX + (a.width - 1) * a.cellSize - b.originX) > 1e-6) return false;
    const count = Math.min(a.height, b.height);
    for (let i = 0; i < count; i++) {
      const za = a.originZ + i * a.cellSize;
      const zb = b.originZ + i * b.cellSize;
      if (Math.abs(za - zb) > 1e-6) return false;
      const va = a.heights[i * a.width + (a.width - 1)];
      const vb = b.heights[i * b.width];
      if (Math.abs(va - vb) > 1e-4) return false;
    }
    return true;
  }
  if (Math.abs(a.originZ + (a.height - 1) * a.cellSize - b.originZ) > 1e-6) return false;
  const count = Math.min(a.width, b.width);
  for (let i = 0; i < count; i++) {
    const xa = a.originX + i * a.cellSize;
    const xb = b.originX + i * b.cellSize;
    if (Math.abs(xa - xb) > 1e-6) return false;
    const va = a.heights[(a.height - 1) * a.width + i];
    const vb = b.heights[i];
    if (Math.abs(va - vb) > 1e-4) return false;
  }
  return true;
}

export function encodeHeightfield(hf: Heightfield): ArrayBuffer {
  const buffer = new ArrayBuffer(HEIGHTFIELD_HEADER_BYTES + hf.heights.length * 4);
  const view = new DataView(buffer);
  for (let i = 0; i < 4; i++) view.setUint8(i, HEIGHTFIELD_MAGIC.charCodeAt(i));
  view.setUint16(4, HEIGHTFIELD_VERSION, true);
  view.setUint16(6, 0, true);
  view.setUint32(8, hf.width, true);
  view.setUint32(12, hf.height, true);
  view.setFloat32(16, hf.cellSize, true);
  view.setFloat32(20, hf.originX, true);
  view.setFloat32(24, hf.originZ, true);
  view.setFloat32(28, hf.minElevation, true);
  view.setFloat32(32, hf.maxElevation, true);
  new Float32Array(buffer, HEIGHTFIELD_HEADER_BYTES).set(hf.heights);
  return buffer;
}

export function decodeHeightfield(buffer: ArrayBuffer): Heightfield {
  if (buffer.byteLength < HEIGHTFIELD_HEADER_BYTES) throw new Error('Heightfield buffer too small');
  const view = new DataView(buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== HEIGHTFIELD_MAGIC) throw new Error(`Invalid heightfield magic: ${magic}`);
  const version = view.getUint16(4, true);
  if (version !== HEIGHTFIELD_VERSION) throw new Error(`Unsupported heightfield version: ${version}`);
  const width = view.getUint32(8, true);
  const height = view.getUint32(12, true);
  const cellSize = view.getFloat32(16, true);
  const originX = view.getFloat32(20, true);
  const originZ = view.getFloat32(24, true);
  const minElevation = view.getFloat32(28, true);
  const maxElevation = view.getFloat32(32, true);
  const expected = width * height * 4;
  if (buffer.byteLength < HEIGHTFIELD_HEADER_BYTES + expected) {
    throw new Error('Heightfield data truncated');
  }
  const heights = new Float32Array(buffer.slice(HEIGHTFIELD_HEADER_BYTES, HEIGHTFIELD_HEADER_BYTES + expected));
  return createHeightfield(width, height, cellSize, originX, originZ, heights, minElevation, maxElevation);
}
