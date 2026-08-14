-- Notify the rider when a partner (e.g. ColorPing) creates an appointment.
-- Previously only circle angels were notified (and only when notifyPrivateRideAngels).

create or replace function public.ingest_partner_appointment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner text := lower(nullif(trim(payload->>'partnerId'), ''));
  v_ext_user text := nullif(trim(coalesce(
    payload->>'externalUserId',
    payload->>'colorPingUserId',
    ''
  )), '');
  v_ref text := nullif(trim(payload->>'externalReference'), '');
  v_rider uuid;
  v_appt_id uuid := gen_random_uuid();
  v_ride_id uuid := gen_random_uuid();
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
  v_partner_label text;
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
    raise exception 'profile_id_required';
  end if;

  begin
    v_rider := (payload #>> '{riderIdentity,profileId}')::uuid;
  exception when others then
    raise exception 'invalid_profile_id';
  end;

  select exists (
    select 1
    from public.partner_account_links l
    where l.partner_id = v_partner
      and l.external_user_id = v_ext_user
      and l.profile_id = v_rider
      and l.status = 'verified'
  ) into v_link_ok;

  if not v_link_ok then
    raise exception 'link_not_verified';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_rider) then
    raise exception 'rider_not_found';
  end if;

  select display_name into v_display from public.profiles where id = v_rider;

  v_title := coalesce(nullif(trim(payload #>> '{appointment,title}'), ''), 'Reporting appointment');
  v_date := (payload #>> '{appointment,date}')::date;
  v_time := (payload #>> '{appointment,time}')::time;
  v_notes := nullif(trim(payload #>> '{appointment,notes}'), '');

  v_dest_label := coalesce(
    nullif(trim(payload #>> '{destination,label}'), ''),
    nullif(trim(payload #>> '{location,name}'), ''),
    'Reporting location'
  );
  v_dest_line1 := coalesce(
    nullif(trim(payload #>> '{destination,line1}'), ''),
    nullif(trim(payload #>> '{location,line1}'), ''),
    v_dest_label
  );
  v_pickup_label := coalesce(
    nullif(trim(payload #>> '{pickup,label}'), ''),
    'Pickup to confirm'
  );
  v_pickup_line1 := coalesce(
    nullif(trim(payload #>> '{pickup,line1}'), ''),
    'Confirm pickup address in Ride Angels'
  );

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
  v_partner_label := case
    when v_partner = 'colorping' then 'ColorPing'
    else initcap(v_partner)
  end;

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

  -- Always notify the rider that a partner created this appointment.
  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_rider,
    'appointment_changed',
    v_partner_label || ' appointment added',
    v_partner_label
      || ' created "'
      || v_title
      || '" for '
      || to_char(v_date, 'Mon FMDD')
      || '. Open it to confirm pickup details.',
    'appointment',
    v_appt_id::text,
    v_appt_id,
    v_ride_id
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

-- Backfill rider notification for today's already-created ColorPing appointment.
insert into public.notifications (
  recipient_profile_id, type, title, body,
  related_entity_type, related_entity_id,
  related_appointment_id, related_ride_request_id
)
select
  a.rider_id,
  'appointment_changed',
  'ColorPing appointment added',
  'ColorPing created "'
    || a.title
    || '" for '
    || to_char(a.ride_date, 'Mon FMDD')
    || '. Open it to confirm pickup details.',
  'appointment',
  a.id::text,
  a.id,
  rr.id
from public.appointments a
join public.ride_requests rr on rr.appointment_id = a.id
where a.external_reference =
  'colorping:a1000000-0000-4000-8000-000000000002:2026-08-12:8dcbd7b4-4196-4706-b4b3-7dae5076b909'
  and not exists (
    select 1
    from public.notifications n
    where n.recipient_profile_id = a.rider_id
      and n.related_appointment_id = a.id
      and n.title like '%appointment added'
  );
