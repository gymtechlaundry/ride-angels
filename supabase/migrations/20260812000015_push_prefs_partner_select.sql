-- Push tokens, per-type notification preferences, partner link read RPC,
-- push dispatch trigger, and partner ingest always creates a private ride.

create extension if not exists pg_net with schema extensions;

-- —— Device push tokens ——
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, token)
);

create index if not exists device_push_tokens_user_id_idx
  on public.device_push_tokens (user_id);

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_select_own" on public.device_push_tokens;
create policy "device_push_tokens_select_own"
  on public.device_push_tokens for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "device_push_tokens_insert_own" on public.device_push_tokens;
create policy "device_push_tokens_insert_own"
  on public.device_push_tokens for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "device_push_tokens_update_own" on public.device_push_tokens;
create policy "device_push_tokens_update_own"
  on public.device_push_tokens for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "device_push_tokens_delete_own" on public.device_push_tokens;
create policy "device_push_tokens_delete_own"
  on public.device_push_tokens for delete
  to authenticated
  using (user_id = auth.uid());

-- —— Per-type notification preferences (missing key = enabled) ——
create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own"
  on public.notification_preferences for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own"
  on public.notification_preferences for insert
  to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own"
  on public.notification_preferences for update
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create or replace function public.notification_type_enabled(
  p_profile_id uuid,
  p_type text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefs jsonb;
  v_val text;
begin
  select preferences into v_prefs
  from public.notification_preferences
  where profile_id = p_profile_id;

  if v_prefs is null then
    return true;
  end if;

  if not (v_prefs ? p_type) then
    return true;
  end if;

  v_val := lower(coalesce(v_prefs ->> p_type, 'true'));
  return v_val in ('true', '1', 't', 'yes');
end;
$$;

revoke all on function public.notification_type_enabled(uuid, text) from public;
grant execute on function public.notification_type_enabled(uuid, text) to authenticated;
grant execute on function public.notification_type_enabled(uuid, text) to service_role;

create or replace function public.upsert_my_notification_preferences(
  p_preferences jsonb
)
returns public.notification_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.notification_preferences;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.notification_preferences (profile_id, preferences, updated_at)
  values (v_uid, coalesce(p_preferences, '{}'::jsonb), timezone('utc', now()))
  on conflict (profile_id) do update
    set preferences = coalesce(p_preferences, '{}'::jsonb),
        updated_at = timezone('utc', now())
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.upsert_my_notification_preferences(jsonb) from public;
grant execute on function public.upsert_my_notification_preferences(jsonb) to authenticated;

-- —— Partner links visible to the linked rider ——
create or replace function public.get_my_partner_links()
returns table (
  partner_id text,
  partner_name text,
  status text,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  return query
  select
    l.partner_id,
    coalesce(p.name, l.partner_id) as partner_name,
    l.status,
    l.verified_at
  from public.partner_account_links l
  left join public.integration_partners p on p.id = l.partner_id
  where l.profile_id = v_uid
    and l.status = 'verified'
  order by l.verified_at desc;
end;
$$;

revoke all on function public.get_my_partner_links() from public;
grant execute on function public.get_my_partner_links() to authenticated;

-- —— Push dispatch on notification insert ——
-- Vault secret `ride_angels_push_secret` must match Edge secret RIDE_ANGELS_PUSH_SECRET.
create or replace function public.notify_dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  push_secret text;
  fn_url text;
begin
  if not public.notification_type_enabled(new.recipient_profile_id, new.type) then
    return new;
  end if;

  select ds.decrypted_secret into push_secret
  from vault.decrypted_secrets as ds
  where ds.name = 'ride_angels_push_secret'
  limit 1;

  if push_secret is null or length(trim(push_secret)) = 0 then
    -- Not configured yet — in-app notifications still work.
    return new;
  end if;

  select ds.decrypted_secret into fn_url
  from vault.decrypted_secrets as ds
  where ds.name = 'ride_angels_dispatch_push_url'
  limit 1;

  if fn_url is null or length(trim(fn_url)) = 0 then
    fn_url := 'https://zuvfzmpdmjwewcuyxtac.supabase.co/functions/v1/dispatch-push';
  end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', push_secret
    ),
    body := jsonb_build_object(
      'notificationId', new.id,
      'recipientProfileId', new.recipient_profile_id,
      'type', new.type,
      'title', new.title,
      'body', new.body
    ),
    timeout_milliseconds := 8000
  );

  return new;
end;
$$;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row
  execute function public.notify_dispatch_push();

-- —— Partner ingest: always create private ride (Home/Calendar parity) ——
create or replace function public.ingest_partner_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(trim(payload->>'externalReference'), '');
  v_partner text := nullif(trim(payload->>'partnerId'), '');
  v_ext_user text := nullif(trim(payload->>'externalUserId'), '');
  v_rider uuid;
  v_appt_id uuid;
  v_ride_id uuid;
  v_existing public.appointments%rowtype;
  v_display text;
  v_title text;
  v_date date;
  v_time time;
  v_notes text;
  v_return_needed boolean := coalesce((payload->>'returnRideNeeded')::boolean, false);
  v_notify boolean := coalesce((payload->>'notifyPrivateRideAngels')::boolean, true);
  v_return_pickup time;
  v_dest_label text;
  v_dest_line1 text;
  v_pickup_label text;
  v_pickup_line1 text;
  v_angel record;
  v_link_ok boolean := false;
  v_source text;
