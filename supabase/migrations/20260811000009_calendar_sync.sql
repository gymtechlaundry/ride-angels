-- Calendar sync preferences + ride↔ external event tracking.

-- —— Preferences (one row per profile) ——
create table if not exists public.calendar_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  sync_enabled boolean not null default false,
  preferred_provider text,
  selected_calendar_id text,
  selected_calendar_name text,
  connection_status text not null default 'not_connected',
  google_account_email text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_preferences_provider_check
    check (
      preferred_provider is null
      or preferred_provider in ('apple', 'google')
    ),
  constraint calendar_preferences_status_check
    check (
      connection_status in (
        'not_connected',
        'connected',
        'permission_denied',
        'expired',
        'error'
      )
    )
);

create index if not exists calendar_preferences_provider_idx
  on public.calendar_preferences (preferred_provider)
  where sync_enabled;

alter table public.calendar_preferences enable row level security;

drop policy if exists calendar_preferences_select_own on public.calendar_preferences;
create policy calendar_preferences_select_own
  on public.calendar_preferences for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists calendar_preferences_insert_own on public.calendar_preferences;
create policy calendar_preferences_insert_own
  on public.calendar_preferences for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists calendar_preferences_update_own on public.calendar_preferences;
create policy calendar_preferences_update_own
  on public.calendar_preferences for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists calendar_preferences_delete_own on public.calendar_preferences;
create policy calendar_preferences_delete_own
  on public.calendar_preferences for delete to authenticated
  using (profile_id = auth.uid());

drop trigger if exists calendar_preferences_set_updated_at on public.calendar_preferences;
create trigger calendar_preferences_set_updated_at
  before update on public.calendar_preferences
  for each row execute function public.set_updated_at();

-- —— External event tracking (ride × user × provider) ——
create table if not exists public.ride_calendar_events (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  external_calendar_id text,
  external_event_id text,
  sync_status text not null default 'pending',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ride_calendar_events_provider_check
    check (provider in ('apple', 'google')),
  constraint ride_calendar_events_status_check
    check (
      sync_status in (
        'pending',
        'synced',
        'failed',
        'deleted',
        'disabled'
      )
    )
);

-- One active mapping per ride + user + provider (deleted rows can remain for audit).
create unique index if not exists ride_calendar_events_active_unique
  on public.ride_calendar_events (ride_request_id, profile_id, provider)
  where sync_status in ('pending', 'synced', 'failed');

create index if not exists ride_calendar_events_profile_idx
  on public.ride_calendar_events (profile_id, sync_status);

create index if not exists ride_calendar_events_ride_idx
  on public.ride_calendar_events (ride_request_id);

alter table public.ride_calendar_events enable row level security;

drop policy if exists ride_calendar_events_select_own on public.ride_calendar_events;
create policy ride_calendar_events_select_own
  on public.ride_calendar_events for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists ride_calendar_events_insert_own on public.ride_calendar_events;
create policy ride_calendar_events_insert_own
  on public.ride_calendar_events for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists ride_calendar_events_update_own on public.ride_calendar_events;
create policy ride_calendar_events_update_own
  on public.ride_calendar_events for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists ride_calendar_events_delete_own on public.ride_calendar_events;
create policy ride_calendar_events_delete_own
  on public.ride_calendar_events for delete to authenticated
  using (profile_id = auth.uid());

drop trigger if exists ride_calendar_events_set_updated_at on public.ride_calendar_events;
create trigger ride_calendar_events_set_updated_at
  before update on public.ride_calendar_events
  for each row execute function public.set_updated_at();

-- Upsert helper for preferences (mobile-friendly).
create or replace function public.upsert_calendar_preferences(payload jsonb)
returns public.calendar_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.calendar_preferences;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.calendar_preferences (
    profile_id,
    sync_enabled,
    preferred_provider,
    selected_calendar_id,
    selected_calendar_name,
    connection_status,
    google_account_email,
    last_error
  ) values (
    v_uid,
    coalesce((payload->>'sync_enabled')::boolean, false),
    nullif(payload->>'preferred_provider', ''),
    nullif(payload->>'selected_calendar_id', ''),
    nullif(payload->>'selected_calendar_name', ''),
    coalesce(nullif(payload->>'connection_status', ''), 'not_connected'),
    nullif(payload->>'google_account_email', ''),
    nullif(payload->>'last_error', '')
  )
  on conflict (profile_id) do update set
    sync_enabled = coalesce((payload->>'sync_enabled')::boolean, calendar_preferences.sync_enabled),
    preferred_provider = case
      when payload ? 'preferred_provider' then nullif(payload->>'preferred_provider', '')
      else calendar_preferences.preferred_provider
    end,
    selected_calendar_id = case
      when payload ? 'selected_calendar_id' then nullif(payload->>'selected_calendar_id', '')
      else calendar_preferences.selected_calendar_id
    end,
    selected_calendar_name = case
      when payload ? 'selected_calendar_name' then nullif(payload->>'selected_calendar_name', '')
      else calendar_preferences.selected_calendar_name
    end,
    connection_status = coalesce(
      nullif(payload->>'connection_status', ''),
      calendar_preferences.connection_status
    ),
    google_account_email = case
      when payload ? 'google_account_email' then nullif(payload->>'google_account_email', '')
      else calendar_preferences.google_account_email
    end,
    last_error = case
      when payload ? 'last_error' then nullif(payload->>'last_error', '')
      else calendar_preferences.last_error
    end,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_calendar_preferences(jsonb) from public;
grant execute on function public.upsert_calendar_preferences(jsonb) to authenticated;
