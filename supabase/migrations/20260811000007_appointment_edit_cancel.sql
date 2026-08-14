-- Appointment cancel / edit + angel reconfirm after claimed changes.

-- —— Appointments: soft cancel ——
alter table public.appointments
  add column if not exists status text not null default 'active';
alter table public.appointments
  drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check
  check (status in ('active', 'cancelled'));

alter table public.appointments
  add column if not exists cancellation_reason text;
alter table public.appointments
  add column if not exists cancelled_at timestamptz;

-- —— Assignments: reconfirm lifecycle ——
alter table public.ride_assignments
  add column if not exists confirmation_status text not null default 'confirmed';
alter table public.ride_assignments
  drop constraint if exists ride_assignments_confirmation_status_check;
alter table public.ride_assignments
  add constraint ride_assignments_confirmation_status_check
  check (confirmation_status in (
    'confirmed', 'pending_reconfirm', 'released', 'cancelled'
  ));

alter table public.ride_assignments
  add column if not exists pending_change_summary text;

-- Allow history rows while only one active assignment per ride.
alter table public.ride_assignments
  drop constraint if exists ride_assignments_ride_request_id_key;

create unique index if not exists ride_assignments_one_active_per_ride
  on public.ride_assignments (ride_request_id)
  where confirmation_status in ('confirmed', 'pending_reconfirm');

-- Keep claim/accept race-safe against only *active* assignments.
create or replace function public.claim_private_ride(p_ride_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.ride_requests%rowtype;
  v_assignment_id uuid := gen_random_uuid();
  v_angel_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_request_id
  for update;

  if not found then
    raise exception 'ride_not_found';
  end if;
  if v_ride.rider_id = v_uid then
    raise exception 'cannot_claim_own_ride';
  end if;
  if v_ride.visibility <> 'private' then
    raise exception 'not_private_ride';
  end if;
  if v_ride.status not in ('private_requested', 'ride_needed') then
    raise exception 'ride_not_claimable';
  end if;
  if exists (
    select 1 from public.ride_assignments
    where ride_request_id = p_ride_request_id
      and confirmation_status in ('confirmed', 'pending_reconfirm')
  ) then
    raise exception 'ride_already_assigned';
  end if;
  if not public.is_active_private_angel(v_ride.rider_id, v_uid) then
    raise exception 'not_trusted_angel';
  end if;

  insert into public.ride_assignments (
    id, ride_request_id, angel_id, source, assigned_by_user_id, confirmation_status
  ) values (
    v_assignment_id, p_ride_request_id, v_uid, 'private_claim', v_uid, 'confirmed'
  );

  update public.ride_requests
  set status = 'ride_confirmed', updated_at = now()
  where id = p_ride_request_id;

  select display_name into v_angel_name from public.profiles where id = v_uid;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_ride.rider_id,
    'private_ride_confirmed',
    'Ride Claimed',
    coalesce(v_angel_name, 'A Ride Angel') || ' can drive you.',
    'ride_request',
    p_ride_request_id::text,
    v_ride.appointment_id,
    p_ride_request_id
  );

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'ride_request_id', p_ride_request_id
  );
end;
$$;

create or replace function public.accept_ride_offer(
  p_ride_request_id uuid,
  p_ride_offer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.ride_requests%rowtype;
  v_offer public.ride_offers%rowtype;
  v_assignment_id uuid := gen_random_uuid();
  v_rider_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_request_id
  for update;

  if not found then
    raise exception 'ride_not_found';
  end if;
  if v_ride.rider_id <> v_uid then
    raise exception 'not_ride_owner';
  end if;
  if exists (
    select 1 from public.ride_assignments
    where ride_request_id = p_ride_request_id
      and confirmation_status in ('confirmed', 'pending_reconfirm')
  ) then
    raise exception 'ride_already_assigned';
  end if;

  select * into v_offer
  from public.ride_offers
  where id = p_ride_offer_id
  for update;

  if not found then
    raise exception 'offer_not_found';
  end if;
  if v_offer.ride_request_id <> p_ride_request_id then
    raise exception 'offer_mismatch';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'offer_not_pending';
  end if;

  insert into public.ride_assignments (
    id, ride_request_id, angel_id, source, assigned_by_user_id, confirmation_status
  ) values (
    v_assignment_id, p_ride_request_id, v_offer.angel_id, 'public_offer', v_uid, 'confirmed'
  );

  update public.ride_offers
  set status = 'accepted'
  where id = p_ride_offer_id;

  update public.ride_offers
  set status = 'closed'
  where ride_request_id = p_ride_request_id
    and id <> p_ride_offer_id
    and status = 'pending';

  update public.ride_requests
  set status = 'ride_confirmed', updated_at = now()
  where id = p_ride_request_id;

  select display_name into v_rider_name from public.profiles where id = v_uid;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_offer.angel_id,
    'offer_accepted',
    'Offer Accepted',
    coalesce(v_rider_name, 'A rider') || ' accepted your ride offer.',
    'ride_request',
    p_ride_request_id::text,
    v_ride.appointment_id,
    p_ride_request_id
  );

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'ride_request_id', p_ride_request_id,
    'offer_id', p_ride_offer_id
  );
end;
$$;

