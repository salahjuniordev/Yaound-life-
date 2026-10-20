import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = { ...process.env };
for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {
    /* file is optional */
  }
}

const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
const anonKey = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();

if (!url || !anonKey) {
  console.error('Missing Supabase URL or anon key.');
  console.error('Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (or SUPABASE_URL / SUPABASE_ANON_KEY).');
  console.error('See SETUP.md for creating the project and applying supabase/migrations/0001_init.sql.');
  process.exit(2);
}

function jwtRole(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json).role;
  } catch {
    return null;
  }
}

if (jwtRole(anonKey) === 'service_role') {
  console.error('Refusing to run: that key is a service_role key. Use the public anon key.');
  process.exit(2);
}

let failures = 0;

function report(ok, label, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

function makeClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInAnonymously(client, label) {
  const { data, error } = await client.auth.signInAnonymously();
  if (error) {
    console.error(`Anonymous sign-in failed for ${label}: ${error.message}`);
    console.error('Enable Authentication → Providers → Anonymous in the Supabase dashboard.');
    process.exit(1);
  }
  return data.user.id;
}

const owner = makeClient();
const intruder = makeClient();
const characterId = `verify_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

try {
  const ownerId = await signInAnonymously(owner, 'owner');
  const intruderId = await signInAnonymously(intruder, 'intruder');
  report(ownerId !== intruderId, 'two anonymous sessions are distinct');

  const { data: profiles, error: profilesError } = await owner.from('profiles').select('id').eq('id', ownerId);
  report(!profilesError && profiles?.length === 1, 'handle_new_user trigger creates a profile', profilesError?.message);

  const { error: worldError } = await owner.from('world_state').select('game_day').limit(1);
  report(!worldError, 'world_state is readable by clients', worldError?.message);

  const { error: contentWriteError } = await owner.from('content_versions').insert({ pack: 'verify', version: '0' });
  report(Boolean(contentWriteError), 'content_versions is read-only for clients', contentWriteError ? 'insert denied' : 'INSERT SUCCEEDED');

  const { error: characterError } = await owner.from('characters').insert({
    id: characterId,
    user_id: ownerId,
    name: 'RLS verify',
    background: 'verify',
  });
  report(!characterError, 'owner can insert own character', characterError?.message);

  const { error: saveError } = await owner.from('saves').insert({
    character_id: characterId,
    version: 1,
    game_day: 0,
    state: { probe: true },
  });
  report(!saveError, 'owner can insert own save', saveError?.message);

  const { data: ownCharacters, error: ownCharactersError } = await owner
    .from('characters')
    .select('id')
    .eq('id', characterId);
  report(!ownCharactersError && ownCharacters?.length === 1, 'owner can read own character', ownCharactersError?.message);

  const { data: foreignCharacters, error: foreignCharactersError } = await intruder
    .from('characters')
    .select('id')
    .eq('id', characterId);
  report(
    !foreignCharactersError && (foreignCharacters?.length ?? 0) === 0,
    'intruder cannot read another character',
    foreignCharactersError?.message,
  );

  const { data: foreignSaves, error: foreignSavesError } = await intruder
    .from('saves')
    .select('character_id')
    .eq('character_id', characterId);
  report(!foreignSavesError && (foreignSaves?.length ?? 0) === 0, 'intruder cannot read another save', foreignSavesError?.message);

  const { data: deleted, error: deleteError } = await intruder
    .from('saves')
    .delete()
    .eq('character_id', characterId)
    .select('character_id');
  report(!deleteError && (deleted?.length ?? 0) === 0, 'intruder cannot delete another save', deleteError?.message);

  const { error: ledgerError } = await intruder.from('ledger').insert({
    character_id: characterId,
    game_day: 0,
    kind: 'verify',
    amount_fcfa: 0,
  });
  report(Boolean(ledgerError), 'intruder cannot write another ledger', ledgerError ? 'insert denied' : 'INSERT SUCCEEDED');

  const { error: reportError } = await owner.from('reports').insert({
    user_id: ownerId,
    kind: 'verify',
    payload: { probe: true },
  });
  report(!reportError, 'owner can insert own report', reportError?.message);

  const { data: ownReports, error: ownReportsError } = await owner
    .from('reports')
    .select('id')
    .eq('kind', 'verify')
    .eq('user_id', ownerId);
  report(!ownReportsError && (ownReports?.length ?? 0) >= 1, 'owner can read own report', ownReportsError?.message);

  const { data: foreignReports, error: foreignReportsError } = await intruder
    .from('reports')
    .select('id')
    .eq('user_id', ownerId);
  report(
    !foreignReportsError && (foreignReports?.length ?? 0) === 0,
    'intruder cannot read another report',
    foreignReportsError?.message,
  );
} finally {
  try {
    const ownerId = (await owner.auth.getUser()).data.user?.id;
    if (ownerId) {
      await owner.from('reports').delete().eq('user_id', ownerId).eq('kind', 'verify');
    }
    await owner.from('saves').delete().eq('character_id', characterId);
    await owner.from('characters').delete().eq('id', characterId);
    await owner.auth.signOut();
    await intruder.auth.signOut();
  } catch {
    /* best-effort cleanup */
  }
}

console.log(`\n${failures === 0 ? 'RLS verification passed' : `${failures} RLS check(s) failed`} — ${url}`);
process.exit(failures === 0 ? 0 : 1);
