-- Assigned Ride Angels keep access after public→private visibility changes.
-- Visibility controls discovery only; assignment controls ongoing trip access.

create or replace function public.is_assigned_angel(
  p_ride_request_id uuid,
  p_angel_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ride_assignments a
    where a.ride_request_id = p_ride_request_id
      and a.angel_id = p_angel_id
  );
$$;

revoke all on function public.is_assigned_angel(uuid, uuid) from public;
grant execute on function public.is_assigned_angel(uuid, uuid) to authenticated;

drop policy if exists "ride_requests_select" on public.ride_requests;
create policy "ride_requests_select"
  on public.ride_requests for select to authenticated
  using (
    rider_id = auth.uid()
    or visibility = 'public'
    or public.is_assigned_angel(id, auth.uid())
    or exists (
      select 1 from public.ride_angel_connections c
      where c.rider_id = ride_requests.rider_id
        and c.angel_id = auth.uid()
        and c.status = 'accepted'
    )
  );

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
          or public.is_assigned_angel(r.id, auth.uid())
          or exists (
            select 1 from public.ride_angel_connections c
            where c.rider_id = r.rider_id
              and c.angel_id = auth.uid()
              and c.status = 'accepted'
          )
        )
    )
  );

-- Assigned angels can still resolve the rider's display profile after privatization.
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
    or exists (
      select 1
      from public.ride_assignments a
      join public.ride_requests r on r.id = a.ride_request_id
      where a.angel_id = auth.uid()
        and r.rider_id = profiles.id
    )
  );
