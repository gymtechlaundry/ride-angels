-- Optional destination appointment start (pickup remains appointments.ride_time).

alter table public.appointments
  add column if not exists appointment_start_time time null;

comment on column public.appointments.ride_time is
  'Pickup time — when the Ride Angel should be at the pickup address.';
comment on column public.appointments.appointment_start_time is
  'Optional — when the rider needs to be at the destination (clinic/appointment start).';

-- —— Create: accept optional appointment_start_time ——
create or replace function public.create_appointment_with_ride(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_appt_id uuid := coalesce((payload->>'id')::uuid, gen_random_uuid());
  v_ride_id uuid := coalesce((payload->>'ride_id')::uuid, gen_random_uuid());
  v_display text;
  v_visibility text := coalesce(payload->>'visibility', 'private');
  v_status text;
  v_title text := coalesce(payload->>'title', 'Appointment');
  v_angel record;
  v_visibility_label text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select display_name into v_display from public.profiles where id = v_uid;
  v_status := case
    when v_visibility = 'public' then 'public_requested'
    else 'private_requested'
  end;
  v_visibility_label := case
    when v_visibility = 'public' then 'community board'
    else 'private circle'
  end;

  insert into public.appointments (
    id, rider_id, created_by_user_id, title, ride_date, ride_time,
    appointment_start_time, notes
  ) values (
    v_appt_id,
    v_uid,
    v_uid,
    payload->>'title',
    (payload->>'ride_date')::date,
    (payload->>'ride_time')::time,
    nullif(payload->>'appointment_start_time', '')::time,
    nullif(payload->>'notes', '')
  );

  insert into public.ride_requests (
    id, appointment_id, rider_id, created_by_user_id,
    pickup_label, pickup_line1, destination_label, destination_line1,
    return_needed, return_pickup_time, visibility, status, rider_display_name
  ) values (
    v_ride_id,
    v_appt_id,
    v_uid,
    v_uid,
    payload->>'pickup_label',
    payload->>'pickup_line1',
    payload->>'destination_label',
    payload->>'destination_line1',
    coalesce((payload->>'return_needed')::boolean, false),
    nullif(payload->>'return_pickup_time', '')::time,
    v_visibility,
    v_status,
    coalesce(v_display, 'Rider')
  );

  for v_angel in
    select c.angel_id
    from public.ride_angel_connections c
    where c.rider_id = v_uid
      and c.status = 'accepted'
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
        || ' ('
        || v_visibility_label
        || ').',
      'appointment',
      v_appt_id::text,
      v_appt_id,
      v_ride_id
    );
  end loop;

  return jsonb_build_object(
    'appointment_id', v_appt_id,
    'ride_request_id', v_ride_id
  );
end;
$$;

revoke all on function public.create_appointment_with_ride(jsonb) from public;
grant execute on function public.create_appointment_with_ride(jsonb) to authenticated;

-- —— Update: accept optional appointment_start_time ——
create or replace function public.update_appointment_details(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_appt_id uuid := (payload->>'id')::uuid;
  v_appt public.appointments%rowtype;
  v_ride public.ride_requests%rowtype;
  v_angel_id uuid;
  v_assignment_id uuid;
  v_rider_name text;
  v_summary text;
  v_needs_reconfirm boolean := false;
  v_open_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_appt_id is null then
    raise exception 'appointment_not_found';
  end if;

  select * into v_appt
  from public.appointments
  where id = v_appt_id
  for update;

  if not found then
    raise exception 'appointment_not_found';
  end if;
  if v_appt.rider_id <> v_uid then
    raise exception 'not_appointment_owner';
  end if;
  if v_appt.status = 'cancelled' then
    raise exception 'appointment_already_cancelled';
  end if;

  select * into v_ride
  from public.ride_requests
  where appointment_id = v_appt_id
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'ride_not_found';
  end if;

  select a.id, a.angel_id into v_assignment_id, v_angel_id
  from public.ride_assignments a
  where a.ride_request_id = v_ride.id
    and a.confirmation_status in ('confirmed', 'pending_reconfirm')
  limit 1;

  update public.appointments
  set
    title = coalesce(nullif(payload->>'title', ''), title),
    ride_date = coalesce((payload->>'ride_date')::date, ride_date),
    ride_time = coalesce((payload->>'ride_time')::time, ride_time),
    appointment_start_time = case
      when payload ? 'appointment_start_time'
        and nullif(payload->>'appointment_start_time', '') is null then null
      when payload ? 'appointment_start_time'
        then (payload->>'appointment_start_time')::time
      else appointment_start_time
    end,
    notes = coalesce(payload->>'notes', notes),
    updated_at = now()
  where id = v_appt_id;

  update public.ride_requests
  set
    pickup_label = coalesce(nullif(payload->>'pickup_label', ''), pickup_label),
    pickup_line1 = coalesce(nullif(payload->>'pickup_line1', ''), pickup_line1),
    destination_label = coalesce(nullif(payload->>'destination_label', ''), destination_label),
    destination_line1 = coalesce(nullif(payload->>'destination_line1', ''), destination_line1),
    return_needed = coalesce((payload->>'return_needed')::boolean, return_needed),
    return_pickup_time = case
      when payload ? 'return_pickup_time' and nullif(payload->>'return_pickup_time', '') is null then null
      when payload ? 'return_pickup_time' then (payload->>'return_pickup_time')::time
      else return_pickup_time
    end,
    visibility = coalesce(nullif(payload->>'visibility', ''), visibility),
    updated_at = now()
  where id = v_ride.id;

  if v_assignment_id is not null then
    v_needs_reconfirm := true;
    v_summary := coalesce(
      nullif(payload->>'change_summary', ''),
      'Date, time, or trip details were updated.'
    );

    update public.ride_assignments
    set
      confirmation_status = 'pending_reconfirm',
      pending_change_summary = v_summary
    where id = v_assignment_id;

    select display_name into v_rider_name from public.profiles where id = v_uid;

    insert into public.notifications (
      recipient_profile_id, type, title, body,
      related_entity_type, related_entity_id,
      related_appointment_id, related_ride_request_id
    ) values (
      v_angel_id,
      'appointment_changed',
      'Trip details changed',
      coalesce(v_rider_name, 'A rider') || ' updated "' ||
        coalesce(nullif(payload->>'title', ''), v_appt.title) ||
        '". Please confirm you can still drive. ' || v_summary,
      'appointment',
      v_appt_id::text,
      v_appt_id,
      v_ride.id
    );
  else
    select visibility into v_open_status from public.ride_requests where id = v_ride.id;
    update public.ride_requests
    set status = case
      when status in ('cancelled', 'completed', 'ride_cancelled') then status
      when visibility = 'public' and status not in ('offers_received') then 'public_requested'
      when visibility = 'private' then 'private_requested'
      else status
    end,
    updated_at = now()
    where id = v_ride.id
      and status not in ('cancelled', 'completed', 'ride_cancelled', 'offers_received');
  end if;

  return jsonb_build_object(
    'appointment_id', v_appt_id,
    'ride_request_id', v_ride.id,
    'needs_reconfirm', v_needs_reconfirm,
    'angel_id', v_angel_id
  );
end;
$$;

revoke all on function public.update_appointment_details(jsonb) from public;
grant execute on function public.update_appointment_details(jsonb) to authenticated;
