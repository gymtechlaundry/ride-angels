-- Atomic visibility toggle for ride requests (rider-owned).
-- Direct client UPDATEs were unreliable under RLS (success with 0 rows).

create or replace function public.set_ride_request_visibility(
  p_ride_request_id uuid,
  p_is_public boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.ride_requests%rowtype;
  v_visibility text;
  v_status text;
  v_has_assignment boolean;
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
    raise exception 'ride_not_editable';
  end if;

  v_visibility := case when p_is_public then 'public' else 'private' end;

  select exists (
    select 1 from public.ride_assignments a
    where a.ride_request_id = p_ride_request_id
  ) into v_has_assignment;

  if v_has_assignment then
    -- Keep confirmed/in-progress status; only flip board visibility.
    v_status := v_ride.status;
  elsif p_is_public then
    v_status := case
      when v_ride.status = 'offers_received' then 'offers_received'
      else 'public_requested'
    end;
  else
    v_status := 'private_requested';
  end if;

  update public.ride_requests
  set
    visibility = v_visibility,
    status = v_status,
    updated_at = now()
  where id = p_ride_request_id;

  -- Private board: close outstanding public offers so the board cannot act on them.
  if not p_is_public then
    update public.ride_offers
    set status = 'closed'
    where ride_request_id = p_ride_request_id
      and status = 'pending';
  end if;

  return jsonb_build_object(
    'ride_request_id', p_ride_request_id,
    'visibility', v_visibility,
    'status', v_status
  );
end;
$$;

revoke all on function public.set_ride_request_visibility(uuid, boolean) from public;
grant execute on function public.set_ride_request_visibility(uuid, boolean) to authenticated;

-- Tighten rider-owned updates: require WITH CHECK so PostgREST updates persist predictably.
drop policy if exists "ride_requests_update" on public.ride_requests;
create policy "ride_requests_update"
  on public.ride_requests for update to authenticated
  using (rider_id = auth.uid())
  with check (rider_id = auth.uid());
