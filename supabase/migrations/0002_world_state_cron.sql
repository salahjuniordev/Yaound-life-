-- Daily shared city state for the asynchronous single-player world.
-- Apply after 0001_init.sql. The job generates one row per server city day.
-- pg_cron runs in UTC. Clients apply the latest row; offline clients keep the
-- local simulation instead.

do $$
begin
  -- CREATE EXTENSION is not idempotent on hosted Supabase when the extension
  -- is already enabled, so only run it when pg_cron is genuinely absent.
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute 'create extension pg_cron with schema pg_catalog';
  end if;
end;
$$;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Server city day. This is deliberately independent of each save's local day:
-- clients consume the latest published city state and keep their own calendar.
create or replace function public.city_state_day(p_date date)
returns integer
language sql
immutable
as $$
  select greatest(1, (p_date - date '2026-01-01') + 1);
$$;

create or replace function public.generate_world_state(p_game_day integer default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day integer := coalesce(p_game_day, public.city_state_day(current_date));
  v_weather text;
  v_weather_roll integer;
  v_fuel integer;
  v_strike_active boolean;
  v_outages jsonb := '{}'::jsonb;
  v_start integer;
  v_duration integer;
  v_finish integer;
  v_outage_en text;
  v_outage_fr text;
  v_headlines_en jsonb;
  v_headlines_fr jsonb;
  v_districts constant text[] := array[
    'mvog_mbi', 'nlongkak', 'mokolo', 'bastos', 'ngoa_ekelle',
    'boulevard', 'lac_municipal', 'mvan', 'mont_febe'
  ];
  v_district_names constant text[] := array[
    'Mvog-Mbi', 'Nlongkak', 'Mokolo', 'Bastos', 'Ngoa-Ekelle',
    'Boulevard du 20 Mai', 'Lac Municipal', 'Mvan', 'Mont Febe'
  ];
  i integer;
begin
  if v_day < 1 then
    raise exception 'city state day must be positive';
  end if;

  v_weather_roll := get_byte(decode(md5('weather:' || v_day::text), 'hex'), 0);
  v_weather := case
    when v_weather_roll < 90 then 'rain'
    when v_weather_roll < 180 then 'cloud'
    else 'sun'
  end;
  v_fuel := 800 + (get_byte(decode(md5('fuel:' || v_day::text), 'hex'), 0) % 101);
  v_strike_active := get_byte(decode(md5('strike:' || v_day::text), 'hex'), 0) < 13;

  for i in 1..array_length(v_districts, 1) loop
    if get_byte(decode(md5('outage:' || v_day::text || ':' || v_districts[i]), 'hex'), 0) < 45 then
      v_start := (array[420, 540, 780, 1020])[
        1 + (get_byte(decode(md5('outage-start:' || v_day::text || ':' || v_districts[i]), 'hex'), 0) % 4)
      ];
      v_duration := 60 + (
        get_byte(decode(md5('outage-duration:' || v_day::text || ':' || v_districts[i]), 'hex'), 0) % 121
      );
      v_finish := v_start + v_duration;
      v_outages := v_outages || jsonb_build_object(
        v_districts[i],
        jsonb_build_object('start', v_start, 'end', v_finish)
      );
      if v_outage_en is null then
        v_outage_en := format(
          'Planned delestage in %s from %s:00 to %s:00.',
          v_district_names[i],
          v_start / 60,
          v_finish / 60
        );
        v_outage_fr := format(
          'Délestage prévu à %s de %sh à %sh.',
          v_district_names[i],
          v_start / 60,
          v_finish / 60
        );
      end if;
    end if;
  end loop;

  v_headlines_en := jsonb_build_array(
    case v_weather
      when 'rain' then 'Rain slows the morning commute across the city.'
      when 'cloud' then 'Cloud cover holds over Yaoundé.'
      else 'Clear skies over Yaoundé.'
    end,
    format('Fuel settles at %s FCFA per litre at city pumps.', v_fuel),
    case
      when v_strike_active then 'Taxi strike: shared taxis stay parked; motos absorb the rush.'
      else 'Shared taxis are running normally today.'
    end
  );
  v_headlines_fr := jsonb_build_array(
    case v_weather
      when 'rain' then 'La pluie ralentit les trajets du matin dans la ville.'
      when 'cloud' then 'Le ciel reste couvert sur Yaoundé.'
      else 'Ciel dégagé sur Yaoundé.'
    end,
    format('Le carburant s’établit à %s FCFA le litre aux pompes de la ville.', v_fuel),
    case
      when v_strike_active then 'Grève des taxis : les taxis restent au parking ; les motos prennent le relais.'
      else 'Les taxis circulent normalement aujourd’hui.'
    end
  );
  if v_outage_en is not null then
    v_headlines_en := v_headlines_en || jsonb_build_array(v_outage_en);
    v_headlines_fr := v_headlines_fr || jsonb_build_array(v_outage_fr);
  end if;

  insert into public.world_state (game_day, fuel_price, weather, strike, delestage, events)
  values (
    v_day,
    v_fuel,
    v_weather,
    jsonb_build_object('active', v_strike_active),
    v_outages,
    jsonb_build_object('headlines', v_headlines_en, 'headlinesFr', v_headlines_fr)
  )
  on conflict (game_day) do update
    set fuel_price = excluded.fuel_price,
        weather = excluded.weather,
        strike = excluded.strike,
        delestage = excluded.delestage,
        events = excluded.events,
        created_at = now();
end;
$$;

-- Only the scheduler/owner may generate rows; clients have SELECT through RLS.
-- Supabase grants EXECUTE on new functions to anon/authenticated by default, so
-- revoke those explicit grants as well as the implicit PUBLIC grant.
revoke all on function public.generate_world_state(integer) from public;
revoke all on function public.generate_world_state(integer) from anon, authenticated;
grant execute on function public.generate_world_state(integer) to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'yaounde-world-state-daily') then
    perform cron.unschedule('yaounde-world-state-daily');
  end if;
  perform cron.schedule(
    'yaounde-world-state-daily',
    '5 0 * * *',
    'select public.generate_world_state();'
  );
end;
$$;

-- Create the current row immediately so a freshly migrated project has state.
select public.generate_world_state();
