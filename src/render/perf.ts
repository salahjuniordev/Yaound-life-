import type { GameEngine } from '../sim/engine';
import type { QualityTier } from './controls';

export interface DeviceSignals {
  fps: number;
  deviceMemoryGb?: number;
  cores?: number;
  saveData?: boolean;
  batteryLevel?: number;
  batteryCharging?: boolean;
}

export interface TierDecision {
  tier: QualityTier;
  reason: string;
  reasonFr: string;
}

export const TIER_ORDER: QualityTier[] = ['low', 'mid', 'high'];

export function downgradeTier(tier: QualityTier, steps = 1): QualityTier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.max(0, i - steps)];
}

export function classifyTier(sig: DeviceSignals): TierDecision {
  if (sig.saveData) {
    return { tier: 'low', reason: 'Data saver is on', reasonFr: 'Économiseur de data activé' };
  }
  if (sig.batteryLevel !== undefined && !sig.batteryCharging && sig.batteryLevel < 0.2) {
    return { tier: 'low', reason: `Battery at ${Math.round(sig.batteryLevel * 100)}%`, reasonFr: `Batterie à ${Math.round(sig.batteryLevel * 100)}%` };
  }
  if (sig.fps < 28) {
    return { tier: 'low', reason: `Measured ${Math.round(sig.fps)} FPS`, reasonFr: `${Math.round(sig.fps)} IPS mesurés` };
  }
  if (sig.deviceMemoryGb !== undefined && sig.deviceMemoryGb < 3) {
    return { tier: 'low', reason: 'Low device memory', reasonFr: 'Mémoire de l’appareil faible' };
  }
  if (sig.fps >= 55 && (sig.deviceMemoryGb ?? 0) >= 6 && (sig.cores ?? 0) >= 8) {
    return { tier: 'high', reason: `Smooth (${Math.round(sig.fps)} FPS) on a strong device`, reasonFr: `Fluide (${Math.round(sig.fps)} IPS) sur appareil puissant` };
  }
  if (sig.fps < 50) {
    return { tier: 'mid', reason: `Measured ${Math.round(sig.fps)} FPS`, reasonFr: `${Math.round(sig.fps)} IPS mesurés` };
  }
  return { tier: 'mid', reason: `Steady ${Math.round(sig.fps)} FPS`, reasonFr: `${Math.round(sig.fps)} IPS stables` };
}

export function measureFps(ms = 1200): Promise<number> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function') {
      resolve(60);
      return;
    }
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - start >= ms) {
        resolve((frames * 1000) / Math.max(1, now - start));
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export async function sampleDevice(): Promise<DeviceSignals> {
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  };
  const fps = await measureFps();
  let batteryLevel: number | undefined;
  let batteryCharging: boolean | undefined;
  if (typeof nav.getBattery === 'function') {
    try {
      const b = await nav.getBattery();
      batteryLevel = b.level;
      batteryCharging = b.charging;
    } catch {
      batteryLevel = undefined;
    }
  }
  return {
    fps,
    deviceMemoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData,
    batteryLevel,
    batteryCharging,
  };
}

export async function detectAndApply(engine: GameEngine): Promise<TierDecision | null> {
  if (!engine.state.settings.qualityAuto) return null;
  const signals = await sampleDevice();
  const decision = classifyTier(signals);
  engine.dispatch({ type: 'set_setting', key: 'quality', value: decision.tier });
  if (signals.saveData && !engine.state.settings.dataSaver) {
    engine.dispatch({ type: 'set_setting', key: 'dataSaver', value: true });
  }
  return decision;
}

export function initPowerWatcher(engine: GameEngine): () => void {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; addEventListener?: (t: string, fn: () => void) => void; removeEventListener?: (t: string, fn: () => void) => void };
    getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (t: string, fn: () => void) => void; removeEventListener: (t: string, fn: () => void) => void }>;
  };
  const handlers: { target: { removeEventListener: (t: string, fn: () => void) => void }; type: string; fn: () => void }[] = [];

  const isAuto = () => engine.state.settings.qualityAuto;
  let lowNotified = false;

  const onBattery = (level: number, charging: boolean) => {
    if (!isAuto()) return;
    if (level < 0.15 && !charging) {
      if (engine.state.settings.quality !== 'low') {
        engine.dispatch({ type: 'set_setting', key: 'quality', value: 'low' });
        engine.toast('Battery saver: quality lowered', 'info');
      } else if (!lowNotified) {
        engine.toast('Battery saver: running cool', 'info');
      }
      lowNotified = true;
    } else if (charging && lowNotified) {
      lowNotified = false;
      engine.toast('Charging — auto quality will restore on next detect', 'info');
    }
  };

  if (typeof nav.getBattery === 'function') {
    void nav.getBattery().then((b) => {
      const fn = () => onBattery(b.level, b.charging);
      b.addEventListener('levelchange', fn);
      b.addEventListener('chargingchange', fn);
      handlers.push({ target: b, type: 'levelchange', fn }, { target: b, type: 'chargingchange', fn });
    }).catch(() => undefined);
  }

  const conn = nav.connection;
  if (conn?.addEventListener) {
    const fn = () => {
      if (!isAuto() || !conn.saveData) return;
      if (!engine.state.settings.dataSaver) {
        engine.dispatch({ type: 'set_setting', key: 'dataSaver', value: true });
        engine.toast('Data saver network detected — data saver on', 'info');
      }
    };
    conn.addEventListener('change', fn);
    handlers.push({ target: conn as { removeEventListener: (t: string, fn: () => void) => void }, type: 'change', fn });
  }

  return () => {
    for (const h of handlers) h.target.removeEventListener(h.type, h.fn);
  };
}
