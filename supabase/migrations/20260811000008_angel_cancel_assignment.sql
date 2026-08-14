-- Angel can release a claimed ride with a reason; rider is notified and request reopens.

create or replace function public.cancel_assignment_by_angel(
  p_ride_request_id uuid,
  p_reason text
)
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
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_open_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_reason is null then
    raise exception 'cancellation_reason_required';
  end if;

  select * into v_ride
  from public.ride_requests
  where id = p_ride_request_id
  for update;

  if not found then
    raise exception 'ride_not_found';
  end if;
  if v_ride.status in ('cancelled', 'ride_cancelled', 'completed') then
    raise exception 'ride_not_cancellable';
  end if;

  select * into v_assignment
  from public.ride_assignments
  where ride_request_id = p_ride_request_id
    and confirmation_status in ('confirmed', 'pending_reconfirm')
  for update;

  if not found then
    raise exception 'assignment_not_found';
  end if;
  if v_assignment.angel_id <> v_uid then
    raise exception 'not_assigned_angel';
  end if;

  update public.ride_assignments
  set
    confirmation_status = 'released',
    pending_change_summary = null
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
    'Ride Angel cancelled',
    coalesce(v_angel_name, 'Your Ride Angel') ||
      ' can no longer drive this trip. Reason: ' || v_reason ||
      ' Your request is open again.',
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

revoke all on function public.cancel_assignment_by_angel(uuid, text) from public;
grant execute on function public.cancel_assignment_by_angel(uuid, text) to authenticated;
