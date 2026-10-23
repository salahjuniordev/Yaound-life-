import { create } from 'zustand';
import { GameEngine, type GameAction, type Toast } from '../sim/engine';
import type { GameState, GameSettings } from '../sim/types';
import { createGameState, type NewGameOptions } from '../sim/state';
import { saveLocal, loadLocal, listLocalSaves, deleteLocal, exportSaveJSON, importSaveJSON, type LocalSaveRecord } from '../persistence/idb';
import {
  deleteCloudData,
  ensureSession,
  pushCloudSave,
  pullCloudSave,
  requestPasswordReset,
  resendConfirmation,
  sendReport,
  signInAccount,
  signOutAccount,
  signUpAccount,
  updateDisplayName,
  updatePassword,
  type AuthResult,
  type CloudStatus,
} from '../persistence/supabase';

export type Screen = 'menu' | 'create' | 'game';
export type PanelId = 'none' | 'phone' | 'settings';

export type ModalState =
  | { kind: 'none' }
  | { kind: 'travel' }
  | { kind: 'activity'; placeId: string; actions: string[] }
  | { kind: 'vendor'; placeId: string; vendorKind: string }
  | { kind: 'dialogue'; npcId: string }
  | { kind: 'interior'; interiorId: string; placeId: string }
  | { kind: 'jobboard' }
  | { kind: 'business' }
  | { kind: 'njangi' }
  | { kind: 'photo'; landmarkId?: string };

export interface RuntimePlayer {
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  running: boolean;
}

export interface NearbyInfo {
  kind: 'place' | 'npc';
  id: string;
  label: string;
  labelFr: string;
  icon: string;
  placeId?: string;
  npcId?: string;
}

interface StoreShape {
  screen: Screen;
  engine: GameEngine | null;
  version: number;
  toasts: Toast[];
  booting: boolean;
  menuSaves: LocalSaveRecord[];
  cloud: CloudStatus;
  cloudMessage: string | null;
  accountOpen: boolean;
  panel: PanelId;
  phoneApp: string | null;
  modal: ModalState;
  player: RuntimePlayer;
  nearby: NearbyInfo | null;
  bump: () => void;
  pushToast: (text: string, kind?: Toast['kind'], textFr?: string) => void;
  dismissToast: (id: number) => void;
  setScreen: (s: Screen) => void;
  refreshMenuSaves: () => Promise<void>;
  newGame: (opts: NewGameOptions) => Promise<void>;
  continueGame: (characterId?: string) => Promise<boolean>;
  loadFromState: (state: GameState) => void;
  deleteSave: (characterId: string) => Promise<void>;
  exportCurrent: () => string | null;
  importFromJSON: (text: string) => boolean;
  saveNow: () => Promise<void>;
  syncCloud: () => Promise<void>;
  loadCloudLast: () => Promise<boolean>;
  connectCloud: () => Promise<void>;
  setCloud: (cloud: CloudStatus) => void;
  openAccount: () => void;
  closeAccount: () => void;
  authSignIn: (email: string, password: string) => Promise<AuthResult>;
  authSignUp: (email: string, password: string) => Promise<AuthResult>;
  authSignOut: () => Promise<AuthResult>;
  authResetPassword: (email: string) => Promise<AuthResult>;
  authUpdatePassword: (password: string) => Promise<AuthResult>;
  authUpdateDisplayName: (displayName: string, locale: string) => Promise<AuthResult>;
  authResendConfirmation: (email: string) => Promise<AuthResult>;
  authDeleteCloud: () => Promise<AuthResult>;
  dispatch: (action: GameAction) => void;
  setPanel: (p: PanelId) => void;
  setPhoneApp: (app: string | null) => void;
  setModal: (m: ModalState) => void;
  setPlayer: (p: Partial<RuntimePlayer>) => void;
  setNearby: (n: NearbyInfo | null) => void;
  setSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
}

let detachEngine: (() => void) | null = null;
let lastVersionBump = 0;
let lastSavedDay = -1;

function attachEngine(engine: GameEngine, bump: () => void, pushToast: StoreShape['pushToast']) {
  detachEngine?.();
  lastSavedDay = engine.state.world.day;
  detachEngine = engine.subscribe(() => {
    const now = performance.now();
    if (now - lastVersionBump > 200) {
      lastVersionBump = now;
      bump();
    }
    const drained = engine.drainToasts();
    for (const t of drained) pushToast(t.text, t.kind, t.textFr);
    if (engine.state.world.day !== lastSavedDay) {
      lastSavedDay = engine.state.world.day;
      void saveLocal(engine.state);
      void pushCloudSave(engine.state);
    }
  });
}

