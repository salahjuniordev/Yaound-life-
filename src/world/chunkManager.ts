export interface ChunkLoadPlan {
  load: string[];
  evict: string[];
}

export class ChunkLru {
  private readonly order: string[] = [];
  private readonly loaded = new Set<string>();
  private cap: number;

  constructor(maxLoaded: number) {
    if (!Number.isFinite(maxLoaded) || maxLoaded < 1) throw new Error('ChunkLru needs a positive maxLoaded');
    this.cap = Math.floor(maxLoaded);
  }

  get maxLoaded(): number {
    return this.cap;
  }

  set maxLoaded(value: number) {
    if (!Number.isFinite(value) || value < 1) throw new Error('ChunkLru needs a positive maxLoaded');
    this.cap = Math.floor(value);
  }

  get size(): number {
    return this.loaded.size;
  }

  has(id: string): boolean {
    return this.loaded.has(id);
  }

  touch(id: string): void {
    const index = this.order.indexOf(id);
    if (index >= 0) this.order.splice(index, 1);
    this.order.push(id);
    this.loaded.add(id);
  }

  markLoaded(id: string): void {
    this.touch(id);
  }

  unload(id: string): void {
    this.loaded.delete(id);
    const index = this.order.indexOf(id);
    if (index >= 0) this.order.splice(index, 1);
  }

  plan(desired: ReadonlySet<string>, keep: ReadonlySet<string>, loading: ReadonlySet<string> = new Set()): ChunkLoadPlan {
    // `desired` is ordered by priority (nearest first). Select a stable subset
    // that fits in the cap: desired chunks first, then existing keep-ring
    // buffers in LRU order. This prevents swapping sets when the desired
    // radius is larger than the memory cap.
    const desiredIds = [...desired];
    const selected = new Set<string>();
    for (const id of desiredIds) {
      if (selected.size >= this.maxLoaded) break;
      selected.add(id);
    }
    if (selected.size < this.maxLoaded) {
      for (let i = this.order.length - 1; i >= 0 && selected.size < this.maxLoaded; i--) {
        const id = this.order[i];
        if (selected.has(id) || !this.loaded.has(id) || !keep.has(id)) continue;
        selected.add(id);
      }
    }
    const evict = this.order.filter((id) => !selected.has(id));
    const evicted = new Set(evict);
    const load = desiredIds.filter(
      (id) => selected.has(id) && !this.loaded.has(id) && !loading.has(id) && !evicted.has(id),
    );
    return { load, evict };
  }

  snapshot(): string[] {
    return [...this.order];
  }
}
