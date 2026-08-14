-- Notification delete + private-circle ride offers (rider chooses among angels).

-- —— Allow recipients to delete their own notifications ——
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (recipient_profile_id = auth.uid());

-- —— Trusted angels can offer on private rides; rider accepts one ——
create or replace function public.submit_ride_offer(
  p_ride_request_id uuid,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.ride_requests%rowtype;
  v_offer_id uuid := gen_random_uuid();
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
    raise exception 'cannot_offer_own_ride';
  end if;

  if v_ride.visibility = 'public' then
    if v_ride.status not in ('public_requested', 'offers_received') then
      raise exception 'ride_not_open_for_offers';
    end if;
  elsif v_ride.visibility = 'private' then
    if not public.is_active_private_angel(v_ride.rider_id, v_uid) then
      raise exception 'not_trusted_angel';
    end if;
    if v_ride.status not in ('private_requested', 'offers_received', 'ride_needed') then
      raise exception 'ride_not_open_for_offers';
    end if;
  else
    raise exception 'ride_not_open_for_offers';
  end if;

  if exists (
    select 1 from public.ride_assignments
    where ride_request_id = p_ride_request_id
      and confirmation_status in ('confirmed', 'pending_reconfirm')
  ) then
    raise exception 'ride_already_assigned';
  end if;
  if exists (
    select 1 from public.ride_offers
    where ride_request_id = p_ride_request_id
      and angel_id = v_uid
      and status = 'pending'
  ) then
    raise exception 'offer_already_pending';
  end if;

  select display_name into v_angel_name from public.profiles where id = v_uid;

  insert into public.ride_offers (
    id, ride_request_id, angel_id, status, message, angel_display_name
  ) values (
    v_offer_id, p_ride_request_id, v_uid, 'pending',
    nullif(trim(coalesce(p_message, '')), ''),
    coalesce(v_angel_name, 'Ride Angel')
  );

  update public.ride_requests
  set status = 'offers_received', updated_at = now()
  where id = p_ride_request_id
    and status in ('public_requested', 'private_requested', 'ride_needed');

  insert into public.notifications (
    recipient_profile_id, type, title, body,
    related_entity_type, related_entity_id,
    related_appointment_id, related_ride_request_id
  ) values (
    v_ride.rider_id,
    'public_offer_received',
    'New Ride Offer',
    coalesce(v_angel_name, 'A Ride Angel') || ' offered to drive.',
    'ride_request',
    p_ride_request_id::text,
    v_ride.appointment_id,
    p_ride_request_id
  );

  return jsonb_build_object('offer_id', v_offer_id, 'ride_request_id', p_ride_request_id);
end;
$$;

revoke all on function public.submit_ride_offer(uuid, text) from public;
grant execute on function public.submit_ride_offer(uuid, text) to authenticated;
