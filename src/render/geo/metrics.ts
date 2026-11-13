export interface WorldRenderMetrics {
  fps: number;
  frameMs: number;
  loadedChunks: number;
  activeBuildings: number;
  triangles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
  updatedAt: number;
}

export const EMPTY_WORLD_METRICS: WorldRenderMetrics = {
  fps: 0,
  frameMs: 0,
  loadedChunks: 0,
  activeBuildings: 0,
  triangles: 0,
  drawCalls: 0,
  geometries: 0,
  textures: 0,
  updatedAt: 0,
};

declare global {
  interface Window {
    __yaoundeWorldMetrics?: WorldRenderMetrics;
  }
}

export function publishWorldMetrics(metrics: WorldRenderMetrics): void {
  if (typeof window === 'undefined') return;
  window.__yaoundeWorldMetrics = metrics;
}

export function readWorldMetrics(): WorldRenderMetrics | null {
  if (typeof window === 'undefined') return null;
  return window.__yaoundeWorldMetrics ?? null;
}

export function isWorldDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.localStorage.getItem('yaounde-world-debug') === '1') return true;
  } catch {
    // Private mode.
  }
  return new URLSearchParams(window.location.search).get('debug') === 'world';
}
