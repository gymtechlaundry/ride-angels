-- Require a reason when an angel withdraws a pending offer; notify the rider.
-- If no other pending offers remain, reopen the ride as unclaimed.

alter table public.ride_offers
  add column if not exists withdrawal_reason text;

create or replace function public.withdraw_ride_offer(
  p_ride_offer_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.ride_offers%rowtype;
  v_ride public.ride_requests%rowtype;
  v_angel_name text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_pending_count integer := 0;
  v_open_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_reason is null then
    raise exception 'withdrawal_reason_required';
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

  select * into v_ride
  from public.ride_requests
  where id = v_offer.ride_request_id
  for update;

  if not found then
    raise exception 'ride_not_found';
  end if;

  update public.ride_offers
  set
    status = 'withdrawn',
    withdrawal_reason = v_reason
  where id = p_ride_offer_id;

  select count(*)::integer into v_pending_count
  from public.ride_offers
  where ride_request_id = v_offer.ride_request_id
    and status = 'pending';

  -- Last pending offer removed → back to open/unclaimed (not offers_received).
  if v_pending_count = 0 and v_ride.status = 'offers_received' then
    v_open_status := case
      when v_ride.visibility = 'public' then 'public_requested'
      else 'private_requested'
    end;

    update public.ride_requests
    set status = v_open_status, updated_at = now()
    where id = v_offer.ride_request_id;

    v_ride.status := v_open_status;
  end if;

  select display_name into v_angel_name from public.profiles where id = v_uid;

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_ride.rider_id,
    'offer_withdrawn',
    'Offer withdrawn',
    coalesce(v_angel_name, 'A Ride Angel') ||
      ' withdrew their offer. Reason: ' || v_reason,
    'ride_offer',
    p_ride_offer_id::text,
    v_ride.appointment_id,
    v_offer.ride_request_id
  );

  return jsonb_build_object(
    'offer_id', p_ride_offer_id,
    'status', 'withdrawn',
    'ride_status', v_ride.status,
    'pending_offers_remaining', v_pending_count
  );
end;
$$;

-- Old single-arg overload may not exist on all environments.
drop function if exists public.withdraw_ride_offer(uuid);

revoke all on function public.withdraw_ride_offer(uuid, text) from public;
grant execute on function public.withdraw_ride_offer(uuid, text) to authenticated;
