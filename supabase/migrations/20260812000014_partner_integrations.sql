-- Generic partner integrations (ColorPing is the first partner).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.integration_partners (
  id text primary key,
  name text not null,
  api_key_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.integration_partners is
  'External apps allowed to link accounts and create appointments (e.g. colorping).';

alter table public.integration_partners enable row level security;

create table if not exists public.partner_link_challenges (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.integration_partners (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  external_user_id text not null,
  contact_submitted text not null,
  code_hash text not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists partner_link_challenges_lookup_idx
  on public.partner_link_challenges (partner_id, external_user_id, created_at desc);

alter table public.partner_link_challenges enable row level security;

create table if not exists public.partner_account_links (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null references public.integration_partners (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  external_user_id text not null,
  status text not null default 'verified'
    check (status in ('verified', 'revoked')),
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, external_user_id)
);

create unique index if not exists partner_account_links_active_profile_uidx
  on public.partner_account_links (partner_id, profile_id)
  where status = 'verified';

alter table public.partner_account_links enable row level security;

insert into public.integration_partners (id, name, api_key_hash, active)
values ('colorping', 'ColorPing', 'UNSET', true)
on conflict (id) do nothing;

-- Migrate legacy ColorPing-only rows if present.
do $$
begin
  if to_regclass('public.colorping_account_links') is not null then
    insert into public.partner_account_links (
      id, partner_id, profile_id, external_user_id, status, verified_at, revoked_at, created_at, updated_at
    )
    select
      id, 'colorping', profile_id, colorping_user_id, status,
      verified_at, revoked_at, created_at, updated_at
    from public.colorping_account_links
    on conflict (partner_id, external_user_id) do nothing;
  end if;

  if to_regclass('public.colorping_link_challenges') is not null then
    insert into public.partner_link_challenges (
      id, partner_id, profile_id, external_user_id, contact_submitted,
      code_hash, attempts, max_attempts, expires_at, consumed_at, created_at
    )
    select
      id, 'colorping', profile_id, colorping_user_id, contact_submitted,
      code_hash, attempts, max_attempts, expires_at, consumed_at, created_at
    from public.colorping_link_challenges
    on conflict (id) do nothing;
  end if;
end $$;

create or replace function public.set_partner_api_key(
  p_partner_id text,
  p_api_key text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if nullif(trim(p_partner_id), '') is null or nullif(trim(p_api_key), '') is null then
    raise exception 'partner_id_and_key_required';
  end if;

  update public.integration_partners
  set
    api_key_hash = encode(digest(trim(p_api_key), 'sha256'), 'hex'),
    updated_at = timezone('utc', now())
  where id = p_partner_id
    and active = true;

  if not found then
    raise exception 'partner_not_found';
  end if;
end;
$$;

revoke all on function public.set_partner_api_key(text, text) from public;
grant execute on function public.set_partner_api_key(text, text) to service_role;

create or replace function public.resolve_integration_partner(p_api_key text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_id text;
begin
  if nullif(trim(p_api_key), '') is null then
    return null;
  end if;
  v_hash := encode(digest(trim(p_api_key), 'sha256'), 'hex');
  select id into v_id
  from public.integration_partners
  where active = true
    and api_key_hash = v_hash
  limit 1;
  return v_id;
end;
$$;

revoke all on function public.resolve_integration_partner(text) from public;
grant execute on function public.resolve_integration_partner(text) to service_role;

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
  v_request_transport boolean := coalesce((payload->>'requestTransportation')::boolean, false);
  v_return_needed boolean := coalesce((payload->>'returnRideNeeded')::boolean, false);
  v_notify boolean := coalesce((payload->>'notifyPrivateRideAngels')::boolean, true);
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

  v_source := coalesce(nullif(trim(payload->>'source'), ''), upper(v_partner));
  v_appt_id := gen_random_uuid();

  insert into public.appointments (
    id, rider_id, created_by_user_id, title, ride_date, ride_time, notes,
    external_reference, source
  ) values (
    v_appt_id, v_rider, v_rider, v_title, v_date, v_time, v_notes, v_ref, v_source
  );

  if v_request_transport then
    v_dest_label := coalesce(
      nullif(trim(payload #>> '{destination,label}'), ''),
      nullif(trim(payload #>> '{location,name}'), ''),
      'Destination'
    );
    v_dest_line1 := coalesce(
      nullif(trim(payload #>> '{destination,line1}'), ''),
      nullif(trim(payload #>> '{location,line1}'), ''),
      'Address pending confirmation'
    );
    v_pickup_label := coalesce(nullif(trim(payload #>> '{pickup,label}'), ''), 'Pickup to confirm');
    v_pickup_line1 := coalesce(
      nullif(trim(payload #>> '{pickup,line1}'), ''),
      'Confirm pickup address in Ride Angels'
    );
    v_ride_id := gen_random_uuid();

    insert into public.ride_requests (
      id, appointment_id, rider_id, created_by_user_id,
      pickup_label, pickup_line1, destination_label, destination_line1,
      return_needed, return_pickup_time, visibility, status, rider_display_name
    ) values (
      v_ride_id, v_appt_id, v_rider, v_rider,
      v_pickup_label, v_pickup_line1, v_dest_label, v_dest_line1,
      v_return_needed, null, 'private', 'private_requested', coalesce(v_display, 'Rider')
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
          'New partner ride request',
          coalesce(v_display, 'A rider') || ' may need a ride for ' || v_title
            || ' (from ' || v_source || ').',
          'appointment',
          v_appt_id::text,
          v_appt_id,
          v_ride_id
        );
      end loop;
    end if;
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

-- Back-compat for ColorPing-named RPC.
create or replace function public.ingest_colorping_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.ingest_partner_appointment(
    payload || jsonb_build_object(
      'partnerId', 'colorping',
      'externalUserId', coalesce(
        payload->>'externalUserId',
        payload->>'colorPingUserId'
      )
    )
  );
end;
$$;

revoke all on function public.ingest_colorping_appointment(jsonb) from public;
grant execute on function public.ingest_colorping_appointment(jsonb) to service_role;
