-- Circle: notify accepted angels on appointment create + remove connection RPC.

-- —— Fan-out notifications when a rider creates an appointment ——
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
    id, rider_id, created_by_user_id, title, ride_date, ride_time, notes
  ) values (
    v_appt_id,
    v_uid,
    v_uid,
    payload->>'title',
    (payload->>'ride_date')::date,
    (payload->>'ride_time')::time,
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

  -- Notify each accepted private-circle Ride Angel (RPC-only inserts).
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

-- —— Either party can soft-remove a circle connection ——
create or replace function public.remove_ride_angel_connection(p_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_conn public.ride_angel_connections%rowtype;
  v_other uuid;
  v_actor_name text;
  v_other_is_angel boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_conn
  from public.ride_angel_connections
  where id = p_connection_id
  for update;

  if not found then
    raise exception 'connection_not_found';
  end if;

  if v_conn.rider_id <> v_uid and v_conn.angel_id <> v_uid then
    raise exception 'not_connection_party';
  end if;

  if v_conn.status = 'removed' then
    return jsonb_build_object('connection_id', p_connection_id, 'status', 'removed');
  end if;

  update public.ride_angel_connections
  set status = 'removed'
  where id = p_connection_id;

  v_other_is_angel := (v_uid = v_conn.rider_id);
  v_other := case when v_other_is_angel then v_conn.angel_id else v_conn.rider_id end;

  select display_name into v_actor_name from public.profiles where id = v_uid;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id
  ) values (
    v_other,
    'circle_removed',
    'Removed from circle',
    case
      when v_other_is_angel then
        coalesce(v_actor_name, 'A rider')
          || ' removed you from their Ride Angels circle.'
      else
        coalesce(v_actor_name, 'A Ride Angel')
          || ' left your Ride Angels circle.'
    end,
    'ride_angel_connection',
    p_connection_id::text
  );

  return jsonb_build_object('connection_id', p_connection_id, 'status', 'removed');
end;
$$;

revoke all on function public.remove_ride_angel_connection(uuid) from public;
grant execute on function public.remove_ride_angel_connection(uuid) to authenticated;