-- —— Cancel appointment (soft) ——
create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_appt public.appointments%rowtype;
  v_ride public.ride_requests%rowtype;
  v_angel_id uuid;
  v_rider_name text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_appt
  from public.appointments
  where id = p_appointment_id
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
  where appointment_id = p_appointment_id
  order by created_at desc
  limit 1
  for update;

  if found then
    select a.angel_id into v_angel_id
    from public.ride_assignments a
    where a.ride_request_id = v_ride.id
      and a.confirmation_status in ('confirmed', 'pending_reconfirm')
    limit 1;

    if v_angel_id is not null and v_reason is null then
      raise exception 'cancellation_reason_required';
    end if;

    update public.appointments
    set
      status = 'cancelled',
      cancellation_reason = v_reason,
      cancelled_at = now(),
      updated_at = now()
    where id = p_appointment_id;

    update public.ride_requests
    set status = 'cancelled', updated_at = now()
    where id = v_ride.id;

    update public.ride_offers
    set status = 'closed'
    where ride_request_id = v_ride.id
      and status = 'pending';

    update public.ride_assignments
    set
      confirmation_status = 'cancelled',
      pending_change_summary = null
    where ride_request_id = v_ride.id
      and confirmation_status in ('confirmed', 'pending_reconfirm');

    if v_angel_id is not null then
      select display_name into v_rider_name from public.profiles where id = v_uid;
      insert into public.notifications (
        recipient_profile_id, type, title, body,
        related_entity_type, related_entity_id,
        related_appointment_id, related_ride_request_id
      ) values (
        v_angel_id,
        'rider_cancelled',
        'Ride Cancelled',
        coalesce(v_rider_name, 'A rider') || ' cancelled "' || v_appt.title || '". Reason: ' || v_reason,
        'appointment',
        p_appointment_id::text,
        p_appointment_id,
        v_ride.id
      );
    end if;
  else
    update public.appointments
    set
      status = 'cancelled',
      cancellation_reason = v_reason,
      cancelled_at = now(),
      updated_at = now()
    where id = p_appointment_id;
  end if;

  return jsonb_build_object(
    'appointment_id', p_appointment_id,
    'status', 'cancelled',
    'notified_angel_id', v_angel_id
  );
end;
$$;

revoke all on function public.cancel_appointment(uuid, text) from public;
grant execute on function public.cancel_appointment(uuid, text) to authenticated;

-- —— Update appointment (+ optional angel reconfirm) ——
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
    -- Keep open-request status aligned with visibility when unclaimed.
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

-- —— Angel confirms still driving after change ——
create or replace function public.confirm_assignment_after_change(p_ride_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.ride_requests%rowtype;
  v_assignment public.ride_assignments%rowtype;
  v_angel_name text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_request_id
  for update;

  if not found then
    raise exception 'ride_not_found';
  end if;

  select * into v_assignment
  from public.ride_assignments
  where ride_request_id = p_ride_request_id
    and confirmation_status = 'pending_reconfirm'
  for update;

  if not found then
    raise exception 'reconfirm_not_pending';
  end if;
  if v_assignment.angel_id <> v_uid then
    raise exception 'not_assigned_angel';
  end if;

  update public.ride_assignments
  set confirmation_status = 'confirmed', pending_change_summary = null
  where id = v_assignment.id;

  select display_name into v_angel_name from public.profiles where id = v_uid;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_ride.rider_id,
    'offer_accepted',
    'Ride Angel confirmed',
    coalesce(v_angel_name, 'Your Ride Angel') || ' can still drive after your trip update.',
    'ride_request',
    p_ride_request_id::text,
    v_ride.appointment_id,
    p_ride_request_id
  );

  return jsonb_build_object(
    'assignment_id', v_assignment.id,
    'confirmation_status', 'confirmed'
  );
end;
$$;

revoke all on function public.confirm_assignment_after_change(uuid) from public;
grant execute on function public.confirm_assignment_after_change(uuid) to authenticated;

-- —— Angel releases claim after change ——
create or replace function public.decline_assignment_after_change(p_ride_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.ride_requests%rowtype;
  v_assignment public.ride_assignments%rowtype;
  v_angel_name text;
  v_open_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_request_id
  for update;

  if not found then
    raise exception 'ride_not_found';
  end if;

  select * into v_assignment
  from public.ride_assignments
  where ride_request_id = p_ride_request_id
    and confirmation_status = 'pending_reconfirm'
  for update;

  if not found then
    raise exception 'reconfirm_not_pending';
  end if;
  if v_assignment.angel_id <> v_uid then
    raise exception 'not_assigned_angel';
  end if;

  update public.ride_assignments
  set confirmation_status = 'released', pending_change_summary = null
  where id = v_assignment.id;

  v_open_status := case
    when v_ride.visibility = 'public' then 'public_requested'
    else 'private_requested'
  end;

  update public.ride_requests
  set status = v_open_status, updated_at = now()
  where id = p_ride_request_id;

  select display_name into v_angel_name from public.profiles where id = v_uid;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_ride.rider_id,
    'angel_cancelled',
    'Ride needs a new Angel',
    coalesce(v_angel_name, 'Your Ride Angel') ||
      ' can no longer drive after the trip update. Your request is open again.',
    'ride_request',
    p_ride_request_id::text,
    v_ride.appointment_id,
    p_ride_request_id
  );

  return jsonb_build_object(
    'assignment_id', v_assignment.id,
    'confirmation_status', 'released',
    'ride_status', v_open_status
  );
end;
$$;

revoke all on function public.decline_assignment_after_change(uuid) from public;
grant execute on function public.decline_assignment_after_change(uuid) to authenticated;
