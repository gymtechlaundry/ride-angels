-- Scheduled ride reminders:
-- - Assigned angel: day-before + hour-before
-- - Unclaimed open ride: day-before to rider + accepted circle (no pending offer yet)
-- Inserts into notifications → existing push trigger.
-- Times treated as wall-clock in America/New_York (US V1 default).

create table if not exists public.ride_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  ride_request_id uuid not null references public.ride_requests (id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null
    check (kind in (
      'angel_day_before',
      'angel_hour_before',
      'unclaimed_day_before_rider',
      'unclaimed_day_before_angel'
    )),
  sent_at timestamptz not null default timezone('utc', now()),
  unique (ride_request_id, recipient_profile_id, kind)
);

create index if not exists ride_reminder_sends_ride_idx
  on public.ride_reminder_sends (ride_request_id);

alter table public.ride_reminder_sends enable row level security;

-- No client access — service / SECURITY DEFINER only.
drop policy if exists "ride_reminder_sends_deny_all" on public.ride_reminder_sends;
create policy "ride_reminder_sends_deny_all"
  on public.ride_reminder_sends for all to authenticated
  using (false)
  with check (false);

create or replace function public.dispatch_ride_reminders(
  p_timezone text default 'America/New_York'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text := coalesce(nullif(trim(p_timezone), ''), 'America/New_York');
  v_now timestamptz := timezone('utc', now());
  v_local_now timestamp := timezone(v_tz, v_now);
  v_tomorrow date := (v_local_now::date + 1);
  v_angel_day int := 0;
  v_angel_hour int := 0;
  v_unclaimed_rider int := 0;
  v_unclaimed_angel int := 0;
  r record;
  v_pickup timestamptz;
  v_when_label text;
  v_title text;
begin
  -- —— Assigned angel: day before (ride is tomorrow, local) ——
  for r in
    select
      rr.id as ride_id,
      rr.appointment_id,
      a.title,
      a.ride_date,
      a.ride_time,
      a.rider_id,
      ra.angel_id,
      coalesce(nullif(p.display_name, ''), 'your rider') as rider_name
    from public.ride_requests rr
    join public.appointments a on a.id = rr.appointment_id
    join public.ride_assignments ra on ra.ride_request_id = rr.id
    join public.profiles p on p.id = rr.rider_id
    where a.status = 'active'
      and rr.status in ('ride_confirmed', 'upcoming', 'in_progress')
      and coalesce(ra.confirmation_status, 'confirmed') in ('confirmed', 'pending_reconfirm')
      and a.ride_date = v_tomorrow
      and not exists (
        select 1 from public.ride_reminder_sends s
        where s.ride_request_id = rr.id
          and s.recipient_profile_id = ra.angel_id
          and s.kind = 'angel_day_before'
      )
  loop
    v_when_label := to_char(r.ride_time, 'HH12:MI AM');
    insert into public.notifications (
      recipient_profile_id, type, title, body,
      related_entity_type, related_entity_id,
      related_appointment_id, related_ride_request_id
    ) values (
      r.angel_id,
      'appointment_reminder',
      'Drive tomorrow',
      'You are driving '
        || r.rider_name
        || ' tomorrow at '
        || v_when_label
        || ' — '
        || coalesce(nullif(r.title, ''), 'appointment')
        || '.',
      'ride_request',
      r.ride_id::text,
      r.appointment_id,
      r.ride_id
    );
    insert into public.ride_reminder_sends (ride_request_id, recipient_profile_id, kind)
    values (r.ride_id, r.angel_id, 'angel_day_before');
    v_angel_day := v_angel_day + 1;
  end loop;

  -- —— Assigned angel: ~1 hour before pickup ——
  for r in
    select
      rr.id as ride_id,
      rr.appointment_id,
      a.title,
      a.ride_date,
      a.ride_time,
      ra.angel_id,
      coalesce(nullif(p.display_name, ''), 'your rider') as rider_name
    from public.ride_requests rr
    join public.appointments a on a.id = rr.appointment_id
    join public.ride_assignments ra on ra.ride_request_id = rr.id
    join public.profiles p on p.id = rr.rider_id
    where a.status = 'active'
      and rr.status in ('ride_confirmed', 'upcoming', 'in_progress')
      and coalesce(ra.confirmation_status, 'confirmed') in ('confirmed', 'pending_reconfirm')
      and not exists (
        select 1 from public.ride_reminder_sends s
        where s.ride_request_id = rr.id
          and s.recipient_profile_id = ra.angel_id
          and s.kind = 'angel_hour_before'
      )
  loop
    v_pickup := timezone(v_tz, (r.ride_date + r.ride_time));
    if v_pickup >= v_now + interval '50 minutes'
       and v_pickup < v_now + interval '70 minutes' then
      v_when_label := to_char(r.ride_time, 'HH12:MI AM');
      insert into public.notifications (
        recipient_profile_id, type, title, body,
        related_entity_type, related_entity_id,
        related_appointment_id, related_ride_request_id
      ) values (
        r.angel_id,
        'pickup_reminder',
        'Pickup in about an hour',
        'Drive '
          || r.rider_name
          || ' at '
          || v_when_label
          || ' — '
          || coalesce(nullif(r.title, ''), 'appointment')
          || '.',
        'ride_request',
        r.ride_id::text,
        r.appointment_id,
        r.ride_id
      );
      insert into public.ride_reminder_sends (ride_request_id, recipient_profile_id, kind)
      values (r.ride_id, r.angel_id, 'angel_hour_before');
      v_angel_hour := v_angel_hour + 1;
    end if;
  end loop;

  -- —— Unclaimed open rides: day before → rider ——
  for r in
    select
      rr.id as ride_id,
      rr.appointment_id,
      a.title,
      a.ride_time,
      a.rider_id
    from public.ride_requests rr
    join public.appointments a on a.id = rr.appointment_id
    where a.status = 'active'
      and rr.status in ('private_requested', 'public_requested', 'offers_received')
      and a.ride_date = v_tomorrow
      and not exists (
        select 1
        from public.ride_assignments ra
        where ra.ride_request_id = rr.id
          and coalesce(ra.confirmation_status, 'confirmed') in (
            'confirmed', 'pending_reconfirm'
          )
      )
      and not exists (
        select 1 from public.ride_reminder_sends s
        where s.ride_request_id = rr.id
          and s.recipient_profile_id = a.rider_id
          and s.kind = 'unclaimed_day_before_rider'
      )
  loop
    v_when_label := to_char(r.ride_time, 'HH12:MI AM');
    v_title := coalesce(nullif(r.title, ''), 'appointment');
    insert into public.notifications (
      recipient_profile_id, type, title, body,
      related_entity_type, related_entity_id,
      related_appointment_id, related_ride_request_id
    ) values (
      r.rider_id,
      'appointment_reminder',
      'Ride still needed',
      'Your '
        || v_title
        || ' tomorrow at '
        || v_when_label
        || ' still needs a Ride Angel.',
      'ride_request',
      r.ride_id::text,
      r.appointment_id,
      r.ride_id
    );
    insert into public.ride_reminder_sends (ride_request_id, recipient_profile_id, kind)
    values (r.ride_id, r.rider_id, 'unclaimed_day_before_rider');
    v_unclaimed_rider := v_unclaimed_rider + 1;
  end loop;

  -- —— Unclaimed open rides: day before → accepted circle (no pending offer) ——
  for r in
    select
      rr.id as ride_id,
      rr.appointment_id,
      a.title,
      a.ride_time,
      a.rider_id,
      c.angel_id,
      coalesce(nullif(p.display_name, ''), 'Someone in your circle') as rider_name
    from public.ride_requests rr
    join public.appointments a on a.id = rr.appointment_id
    join public.ride_angel_connections c
      on c.rider_id = a.rider_id
     and c.status = 'accepted'
    join public.profiles p on p.id = a.rider_id
    where a.status = 'active'
      and rr.status in ('private_requested', 'public_requested', 'offers_received')
      and a.ride_date = v_tomorrow
      and not exists (
        select 1
        from public.ride_assignments ra
        where ra.ride_request_id = rr.id
          and coalesce(ra.confirmation_status, 'confirmed') in (
            'confirmed', 'pending_reconfirm'
          )
      )
      and not exists (
        select 1
        from public.ride_offers o
        where o.ride_request_id = rr.id
          and o.angel_id = c.angel_id
          and o.status = 'pending'
      )
      and not exists (
        select 1 from public.ride_reminder_sends s
        where s.ride_request_id = rr.id
          and s.recipient_profile_id = c.angel_id
          and s.kind = 'unclaimed_day_before_angel'
      )
  loop
    v_when_label := to_char(r.ride_time, 'HH12:MI AM');
    v_title := coalesce(nullif(r.title, ''), 'appointment');
    insert into public.notifications (
      recipient_profile_id, type, title, body,
      related_entity_type, related_entity_id,
      related_appointment_id, related_ride_request_id
    ) values (
      r.angel_id,
      'appointment_reminder',
      'Ride still needed',
      r.rider_name
        || ' still needs a Ride Angel for '
        || v_title
        || ' tomorrow at '
        || v_when_label
        || '.',
      'ride_request',
      r.ride_id::text,
      r.appointment_id,
      r.ride_id
    );
    insert into public.ride_reminder_sends (ride_request_id, recipient_profile_id, kind)
    values (r.ride_id, r.angel_id, 'unclaimed_day_before_angel');
    v_unclaimed_angel := v_unclaimed_angel + 1;
  end loop;

  return jsonb_build_object(
    'timezone', v_tz,
    'local_date', v_local_now::date,
    'angel_day_before', v_angel_day,
    'angel_hour_before', v_angel_hour,
    'unclaimed_rider', v_unclaimed_rider,
    'unclaimed_angel', v_unclaimed_angel
  );
end;
$$;

comment on function public.dispatch_ride_reminders(text) is
  'Cron-friendly: day-before / hour-before drive reminders and unclaimed ride nudges.';

revoke all on function public.dispatch_ride_reminders(text) from public;
revoke all on function public.dispatch_ride_reminders(text) from authenticated;
grant execute on function public.dispatch_ride_reminders(text) to service_role;

-- Run every 15 minutes (Supabase includes pg_cron).
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1 from pg_extension where extname = 'pg_cron'
  ) then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'ride-angels-dispatch-reminders';

    perform cron.schedule(
      'ride-angels-dispatch-reminders',
      '*/15 * * * *',
      $cron$ select public.dispatch_ride_reminders(); $cron$
    );
  end if;
exception
  when others then
    raise notice 'pg_cron schedule skipped: %', sqlerrm;
end;
$$;