begin
  if v_ref is null then raise exception 'external_reference_required'; end if;
  if v_partner is null then raise exception 'partner_required'; end if;
  if v_ext_user is null then raise exception 'external_user_required'; end if;

  if not exists (
    select 1 from public.integration_partners p
    where p.id = v_partner and p.active = true
  ) then
    raise exception 'partner_not_found';
  end if;

  select * into v_existing
  from public.appointments
  where external_reference = v_ref
  limit 1;

  if found then
    select id into v_ride_id
    from public.ride_requests
    where appointment_id = v_existing.id
    order by created_at
    limit 1;

    return jsonb_build_object(
      'created', false,
      'appointmentId', v_existing.id,
      'rideRequestId', v_ride_id,
      'externalReference', v_ref
    );
  end if;

  if payload #>> '{riderIdentity,profileId}' is null then
    raise exception 'verified_profile_required';
  end if;

  begin
    v_rider := (payload #>> '{riderIdentity,profileId}')::uuid;
  exception when others then
    raise exception 'verified_profile_required';
  end;

  select exists (
    select 1
    from public.partner_account_links l
    where l.partner_id = v_partner
      and l.profile_id = v_rider
      and l.external_user_id = v_ext_user
      and l.status = 'verified'
  ) into v_link_ok;

  if not v_link_ok then
    raise exception 'account_link_not_verified';
  end if;

  select display_name into v_display from public.profiles where id = v_rider;
  if not exists (select 1 from public.profiles where id = v_rider) then
    raise exception 'rider_not_found';
  end if;

  v_title := coalesce(nullif(trim(payload #>> '{appointment,title}'), ''), 'Partner appointment');
  v_date := (payload #>> '{appointment,date}')::date;
  v_time := (payload #>> '{appointment,time}')::time;
  v_notes := nullif(trim(payload #>> '{appointment,notes}'), '');
  if v_date is null or v_time is null then
    raise exception 'appointment_date_time_required';
  end if;

  begin
    v_return_pickup := nullif(trim(payload->>'returnPickupTime'), '')::time;
  exception when others then
    v_return_pickup := null;
  end;

  if v_return_pickup is null and v_return_needed then
    begin
      v_return_pickup := nullif(trim(payload #>> '{reportingWindow,end}'), '')::time;
    exception when others then
      v_return_pickup := null;
    end;
  end if;

  v_source := coalesce(nullif(trim(payload->>'source'), ''), upper(v_partner));
  v_appt_id := gen_random_uuid();
  v_ride_id := gen_random_uuid();

  v_dest_label := coalesce(
    nullif(trim(payload #>> '{destination,label}'), ''),
    nullif(trim(payload #>> '{location,name}'), ''),
    'Reporting location'
  );
  v_dest_line1 := coalesce(
    nullif(trim(payload #>> '{destination,line1}'), ''),
    nullif(trim(payload #>> '{location,line1}'), ''),
    'Address pending confirmation'
  );
  v_pickup_label := coalesce(
    nullif(trim(payload #>> '{pickup,label}'), ''),
    'Pickup to confirm'
  );
  v_pickup_line1 := coalesce(
    nullif(trim(payload #>> '{pickup,line1}'), ''),
    'Confirm pickup address in Ride Angels'
  );

  insert into public.appointments (
    id, rider_id, created_by_user_id, title, ride_date, ride_time, notes,
    external_reference, source
  ) values (
    v_appt_id, v_rider, v_rider, v_title, v_date, v_time, v_notes, v_ref, v_source
  );

  insert into public.ride_requests (
    id, appointment_id, rider_id, created_by_user_id,
    pickup_label, pickup_line1, destination_label, destination_line1,
    return_needed, return_pickup_time, visibility, status, rider_display_name
  ) values (
    v_ride_id, v_appt_id, v_rider, v_rider,
    v_pickup_label, v_pickup_line1, v_dest_label, v_dest_line1,
    v_return_needed, v_return_pickup, 'private', 'private_requested',
    coalesce(v_display, 'Rider')
  );

  if v_notify then
    for v_angel in
      select c.angel_id
      from public.ride_angel_connections c
      where c.rider_id = v_rider and c.status = 'accepted'
    loop
      insert into public.notifications (
        recipient_profile_id, type, title, body,
        related_entity_type, related_entity_id,
        related_appointment_id, related_ride_request_id
      ) values (
        v_angel.angel_id,
        'appointment_changed',
        'New ride request',
        coalesce(v_display, 'A rider')
          || ' needs a ride for '
          || v_title
          || ' (private circle).',
        'appointment',
        v_appt_id::text,
        v_appt_id,
        v_ride_id
      );
    end loop;
  end if;

  return jsonb_build_object(
    'created', true,
    'appointmentId', v_appt_id,
    'rideRequestId', v_ride_id,
    'externalReference', v_ref
  );
end;
$$;

revoke all on function public.ingest_partner_appointment(jsonb) from public;
grant execute on function public.ingest_partner_appointment(jsonb) to service_role;
