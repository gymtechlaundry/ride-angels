-- ColorPing ingest: idempotent external appointments from ColorPing.

alter table public.appointments
  add column if not exists external_reference text,
  add column if not exists source text;

create unique index if not exists appointments_external_reference_uidx
  on public.appointments (external_reference)
  where external_reference is not null;

comment on column public.appointments.external_reference is
  'Stable idempotency key from an external system (e.g. ColorPing colorping:{line}:{date}:{user}).';
comment on column public.appointments.source is
  'Origin system when not created in-app (e.g. COLORPING).';

-- Service-role / Edge Function only: create appointment (+ optional private ride)
-- for a rider resolved by profile id, phone, or email.
create or replace function public.ingest_colorping_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text := nullif(trim(payload->>'externalReference'), '');
  v_rider uuid;
  v_identity text;
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
begin
  if v_ref is null then
    raise exception 'external_reference_required';
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

  -- Resolve rider: profileId → phone → email
  if payload #>> '{riderIdentity,profileId}' is not null then
    v_rider := (payload #>> '{riderIdentity,profileId}')::uuid;
  elsif nullif(trim(payload #>> '{riderIdentity,phone}'), '') is not null then
    v_identity := trim(payload #>> '{riderIdentity,phone}');
    select id into v_rider
    from public.find_profile_for_invite(v_identity)
    limit 1;
  elsif nullif(trim(payload #>> '{riderIdentity,email}'), '') is not null then
    v_identity := trim(payload #>> '{riderIdentity,email}');
    select id into v_rider
    from public.find_profile_for_invite(v_identity)
    limit 1;
  end if;

  if v_rider is null then
    raise exception 'rider_not_found';
  end if;

  select display_name into v_display from public.profiles where id = v_rider;

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
-- Callable only via service_role (Edge Function). Not granted to authenticated.
grant execute on function public.ingest_colorping_appointment(jsonb) to service_role;
