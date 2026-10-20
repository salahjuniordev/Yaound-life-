import type { GameState } from '../sim/types';
import { migrateState } from '../sim/state';

const DB_NAME = 'yaounde-life';
const STORE = 'saves';
const META = 'meta';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'characterId' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface LocalSaveRecord {
  characterId: string;
  version: number;
  gameDay: number;
  updatedAt: number;
  state: GameState;
  backup?: GameState;
}

export async function saveLocal(state: GameState): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(state.characterId);
    getReq.onsuccess = () => {
      const existing = getReq.result as LocalSaveRecord | undefined;
      const record: LocalSaveRecord = {
        characterId: state.characterId,
        version: state.version,
        gameDay: state.world.day,
        updatedAt: Date.now(),
        state,
        backup: existing?.state,
      };
      store.put(record);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadLocal(characterId?: string): Promise<GameState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    if (characterId) {
      const req = store.get(characterId);
      req.onsuccess = () => {
        const rec = req.result as LocalSaveRecord | undefined;
        resolve(rec?.state ? migrateState(rec.state) : null);
      };
      req.onerror = () => reject(req.error);
    } else {
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result as LocalSaveRecord[]) ?? [];
        records.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(records[0]?.state ? migrateState(records[0].state) : null);
      };
      req.onerror = () => reject(req.error);
    }
  });
}

export async function loadLocalBackup(characterId: string): Promise<GameState | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(characterId);
    req.onsuccess = () => {
      const rec = req.result as LocalSaveRecord | undefined;
      resolve(rec?.backup ? migrateState(rec.backup) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function listLocalSaves(): Promise<LocalSaveRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as LocalSaveRecord[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocal(characterId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(characterId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteAllLocal(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMeta<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readonly');
    const req = tx.objectStore(META).get(key);
    req.onsuccess = () => resolve((req.result as { value: T } | undefined)?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function exportSaveJSON(state: GameState): string {
  return JSON.stringify({ kind: 'yaounde-life-save', exportedAt: Date.now(), state }, null, 0);
}

export function importSaveJSON(text: string): GameState | null {
  try {
    const parsed = JSON.parse(text) as { kind?: string; state?: GameState };
    if (parsed.kind === 'yaounde-life-save' && parsed.state) return migrateState(parsed.state);
    if (parsed && typeof parsed === 'object' && 'world' in parsed && 'player' in parsed) return migrateState(parsed as GameState);
    return null;
  } catch {
    return null;
  }
}
