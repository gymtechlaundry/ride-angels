-- V1 hardening: notifications, atomic ride ops, helpers, constraints.
-- Additive — safe after 00000_profiles + 00001_rides_domain.

-- —— Helpers ——
create or replace function public.current_profile_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'appointments_set_updated_at'
  ) then
    create trigger appointments_set_updated_at
      before update on public.appointments
      for each row execute function public.set_updated_at();
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ride_requests_set_updated_at'
  ) then
    create trigger ride_requests_set_updated_at
      before update on public.ride_requests
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Status / uniqueness hardening
alter table public.ride_requests
  drop constraint if exists ride_requests_status_check;
alter table public.ride_requests
  add constraint ride_requests_status_check
  check (status in (
    'draft', 'ride_needed', 'private_requested', 'public_requested',
    'offers_received', 'ride_confirmed', 'upcoming', 'in_progress',
    'completed', 'cancelled', 'ride_cancelled'
  ));

create unique index if not exists ride_offers_one_pending_per_angel
  on public.ride_offers (ride_request_id, angel_id)
  where status = 'pending';

create index if not exists appointments_rider_date_idx
  on public.appointments (rider_id, ride_date);

create index if not exists ride_requests_rider_status_idx
  on public.ride_requests (rider_id, status);

create index if not exists ride_requests_public_status_idx
  on public.ride_requests (visibility, status)
  where visibility = 'public';

create index if not exists ride_angel_connections_rider_status_idx
  on public.ride_angel_connections (rider_id, status);

create index if not exists ride_angel_connections_angel_status_idx
  on public.ride_angel_connections (angel_id, status);

-- Prevent self-connection
alter table public.ride_angel_connections
  drop constraint if exists ride_angel_connections_no_self;
alter table public.ride_angel_connections
  add constraint ride_angel_connections_no_self
  check (rider_id <> angel_id);

-- —— Notifications ——
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  related_entity_type text,
  related_entity_id text,
  related_appointment_id uuid references public.appointments (id) on delete set null,
  related_ride_request_id uuid references public.ride_requests (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_profile_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_profile_id, read_at)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (recipient_profile_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

-- Inserts come from SECURITY DEFINER RPCs / triggers, not clients.
drop policy if exists "notifications_insert_denied" on public.notifications;
create policy "notifications_insert_denied"
  on public.notifications for insert to authenticated
  with check (false);

-- —— Auth helpers ——
create or replace function public.is_active_private_angel(p_rider_id uuid, p_angel_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ride_angel_connections c
    where c.rider_id = p_rider_id
      and c.angel_id = p_angel_id
      and c.status = 'accepted'
  );
$$;

create or replace function public.is_ride_owner(p_ride_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.ride_requests r
    where r.id = p_ride_request_id and r.rider_id = auth.uid()
  );
$$;

-- —— Atomic: create appointment + ride ——
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select display_name into v_display from public.profiles where id = v_uid;
  v_status := case
    when v_visibility = 'public' then 'public_requested'
    else 'private_requested'
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

  return jsonb_build_object(
    'appointment_id', v_appt_id,
    'ride_request_id', v_ride_id
  );
end;
$$;

revoke all on function public.create_appointment_with_ride(jsonb) from public;
grant execute on function public.create_appointment_with_ride(jsonb) to authenticated;

-- —— Atomic: private claim ——
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
    select 1 from public.ride_assignments where ride_request_id = p_ride_request_id
  ) then
    raise exception 'ride_already_assigned';
  end if;
  if not public.is_active_private_angel(v_ride.rider_id, v_uid) then
    raise exception 'not_trusted_angel';
  end if;

  insert into public.ride_assignments (
    id, ride_request_id, angel_id, source, assigned_by_user_id
  ) values (
    v_assignment_id, p_ride_request_id, v_uid, 'private_claim', v_uid
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

revoke all on function public.claim_private_ride(uuid) from public;
grant execute on function public.claim_private_ride(uuid) to authenticated;

-- —— Atomic: accept public offer ——
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
    select 1 from public.ride_assignments where ride_request_id = p_ride_request_id
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
    id, ride_request_id, angel_id, source, assigned_by_user_id
  ) values (
    v_assignment_id, p_ride_request_id, v_offer.angel_id, 'public_offer', v_uid
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

revoke all on function public.accept_ride_offer(uuid, uuid) from public;
grant execute on function public.accept_ride_offer(uuid, uuid) to authenticated;

-- —— Submit public offer (validates + notifies) ——
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
  if v_ride.visibility <> 'public' then
    raise exception 'not_public_ride';
  end if;
  if v_ride.status not in ('public_requested', 'offers_received') then
    raise exception 'ride_not_open_for_offers';
  end if;
  if exists (
    select 1 from public.ride_assignments where ride_request_id = p_ride_request_id
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
    and status = 'public_requested';

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
