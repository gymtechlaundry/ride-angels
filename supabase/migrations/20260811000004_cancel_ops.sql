-- Soft cancel helpers (status transitions, not hard deletes).

create or replace function public.cancel_ride_request(p_ride_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.ride_requests%rowtype;
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
  if v_ride.status in ('cancelled', 'ride_cancelled', 'completed') then
    raise exception 'ride_not_cancellable';
  end if;

  update public.ride_requests
  set status = 'cancelled', updated_at = now()
  where id = p_ride_request_id;

  update public.ride_offers
  set status = 'closed'
  where ride_request_id = p_ride_request_id
    and status = 'pending';

  update public.ride_assignments
  set assigned_at = assigned_at
  where ride_request_id = p_ride_request_id;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  )
  select
    a.angel_id,
    'ride_cancelled',
    'Ride Cancelled',
    'A rider cancelled a ride you were assigned to.',
    'ride_request',
    p_ride_request_id::text,
    v_ride.appointment_id,
    p_ride_request_id
  from public.ride_assignments a
  where a.ride_request_id = p_ride_request_id;

  return jsonb_build_object('ride_request_id', p_ride_request_id, 'status', 'cancelled');
end;
$$;

revoke all on function public.cancel_ride_request(uuid) from public;
grant execute on function public.cancel_ride_request(uuid) to authenticated;

create or replace function public.withdraw_ride_offer(p_ride_offer_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.ride_offers%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_offer
  from public.ride_offers
  where id = p_ride_offer_id
  for update;

  if not found then
    raise exception 'offer_not_found';
  end if;
  if v_offer.angel_id <> v_uid then
    raise exception 'not_offer_owner';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'offer_not_pending';
  end if;

  update public.ride_offers
  set status = 'withdrawn'
  where id = p_ride_offer_id;

  return jsonb_build_object('offer_id', p_ride_offer_id, 'status', 'withdrawn');
end;
$$;

revoke all on function public.withdraw_ride_offer(uuid) from public;
grant execute on function public.withdraw_ride_offer(uuid) to authenticated;