export const useGame = create<StoreShape>((set, get) => ({
  screen: 'menu',
  engine: null,
  version: 0,
  toasts: [],
  booting: true,
  menuSaves: [],
  cloud: {
    connected: false,
    userId: null,
    anonymous: false,
    email: null,
    emailVerified: false,
    displayName: null,
    lastSyncAt: null,
    lastError: null,
  },
  cloudMessage: null,
  accountOpen: false,
  panel: 'none',
  phoneApp: null,
  modal: { kind: 'none' },
  player: { x: 10, z: 85, yaw: 0, moving: false, running: false },
  nearby: null,

  bump: () => set((s) => ({ version: s.version + 1 })),
  pushToast: (text, kind = 'info', textFr) =>
    set((s) => ({
      toasts: [...s.toasts.slice(-4), { id: Date.now() + Math.random(), text, kind, textFr }],
    })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setScreen: (screen) => set({ screen }),

  refreshMenuSaves: async () => {
    try {
      const saves = await listLocalSaves();
      saves.sort((a, b) => b.updatedAt - a.updatedAt);
      set({ menuSaves: saves, booting: false });
    } catch {
      set({ booting: false });
    }
    void ensureSession().then((cloud) => set({ cloud }));
  },

  newGame: async (opts) => {
    const state = createGameState(opts);
    const engine = new GameEngine(state);
    attachEngine(engine, get().bump, get().pushToast);
    set({ engine, screen: 'game', modal: { kind: 'none' }, panel: 'none', phoneApp: null });
    await saveLocal(state);
    void pushCloudSave(state);
  },

  continueGame: async (characterId) => {
    const state = await loadLocal(characterId);
    if (!state) return false;
    get().loadFromState(state);
    return true;
  },

  loadFromState: (state) => {
    const engine = new GameEngine(state);
    attachEngine(engine, get().bump, get().pushToast);
    set({ engine, screen: 'game', modal: { kind: 'none' }, panel: 'none', phoneApp: null });
  },

  deleteSave: async (characterId) => {
    await deleteLocal(characterId);
    await get().refreshMenuSaves();
  },

  exportCurrent: () => {
    const engine = get().engine;
    if (!engine) return null;
    return exportSaveJSON(engine.state);
  },

  importFromJSON: (text) => {
    const state = importSaveJSON(text);
    if (!state) return false;
    get().loadFromState(state);
    void saveLocal(state);
    return true;
  },

  saveNow: async () => {
    const engine = get().engine;
    if (!engine) return;
    await saveLocal(engine.state);
    get().pushToast('Game saved locally.', 'success', 'Partie sauvegardée.');
  },

  syncCloud: async () => {
    const engine = get().engine;
    if (!engine) return;
    const res = await pushCloudSave(engine.state);
    set({ cloudMessage: res.message });
    get().pushToast(res.message, res.ok ? 'success' : 'info');
  },

  loadCloudLast: async () => {
    const res = await pullCloudSave();
    if (res.state) {
      const local = await loadLocal(res.state.characterId);
      if (!local || res.state.world.day >= local.world.day) {
        get().loadFromState(res.state);
        await saveLocal(res.state);
        set({ cloudMessage: res.message });
        return true;
      }
      get().pushToast('Local save is further ahead than cloud. Not overwritten.', 'info');
      return false;
    }
    set({ cloudMessage: res.message });
    return false;
  },

  connectCloud: async () => {
    const cloud = await ensureSession();
    set({ cloud, cloudMessage: cloud.lastError ?? get().cloudMessage });
  },

  setCloud: (cloud) => set({ cloud }),
  openAccount: () => set({ accountOpen: true }),
  closeAccount: () => set({ accountOpen: false }),

  authSignIn: async (email, password) => {
    const res = await signInAccount(email, password);
    set((s) => ({ cloud: res.status ?? s.cloud, cloudMessage: res.message }));
    return res;
  },

  authSignUp: async (email, password) => {
    const res = await signUpAccount(email, password);
    set((s) => ({ cloud: res.status ?? s.cloud, cloudMessage: res.message }));
    return res;
  },

  authSignOut: async () => {
    const res = await signOutAccount();
    set((s) => ({ cloud: res.status ?? s.cloud, cloudMessage: res.message }));
    return res;
  },

  authResetPassword: async (email) => {
    const res = await requestPasswordReset(email);
    set({ cloudMessage: res.message });
    return res;
  },

  authUpdatePassword: async (password) => {
    const res = await updatePassword(password);
    set({ cloudMessage: res.message });
    return res;
  },

  authUpdateDisplayName: async (displayName, locale) => {
    const res = await updateDisplayName(displayName, locale);
    set((s) => ({ cloud: res.status ?? s.cloud, cloudMessage: res.message }));
    return res;
  },

  authResendConfirmation: async (email) => {
    const res = await resendConfirmation(email);
    set({ cloudMessage: res.message });
    return res;
  },

  authDeleteCloud: async () => {
    const res = await deleteCloudData();
    if (res.ok) {
      set({
        cloud: {
          connected: false,
          userId: null,
          anonymous: false,
          email: null,
          emailVerified: false,
          displayName: null,
          lastSyncAt: null,
          lastError: null,
        },
        cloudMessage: res.message,
      });
    } else {
      set({ cloudMessage: res.message });
    }
    return res;
  },

  dispatch: (action) => {
    const engine = get().engine;
    if (!engine) return;
    const res = engine.dispatch(action);
    if (res.message) get().pushToast(res.message, res.ok ? (res.toast ?? 'info') : 'error', res.messageFr);
    if (action.type === 'report_content' && res.ok) {
      const last = engine.state.reports[engine.state.reports.length - 1];
      if (last) void sendReport(last, engine.state.characterId);
    }
    get().bump();
  },

  setPanel: (panel) => set({ panel, phoneApp: panel === 'phone' ? get().phoneApp : null }),
  setPhoneApp: (phoneApp) => set({ phoneApp }),
  setModal: (modal) => set({ modal }),
  setPlayer: (p) => set((s) => ({ player: { ...s.player, ...p } })),

  setNearby: (n) => {
    const cur = get().nearby;
    if (cur?.id === n?.id) return;
    set({ nearby: n });
  },

  setSetting: (key, value) => {
    get().dispatch({ type: 'set_setting', key, value });
  },
}));
