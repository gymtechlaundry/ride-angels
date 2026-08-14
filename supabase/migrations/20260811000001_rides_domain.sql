-- Ride Angels Phase 2a: appointments, rides, offers, trusted circle.
-- Run AFTER 20260811000000_profiles.sql
-- Profile id / rider_id / angel_id = auth.users.id (uuid).

-- —— Appointments ——
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  created_by_user_id uuid references public.profiles (id),
  title text not null,
  ride_date date not null,
  ride_time time not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_rider_id_idx on public.appointments (rider_id);

-- —— Ride requests ——
create table if not exists public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  rider_id uuid not null references public.profiles (id) on delete cascade,
  created_by_user_id uuid references public.profiles (id),
  pickup_label text not null,
  pickup_line1 text not null,
  destination_label text not null,
  destination_line1 text not null,
  return_needed boolean not null default false,
  return_pickup_time time,
  visibility text not null check (visibility in ('private', 'public', 'none')),
  status text not null,
  rider_display_name text not null default 'Rider',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ride_requests_rider_id_idx on public.ride_requests (rider_id);
create index if not exists ride_requests_visibility_idx on public.ride_requests (visibility);
create index if not exists ride_requests_appointment_id_idx on public.ride_requests (appointment_id);

-- —— Assignments ——
create table if not exists public.ride_assignments (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null unique references public.ride_requests (id) on delete cascade,
  angel_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('private_claim', 'public_offer')),
  assigned_at timestamptz not null default now(),
  assigned_by_user_id uuid references public.profiles (id)
);

-- —— Offers ——
create table if not exists public.ride_offers (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests (id) on delete cascade,
  angel_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'closed')),
  message text,
  angel_display_name text not null default 'Ride Angel',
  created_at timestamptz not null default now()
);

create index if not exists ride_offers_ride_request_id_idx on public.ride_offers (ride_request_id);
create index if not exists ride_offers_angel_id_idx on public.ride_offers (angel_id);

-- —— Trusted circle ——
create table if not exists public.ride_angel_connections (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.profiles (id) on delete cascade,
  angel_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'removed')),
  relationship_label text not null default 'Trusted contact',
  rider_display_name text not null default 'Rider',
  angel_display_name text not null default 'Ride Angel',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (rider_id, angel_id)
);

create index if not exists ride_angel_connections_rider_id_idx on public.ride_angel_connections (rider_id);
create index if not exists ride_angel_connections_angel_id_idx on public.ride_angel_connections (angel_id);

-- —— Invite lookup (exact email or E.164 phone only) ——
create or replace function public.find_profile_for_invite(identifier text)
returns table (
  id uuid,
  auth_user_id uuid,
  display_name text,
  email text,
  phone text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(identifier));
begin
  if normalized is null or normalized = '' then
    return;
  end if;

  return query
  select p.id, p.auth_user_id, p.display_name, p.email, p.phone
  from public.profiles p
  where p.onboarding_completed = true
    and (
      (p.email is not null and lower(p.email) = normalized)
      or (p.phone is not null and p.phone = trim(identifier))
    )
  limit 1;
end;
$$;

revoke all on function public.find_profile_for_invite(text) from public;
grant execute on function public.find_profile_for_invite(text) to authenticated;

-- —— Related profile reads (circle + public board riders) ——
drop policy if exists "profiles_select_related" on public.profiles;
create policy "profiles_select_related"
  on public.profiles
  for select
  to authenticated
  using (
    auth.uid() = auth_user_id
    or exists (
      select 1 from public.ride_angel_connections c
      where c.status in ('pending', 'accepted')
        and (
          (c.rider_id = auth.uid() and c.angel_id = profiles.id)
          or (c.angel_id = auth.uid() and c.rider_id = profiles.id)
        )
    )
    or exists (
      select 1 from public.ride_requests r
      where r.rider_id = profiles.id
        and r.visibility = 'public'
        and r.status in ('public_requested', 'offers_received')
    )
  );

-- —— RLS: appointments ——
alter table public.appointments enable row level security;

