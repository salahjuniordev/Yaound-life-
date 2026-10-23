import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { GameState } from '../sim/types';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const authOptOutKey = 'yaounde-auth-optout';

export const supabaseEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (!client && url && anonKey) {
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export interface CloudStatus {
  connected: boolean;
  userId: string | null;
  anonymous: boolean;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  lastSyncAt: number | null;
  lastError: string | null;
}

export interface AuthResult {
  ok: boolean;
  message: string;
  status?: CloudStatus;
  needsConfirmation?: boolean;
}

function baseStatus(lastError: string | null = null): CloudStatus {
  return {
    connected: false,
    userId: null,
    anonymous: false,
    email: null,
    emailVerified: false,
    displayName: null,
    lastSyncAt: null,
    lastError,
  };
}

function authOptedOut(): boolean {
  try {
    return localStorage.getItem(authOptOutKey) === '1';
  } catch {
    return false;
  }
}

function setAuthOptedOut(value: boolean): void {
  try {
    if (value) localStorage.setItem(authOptOutKey, '1');
    else localStorage.removeItem(authOptOutKey);
  } catch {
    return;
  }
}

function redirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
}

async function statusFromUser(sb: SupabaseClient, user: User): Promise<CloudStatus> {
  let displayName: string | null = null;
  try {
    const { data } = await sb.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    displayName = (data as { display_name?: string | null } | null)?.display_name ?? null;
  } catch {
    displayName = null;
  }
  return {
    connected: true,
    userId: user.id,
    anonymous: Boolean(user.is_anonymous),
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    displayName,
    lastSyncAt: null,
    lastError: null,
  };
}

export async function getAuthStatus(): Promise<CloudStatus> {
  const sb = getSupabase();
  if (!sb) return baseStatus('Supabase not configured (offline mode).');
  try {
    const { data } = await sb.auth.getSession();
    if (!data.session?.user) return baseStatus();
    return await statusFromUser(sb, data.session.user);
  } catch (err) {
    return baseStatus(err instanceof Error ? err.message : 'auth failed');
  }
}

export async function ensureSession(): Promise<CloudStatus> {
  const sb = getSupabase();
  if (!sb) return baseStatus('Supabase not configured (offline mode).');
  if (authOptedOut()) return baseStatus();
  try {
    const { data: sessionData } = await sb.auth.getSession();
    if (sessionData.session?.user) return await statusFromUser(sb, sessionData.session.user);
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) return baseStatus(error.message);
    if (!data.user) return baseStatus('Anonymous sign-in returned no user.');
    return await statusFromUser(sb, data.user);
  } catch (err) {
    return baseStatus(err instanceof Error ? err.message : 'auth failed');
  }
}

export async function signUpAccount(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase not configured. Your progress stays on this device.' };
  try {
    const { data: sessionData } = await sb.auth.getSession();
    const current = sessionData.session?.user;
    if (current?.is_anonymous) {
      const { data, error } = await sb.auth.updateUser({ email: email.trim(), password });
      if (error) return { ok: false, message: error.message };
      setAuthOptedOut(false);
      const confirmed = Boolean(data.user?.email_confirmed_at);
      return {
        ok: true,
        message: confirmed
          ? 'Account created. Your progress is now linked.'
          : 'Account created. Check your inbox to confirm your email.',
        status: data.user ? await statusFromUser(sb, data.user) : undefined,
        needsConfirmation: !confirmed,
      };
    }
    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password,
      options: redirectUrl() ? { emailRedirectTo: redirectUrl() } : undefined,
    });
    if (error) return { ok: false, message: error.message };
    if (data.session?.user) {
      setAuthOptedOut(false);
      return { ok: true, message: 'Account created. You are signed in.', status: await statusFromUser(sb, data.session.user) };
    }
    setAuthOptedOut(true);
    return {
      ok: true,
      message: 'Account created. Check your inbox to confirm your email, then sign in.',
      needsConfirmation: true,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'sign up failed' };
  }
}

export async function signInAccount(email: string, password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase not configured. Your progress stays on this device.' };
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, message: error.message };
    setAuthOptedOut(false);
    return {
      ok: true,
      message: 'Signed in. Your cloud save is available.',
      status: data.user ? await statusFromUser(sb, data.user) : undefined,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'sign in failed' };
  }
}

export async function signOutAccount(): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase not configured.' };
  try {
    const { error } = await sb.auth.signOut();
    if (error) return { ok: false, message: error.message };
    setAuthOptedOut(true);
    return { ok: true, message: 'Signed out. Local saves stay on this device.', status: baseStatus() };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'sign out failed' };
  }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase not configured.' };
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), redirectUrl() ? { redirectTo: redirectUrl() } : undefined);
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Password reset link sent. Check your inbox.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'reset failed' };
  }
}

export async function resendConfirmation(email: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase not configured.' };
  try {
    const { error } = await sb.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: redirectUrl() ? { emailRedirectTo: redirectUrl() } : undefined,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Confirmation email resent.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'resend failed' };
  }
}

export async function updatePassword(password: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase not configured.' };
  try {
    const { error } = await sb.auth.updateUser({ password });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Password updated.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'update failed' };
  }
}

export async function updateDisplayName(displayName: string, locale: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, message: 'Supabase not configured.' };
  const status = await getAuthStatus();
  if (!status.userId) return { ok: false, message: 'Not signed in.' };
  try {
    const { error } = await sb
      .from('profiles')
      .upsert({ id: status.userId, display_name: displayName.trim() || null, locale }, { onConflict: 'id' });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: 'Profile updated.', status: { ...status, displayName: displayName.trim() || null } };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'profile update failed' };
  }
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
      user_id: status.userId,
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
    setAuthOptedOut(true);
    return { ok: true, message: 'Cloud data deleted. Local save remains on this device.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'delete failed' };
  }
}
