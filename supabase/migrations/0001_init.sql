-- Yaounde Life - initial schema (PRD section 9, v1 core).
-- Local-first client: these tables back optional cloud sync (anonymous auth first).
-- Apply with: supabase db push  (or paste into the SQL editor).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  quality_tier text not null default 'auto',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create a profile row when a user signs up (incl. anonymous sign-in).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, locale)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'locale', 'en'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- characters
-- ---------------------------------------------------------------------------
create table if not exists public.characters (
  id text primary key, -- client-generated: char_<base36 timestamp>_<base36 rand>
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  background text not null,
  appearance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists characters_user_id_idx on public.characters (user_id);

alter table public.characters enable row level security;

create policy "characters_select_own" on public.characters
  for select using (user_id = auth.uid());
create policy "characters_insert_own" on public.characters
  for insert with check (user_id = auth.uid());
create policy "characters_update_own" on public.characters
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "characters_delete_own" on public.characters
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- saves: one versioned, compact JSONB snapshot per character
-- ---------------------------------------------------------------------------
create table if not exists public.saves (
  character_id text primary key references public.characters (id) on delete cascade,
  version int not null default 1,
  game_day int not null default 1,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists saves_game_day_idx on public.saves (game_day);

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
  before update on public.saves
  for each row execute function public.touch_updated_at();

alter table public.saves enable row level security;

create policy "saves_select_own" on public.saves
  for select using (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );
create policy "saves_insert_own" on public.saves
  for insert with check (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );
create policy "saves_update_own" on public.saves
  for update using (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );
create policy "saves_delete_own" on public.saves
  for delete using (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- ledger: economy audit trail (server may validate economy-critical events)
-- ---------------------------------------------------------------------------
create table if not exists public.ledger (
  id bigint generated always as identity primary key,
  character_id text not null references public.characters (id) on delete cascade,
  game_day int not null,
  kind text not null,
  amount_fcfa bigint not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledger_character_idx on public.ledger (character_id, game_day);

alter table public.ledger enable row level security;

create policy "ledger_select_own" on public.ledger
  for select using (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );
create policy "ledger_insert_own" on public.ledger
  for insert with check (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- businesses [P1]
-- ---------------------------------------------------------------------------
create table if not exists public.businesses (
  id text primary key,
  character_id text not null references public.characters (id) on delete cascade,
  kind text not null,
  district text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists businesses_character_idx on public.businesses (character_id);

alter table public.businesses enable row level security;

create policy "businesses_all_own" on public.businesses
  for all using (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- njangi / tontine [P1 in-game; server tables ready for v2 settlement]
-- ---------------------------------------------------------------------------
create table if not exists public.njangi_groups (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  contribution_fcfa int not null,
  cadence_days int not null default 30,
  status text not null default 'forming' check (status in ('forming', 'active', 'completed', 'dissolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.njangi_members (
  group_id text not null references public.njangi_groups (id) on delete cascade,
  character_id text not null,
  turn_order int not null,
  paid_cycles int not null default 0,
  reliability numeric(4,3) not null default 1.0,
  primary key (group_id, character_id)
);

create table if not exists public.njangi_rounds (
  id bigint generated always as identity primary key,
  group_id text not null references public.njangi_groups (id) on delete cascade,
  cycle int not null,
  recipient_id text,
  settled_at timestamptz,
  unique (group_id, cycle)
);

alter table public.njangi_groups enable row level security;
alter table public.njangi_members enable row level security;
alter table public.njangi_rounds enable row level security;

create policy "njangi_groups_select" on public.njangi_groups
  for select using (
    owner_id = auth.uid()
    or exists (select 1 from public.njangi_members m where m.group_id = id and m.character_id in (
      select c.id from public.characters c where c.user_id = auth.uid()
    ))
  );
create policy "njangi_groups_insert_own" on public.njangi_groups
  for insert with check (owner_id = auth.uid());
create policy "njangi_groups_update_own" on public.njangi_groups
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "njangi_groups_delete_own" on public.njangi_groups
  for delete using (owner_id = auth.uid());

create policy "njangi_members_select" on public.njangi_members
  for select using (
    exists (select 1 from public.njangi_groups g where g.id = group_id and g.owner_id = auth.uid())
    or character_id in (select c.id from public.characters c where c.user_id = auth.uid())
  );
create policy "njangi_members_insert_own" on public.njangi_members
  for insert with check (
    exists (select 1 from public.njangi_groups g where g.id = group_id and g.owner_id = auth.uid())
  );
create policy "njangi_members_update_own" on public.njangi_members
  for update using (
    exists (select 1 from public.njangi_groups g where g.id = group_id and g.owner_id = auth.uid())
  );

create policy "njangi_rounds_select" on public.njangi_rounds
  for select using (
    exists (select 1 from public.njangi_groups g where g.id = group_id and g.owner_id = auth.uid())
    or exists (select 1 from public.njangi_members m where m.group_id = group_id and m.character_id in (
      select c.id from public.characters c where c.user_id = auth.uid()
    ))
  );

-- ---------------------------------------------------------------------------
-- world_state: daily city state generated by pg_cron / Edge Function
-- ---------------------------------------------------------------------------
create table if not exists public.world_state (
  game_day int primary key,
  fuel_price int,
  weather text,
  strike jsonb not null default '{}'::jsonb,
  delestage jsonb not null default '{}'::jsonb,
  events jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.world_state enable row level security;

-- Readable by every signed-in client (anon included); written by service role only.
create policy "world_state_select_all" on public.world_state
  for select using (true);

-- ---------------------------------------------------------------------------
-- content packs: read-only for clients
-- ---------------------------------------------------------------------------
create table if not exists public.content_versions (
  pack text primary key,
  version text not null,
  checksum text,
  published_at timestamptz not null default now()
);

create table if not exists public.content_events (
  id text primary key,
  locale text not null default 'en',
  conditions jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,
  weight numeric not null default 1
);

alter table public.content_versions enable row level security;
alter table public.content_events enable row level security;

create policy "content_versions_read" on public.content_versions for select using (true);
create policy "content_events_read" on public.content_events for select using (true);

-- ---------------------------------------------------------------------------
-- purchases: written by Edge Functions (service role), read by the buyer
-- ---------------------------------------------------------------------------
create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  reference text not null unique,
  amount_xaf int not null,
  sku text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_idx on public.purchases (user_id, created_at desc);

alter table public.purchases enable row level security;

create policy "purchases_select_own" on public.purchases
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- achievements
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  character_id text not null references public.characters (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (character_id, achievement_id)
);

alter table public.achievements enable row level security;

create policy "achievements_all_own" on public.achievements
  for all using (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- reports: moderation / "report inaccurate content" flow
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "reports_insert_own" on public.reports
  for insert with check (user_id = auth.uid());
create policy "reports_select_own" on public.reports
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Extra columns the client relies on (idempotent for re-runs)
-- ---------------------------------------------------------------------------
alter table public.characters add column if not exists appearance jsonb not null default '{}'::jsonb;
alter table public.saves add column if not exists version int not null default 1;
alter table public.saves add column if not exists game_day int not null default 1;
