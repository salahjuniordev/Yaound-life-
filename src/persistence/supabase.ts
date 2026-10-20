import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GameState } from '../sim/types';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const supabaseEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!client && url && anonKey) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}

export interface CloudStatus {
  connected: boolean;
  userId: string | null;
  anonymous: boolean;
  email: string | null;
  lastSyncAt: number | null;
  lastError: string | null;
}

export async function ensureSession(): Promise<CloudStatus> {
  const sb = getSupabase();
  const base: CloudStatus = { connected: false, userId: null, anonymous: false, email: null, lastSyncAt: null, lastError: null };
  if (!sb) return { ...base, lastError: 'Supabase not configured (offline mode).' };
  try {
    const { data: sessionData } = await sb.auth.getSession();
    if (sessionData.session?.user) {
      return {
        connected: true,
        userId: sessionData.session.user.id,
        anonymous: Boolean(sessionData.session.user.is_anonymous),
        email: sessionData.session.user.email ?? null,
        lastSyncAt: null,
        lastError: null,
      };
    }
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) return { ...base, connected: false, lastError: error.message };
    return {
      connected: true,
      userId: data.user?.id ?? null,
      anonymous: true,
      email: null,
      lastSyncAt: null,
      lastError: null,
    };
  } catch (err) {
    return { ...base, lastError: err instanceof Error ? err.message : 'auth failed' };
  }
}

export async function linkEmail(email: string): Promise<{ ok: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase not configured. Your progress stays on this device.' };
  const { error } = await sb.auth.updateUser({ email });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: 'Check your inbox for the confirmation link. Your progress will sync after linking.' };
}

export async function pushCloudSave(state: GameState): Promise<{ ok: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Offline mode: saved locally only.' };
  const status = await ensureSession();
  if (!status.connected || !status.userId) return { ok: false, message: status.lastError ?? 'Not connected.' };
  try {
    await sb.from('profiles').upsert({ id: status.userId, locale: state.settings.language }, { onConflict: 'id' });
    await sb.from('characters').upsert(
      {
        id: state.characterId,
        user_id: status.userId,
        name: state.player.name,
        background: state.player.background,
        appearance: state.player.appearance as unknown as Record<string, unknown>,
      },
      { onConflict: 'id' },
    );
    const { error } = await sb.from('saves').upsert(
      {
        character_id: state.characterId,
        version: state.version,
        game_day: state.world.day,
        state: state as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'character_id' },
    );
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Cloud save updated.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'sync failed' };
  }
}

export async function pullCloudSave(characterId?: string): Promise<{ state: GameState | null; message: string }> {
  const sb = getSupabase();
  if (!sb) return { state: null, message: 'Supabase not configured.' };
  const status = await ensureSession();
  if (!status.connected || !status.userId) return { state: null, message: status.lastError ?? 'Not connected.' };
  try {
    let query = sb.from('saves').select('character_id, game_day, updated_at, state').order('game_day', { ascending: false }).limit(1);
    if (characterId) query = query.eq('character_id', characterId);
    const { data, error } = await query;
    if (error) return { state: null, message: error.message };
    const row = data?.[0] as { state?: GameState } | undefined;
    if (!row?.state) return { state: null, message: 'No cloud save found.' };
    return { state: row.state, message: 'Cloud save loaded.' };
  } catch (err) {
    return { state: null, message: err instanceof Error ? err.message : 'load failed' };
  }
}

export async function fetchWorldState(): Promise<{ weather?: string; fuelPrice?: number; headlines?: string[] } | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('world_state').select('*').order('game_day', { ascending: false }).limit(1);
    if (error || !data || data.length === 0) return null;
    const row = data[0] as { weather?: string; fuel_price?: number; events?: { headlines?: string[] } };
    return { weather: row.weather, fuelPrice: row.fuel_price, headlines: row.events?.headlines };
  } catch {
    return null;
  }
}

export async function sendReport(report: { id: string; kind: string; refId: string; note: string; day: number; minute: number }, characterId?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const status = await ensureSession();
    if (!status.userId) return;
    await sb.from('reports').insert({
      kind: report.kind,
      payload: { reportId: report.id, refId: report.refId, note: report.note, day: report.day, minute: report.minute, characterId },
    });
  } catch {
    // offline-first: reports stay queued locally; sync is best-effort
  }
}

export async function deleteCloudData(): Promise<{ ok: boolean; message: string }> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Not configured.' };
  const status = await ensureSession();
  if (!status.userId) return { ok: false, message: 'Not signed in.' };
  try {
    await sb.from('saves').delete().match({});
    await sb.from('characters').delete().match({});
    const { error } = await sb.auth.signOut();
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Cloud data deleted. Local save remains on this device.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'delete failed' };
  }
}