drop policy if exists "appointments_select" on public.appointments;
create policy "appointments_select"
  on public.appointments for select to authenticated
  using (
    rider_id = auth.uid()
    or exists (
      select 1 from public.ride_requests r
      where r.appointment_id = appointments.id
        and (
          r.visibility = 'public'
          or exists (
            select 1 from public.ride_angel_connections c
            where c.rider_id = r.rider_id
              and c.angel_id = auth.uid()
              and c.status = 'accepted'
          )
        )
    )
  );

drop policy if exists "appointments_insert" on public.appointments;
create policy "appointments_insert"
  on public.appointments for insert to authenticated
  with check (rider_id = auth.uid());

drop policy if exists "appointments_update" on public.appointments;
create policy "appointments_update"
  on public.appointments for update to authenticated
  using (rider_id = auth.uid());

-- —— RLS: ride_requests ——
alter table public.ride_requests enable row level security;

drop policy if exists "ride_requests_select" on public.ride_requests;
create policy "ride_requests_select"
  on public.ride_requests for select to authenticated
  using (
    rider_id = auth.uid()
    or visibility = 'public'
    or exists (
      select 1 from public.ride_angel_connections c
      where c.rider_id = ride_requests.rider_id
        and c.angel_id = auth.uid()
        and c.status = 'accepted'
    )
  );

drop policy if exists "ride_requests_insert" on public.ride_requests;
create policy "ride_requests_insert"
  on public.ride_requests for insert to authenticated
  with check (rider_id = auth.uid());

drop policy if exists "ride_requests_update" on public.ride_requests;
create policy "ride_requests_update"
  on public.ride_requests for update to authenticated
  using (
    rider_id = auth.uid()
    or exists (
      select 1 from public.ride_offers o
      where o.ride_request_id = ride_requests.id and o.angel_id = auth.uid()
    )
    or exists (
      select 1 from public.ride_assignments a
      where a.ride_request_id = ride_requests.id and a.angel_id = auth.uid()
    )
  );

-- —— RLS: assignments ——
alter table public.ride_assignments enable row level security;

drop policy if exists "ride_assignments_select" on public.ride_assignments;
create policy "ride_assignments_select"
  on public.ride_assignments for select to authenticated
  using (
    angel_id = auth.uid()
    or exists (
      select 1 from public.ride_requests r
      where r.id = ride_assignments.ride_request_id and r.rider_id = auth.uid()
    )
  );

drop policy if exists "ride_assignments_insert" on public.ride_assignments;
create policy "ride_assignments_insert"
  on public.ride_assignments for insert to authenticated
  with check (angel_id = auth.uid());

-- —— RLS: offers ——
alter table public.ride_offers enable row level security;

drop policy if exists "ride_offers_select" on public.ride_offers;
create policy "ride_offers_select"
  on public.ride_offers for select to authenticated
  using (
    angel_id = auth.uid()
    or exists (
      select 1 from public.ride_requests r
      where r.id = ride_offers.ride_request_id and r.rider_id = auth.uid()
    )
  );

drop policy if exists "ride_offers_insert" on public.ride_offers;
create policy "ride_offers_insert"
  on public.ride_offers for insert to authenticated
  with check (
    angel_id = auth.uid()
    and angel_id <> (
      select r.rider_id from public.ride_requests r where r.id = ride_request_id
    )
  );

drop policy if exists "ride_offers_update" on public.ride_offers;
create policy "ride_offers_update"
  on public.ride_offers for update to authenticated
  using (
    angel_id = auth.uid()
    or exists (
      select 1 from public.ride_requests r
      where r.id = ride_offers.ride_request_id and r.rider_id = auth.uid()
    )
  );

-- —— RLS: connections ——
alter table public.ride_angel_connections enable row level security;

drop policy if exists "connections_select" on public.ride_angel_connections;
create policy "connections_select"
  on public.ride_angel_connections for select to authenticated
  using (rider_id = auth.uid() or angel_id = auth.uid());

drop policy if exists "connections_insert" on public.ride_angel_connections;
create policy "connections_insert"
  on public.ride_angel_connections for insert to authenticated
  with check (rider_id = auth.uid() and angel_id <> auth.uid());

drop policy if exists "connections_update" on public.ride_angel_connections;
create policy "connections_update"
  on public.ride_angel_connections for update to authenticated
  using (rider_id = auth.uid() or angel_id = auth.uid());
