-- Verified ColorPing ↔ Ride Angels account links (OTP handshake).

create table if not exists public.colorping_link_challenges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  colorping_user_id text not null,
  contact_submitted text not null,
  code_hash text not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists colorping_link_challenges_profile_idx
  on public.colorping_link_challenges (profile_id, created_at desc);

create index if not exists colorping_link_challenges_cp_user_idx
  on public.colorping_link_challenges (colorping_user_id, created_at desc);

alter table public.colorping_link_challenges enable row level security;
-- No authenticated policies — service_role / Edge Function only.

create table if not exists public.colorping_account_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  colorping_user_id text not null,
  status text not null default 'verified'
    check (status in ('verified', 'revoked')),
  verified_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (colorping_user_id)
);

create unique index if not exists colorping_account_links_active_profile_uidx
  on public.colorping_account_links (profile_id)
  where status = 'verified';

create index if not exists colorping_account_links_profile_idx
  on public.colorping_account_links (profile_id);

alter table public.colorping_account_links enable row level security;
-- No authenticated policies — service_role / Edge Function only.

comment on table public.colorping_account_links is
  'Verified ColorPing user ↔ Ride Angels profile pairs. Required before ColorPing ingest.';

-- Ingest: ONLY verified profileId + colorPingUserId pairs (no phone/email shortcut).
create or replace function public.ingest_colorping_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(trim(payload->>'externalReference'), '');
  v_cp_user text := nullif(trim(payload->>'colorPingUserId'), '');
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
begin
  if v_ref is null then
    raise exception 'external_reference_required';
  end if;

  if v_cp_user is null then
    raise exception 'colorping_user_required';
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
    from public.colorping_account_links l
    where l.profile_id = v_rider
      and l.colorping_user_id = v_cp_user
      and l.status = 'verified'
  ) into v_link_ok;

  if not v_link_ok then
    raise exception 'account_link_not_verified';
  end if;

  select display_name into v_display from public.profiles where id = v_rider;
  if v_display is null and not exists (select 1 from public.profiles where id = v_rider) then
    raise exception 'rider_not_found';
  end if;

  v_title := coalesce(nullif(trim(payload #>> '{appointment,title}'), ''), 'ColorPing reporting');
  v_date := (payload #>> '{appointment,date}')::date;
  v_time := (payload #>> '{appointment,time}')::time;
  v_notes := nullif(trim(payload #>> '{appointment,notes}'), '');

  if v_date is null or v_time is null then
    raise exception 'appointment_date_time_required';
  end if;

  v_appt_id := gen_random_uuid();

  insert into public.appointments (
    id, rider_id, created_by_user_id, title, ride_date, ride_time, notes,
    external_reference, source
  ) values (
    v_appt_id,
    v_rider,
    v_rider,
    v_title,
    v_date,
    v_time,
    v_notes,
    v_ref,
    coalesce(nullif(trim(payload->>'source'), ''), 'COLORPING')
  );

  if v_request_transport then
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

    v_ride_id := gen_random_uuid();

    insert into public.ride_requests (
      id, appointment_id, rider_id, created_by_user_id,
      pickup_label, pickup_line1, destination_label, destination_line1,
      return_needed, return_pickup_time, visibility, status, rider_display_name
    ) values (
      v_ride_id,
      v_appt_id,
      v_rider,
      v_rider,
      v_pickup_label,
      v_pickup_line1,
      v_dest_label,
      v_dest_line1,
      v_return_needed,
      null,
      'private',
      'private_requested',
      coalesce(v_display, 'Rider')
    );

    if v_notify then
      for v_angel in
        select c.angel_id
        from public.ride_angel_connections c
        where c.rider_id = v_rider
          and c.status = 'accepted'
      loop
        insert into public.notifications (
          recipient_profile_id, type, title, body,
          related_entity_type, related_entity_id,
          related_appointment_id, related_ride_request_id
        ) values (
          v_angel.angel_id,
          'appointment_changed',
          'New ColorPing ride request',
          coalesce(v_display, 'A rider')
            || ' may need a ride for '
            || v_title
            || ' (from ColorPing).',
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

revoke all on function public.ingest_colorping_appointment(jsonb) from public;
grant execute on function public.ingest_colorping_appointment(jsonb) to service_role;
