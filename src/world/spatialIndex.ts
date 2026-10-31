export interface IndexedItem<T> {
  id: string;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  item: T;
}

function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export class SpatialGrid<T> {
  readonly cellSize: number;
  private cells = new Map<string, IndexedItem<T>[]>();
  private entries = new Map<string, IndexedItem<T>>();

  constructor(cellSize = 32) {
    if (!Number.isFinite(cellSize) || cellSize <= 0) throw new Error('SpatialGrid cellSize must be positive');
    this.cellSize = cellSize;
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.cells.clear();
    this.entries.clear();
  }

  insert(id: string, x: number, z: number, item: T, radius = 0): void {
    this.insertBounds(id, x - radius, z - radius, x + radius, z + radius, item);
  }

  insertBounds(id: string, minX: number, minZ: number, maxX: number, maxZ: number, item: T): void {
    if (![minX, minZ, maxX, maxZ].every(Number.isFinite)) return;
    const entry: IndexedItem<T> = {
      id,
      minX: Math.min(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxX: Math.max(minX, maxX),
      maxZ: Math.max(minZ, maxZ),
      item,
    };
    this.entries.set(id, entry);
    const x0 = Math.floor(entry.minX / this.cellSize);
    const x1 = Math.floor(entry.maxX / this.cellSize);
    const z0 = Math.floor(entry.minZ / this.cellSize);
    const z1 = Math.floor(entry.maxZ / this.cellSize);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const key = cellKey(cx, cz);
        const list = this.cells.get(key);
        if (list) list.push(entry);
        else this.cells.set(key, [entry]);
      }
    }
  }

  remove(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    this.entries.delete(id);
    const x0 = Math.floor(entry.minX / this.cellSize);
    const x1 = Math.floor(entry.maxX / this.cellSize);
    const z0 = Math.floor(entry.minZ / this.cellSize);
    const z1 = Math.floor(entry.maxZ / this.cellSize);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const key = cellKey(cx, cz);
        const list = this.cells.get(key);
        if (!list) continue;
        const next = list.filter((e) => e.id !== id);
        if (next.length === 0) this.cells.delete(key);
        else this.cells.set(key, next);
      }
    }
  }

  queryPoint(x: number, z: number): T[] {
    return this.queryBounds(x, z, x, z);
  }

  queryRadius(x: number, z: number, radius: number): T[] {
    return this.queryBounds(x - radius, z - radius, x + radius, z + radius);
  }

  queryBounds(minX: number, minZ: number, maxX: number, maxZ: number): T[] {
    if (![minX, minZ, maxX, maxZ].every(Number.isFinite)) return [];
    const x0 = Math.floor(Math.min(minX, maxX) / this.cellSize);
    const x1 = Math.floor(Math.max(minX, maxX) / this.cellSize);
    const z0 = Math.floor(Math.min(minZ, maxZ) / this.cellSize);
    const z1 = Math.floor(Math.max(minZ, maxZ) / this.cellSize);
    const seen = new Set<string>();
    const out: T[] = [];
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(cellKey(cx, cz));
        if (!list) continue;
        for (const entry of list) {
          if (seen.has(entry.id)) continue;
          if (entry.maxX < minX || entry.minX > maxX || entry.maxZ < minZ || entry.minZ > maxZ) continue;
          seen.add(entry.id);
          out.push(entry.item);
        }
      }
    }
    return out;
  }
}

export interface SpatialEntry<T> {
  id: string;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  item: T;
}

export function queryNearest<T>(
  grid: SpatialGrid<T>,
  x: number,
  z: number,
  maxRadius: number,
  distance: (item: T) => number,
): T | null {
  const candidates = grid.queryRadius(x, z, maxRadius);
  let best: T | null = null;
  let bestD = Infinity;
  for (const candidate of candidates) {
    const d = distance(candidate);
    if (d < bestD) {
      bestD = d;
      best = candidate;
    }
  }
  return best;
}
