-- =============================================================================
-- Angel demo seed data for UI testing
-- Target angel profile: a2a5abb5-d79c-430a-b7ba-f5d3dad1e282
--
-- Apply:
--   supabase db query --linked -f supabase/seed/angel_demo_seed.sql
-- Cleanup:
--   supabase db query --linked -f supabase/seed/angel_demo_cleanup.sql
--
-- All seeded rows use fixed UUIDs under the aaaaaaaa-bbbb-4ccc-8ddd-* namespace
-- so cleanup is precise and safe.
-- =============================================================================

begin;

-- Target angel (must already exist as a real signed-in user)
do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = 'a2a5abb5-d79c-430a-b7ba-f5d3dad1e282'
  ) then
    raise exception 'Angel profile a2a5abb5-d79c-430a-b7ba-f5d3dad1e282 not found. Sign in once first.';
  end if;
end $$;

-- Ensure angel has rideAngel capability for persona switching
update public.profiles
set
  roles = (
    select array(
      select distinct unnest(
        coalesce(roles, '{}'::text[]) || array['rider', 'rideAngel']
      )
    )
  ),
  default_persona = coalesce(default_persona, 'angel'),
  onboarding_completed = true,
  updated_at = now()
where id = 'a2a5abb5-d79c-430a-b7ba-f5d3dad1e282';

-- —— Fake riders (auth.users → trigger creates profiles) ——
-- Rider 1: Eleanor (trusted circle)
-- Rider 2: Marcus (trusted circle)
-- Rider 3: Priya (community / public board only)

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'authenticated',
    'authenticated',
    'seed+eleanor@rideangels.demo',
    crypt('SeedDemo!123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Eleanor Seed"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'authenticated',
    'authenticated',
    'seed+marcus@rideangels.demo',
    crypt('SeedDemo!123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Marcus Seed"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    'authenticated',
    'authenticated',
    'seed+priya@rideangels.demo',
    crypt('SeedDemo!123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Priya Seed"}'::jsonb,
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
on conflict (id) do nothing;

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    format('{"sub":"%s","email":"seed+eleanor@rideangels.demo"}', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001')::jsonb,
    'email',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    now(),
    now(),
    now()
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    format('{"sub":"%s","email":"seed+marcus@rideangels.demo"}', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002')::jsonb,
    'email',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    now(),
    now(),
    now()
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    format('{"sub":"%s","email":"seed+priya@rideangels.demo"}', 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003')::jsonb,
    'email',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    now(),
    now(),
    now()
  )
on conflict do nothing;

-- Fill profile display fields (trigger already created rows)
update public.profiles
set
  first_name = 'Eleanor',
  last_name = 'Seed',
  display_name = 'Eleanor Seed',
  email = 'seed+eleanor@rideangels.demo',
  roles = array['rider'],
  onboarding_completed = true,
  updated_at = now()
where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001';

update public.profiles
set
  first_name = 'Marcus',
  last_name = 'Seed',
  display_name = 'Marcus Seed',
  email = 'seed+marcus@rideangels.demo',
  roles = array['rider'],
  onboarding_completed = true,
  updated_at = now()
where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002';

update public.profiles
set
  first_name = 'Priya',
  last_name = 'Seed',
  display_name = 'Priya Seed',
  email = 'seed+priya@rideangels.demo',
  roles = array['rider'],
  onboarding_completed = true,
  updated_at = now()
where id = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003';

-- —— Trusted circle: Eleanor + Marcus → angel ——
insert into public.ride_angel_connections (
  id, rider_id, angel_id, status, relationship_label,
  rider_display_name, angel_display_name, invited_at, accepted_at
)
values
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-100000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'a2a5abb5-d79c-430a-b7ba-f5d3dad1e282',
    'accepted',
    'Neighbor',
    'Eleanor Seed',
    'You',
    now() - interval '14 days',
    now() - interval '13 days'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-100000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'a2a5abb5-d79c-430a-b7ba-f5d3dad1e282',
    'accepted',
    'Friend',
    'Marcus Seed',
    'You',
    now() - interval '10 days',
    now() - interval '9 days'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-100000000003',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    'a2a5abb5-d79c-430a-b7ba-f5d3dad1e282',
    'pending',
    'Trusted contact',
    'Priya Seed',
    'You',
    now() - interval '1 day',
    null
  )
on conflict (rider_id, angel_id) do update
set
  status = excluded.status,
  relationship_label = excluded.relationship_label,
  accepted_at = excluded.accepted_at;

-- —— Appointments + ride requests ——
-- A1 Eleanor private open (Requests / Trusted)
-- A2 Marcus private confirmed to angel (Home upcoming drives)
-- A3 Priya public open (Requests / Community)
-- A4 Eleanor private open tomorrow (Requests)
-- A5 Marcus public open (Requests / Community)

insert into public.appointments (
  id, rider_id, created_by_user_id, title, ride_date, ride_time, notes, status
)
values
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'Oncology follow-up',
    (current_date + 2),
    '10:30',
    'Seed data — private circle request',
    'active'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'Physical therapy',
    (current_date + 1),
    '14:00',
    'Seed data — confirmed drive for angel home',
    'active'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000003',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    'Lab work at Memorial',
    (current_date + 3),
    '09:15',
    'Seed data — community board request',
    'active'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000004',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'Pharmacy pickup',
    (current_date + 4),
    '16:45',
    'Seed data — another trusted request',
    'active'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000005',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'Eye doctor visit',
    (current_date + 5),
    '11:00',
    'Seed data — Marcus public board',
    'active'
  )
on conflict (id) do update
set
  title = excluded.title,
  ride_date = excluded.ride_date,
  ride_time = excluded.ride_time,
  notes = excluded.notes,
  status = 'active',
  updated_at = now();

insert into public.ride_requests (
  id, appointment_id, rider_id, created_by_user_id,
  pickup_label, pickup_line1, destination_label, destination_line1,
  return_needed, return_pickup_time, visibility, status, rider_display_name
)
values
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-300000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'Home',
    '412 Oak Street',
    'Coastal Cancer Center',
    '900 Medical Parkway',
    true,
    '12:30',
    'private',
    'private_requested',
    'Eleanor Seed'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-300000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'Home',
    '88 Harbor Lane',
    'Restore PT Clinic',
    '210 Wellness Blvd',
    false,
    null,
    'private',
    'ride_confirmed',
    'Marcus Seed'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-300000000003',
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000003',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000003',
    'Apartment lobby',
    '55 River Road #4B',
    'Memorial Labs',
    '1200 Hospital Drive',
    false,
    null,
    'public',
    'public_requested',
    'Priya Seed'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-300000000004',
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000004',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
    'Home',
    '412 Oak Street',
    'Neighborhood Pharmacy',
    '15 Main Street',
    false,
    null,
    'private',
    'private_requested',
    'Eleanor Seed'
  ),
  (
    'aaaaaaaa-bbbb-4ccc-8ddd-300000000005',
    'aaaaaaaa-bbbb-4ccc-8ddd-200000000005',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
    'Work',
    '300 Commerce Plaza',
    'Clear Vision Optometry',
    '44 Market Street',
    true,
    '12:15',
    'public',
    'public_requested',
    'Marcus Seed'
  )
on conflict (id) do update
set
  pickup_label = excluded.pickup_label,
  pickup_line1 = excluded.pickup_line1,
  destination_label = excluded.destination_label,
  destination_line1 = excluded.destination_line1,
  return_needed = excluded.return_needed,
  return_pickup_time = excluded.return_pickup_time,
  visibility = excluded.visibility,
  status = excluded.status,
  rider_display_name = excluded.rider_display_name,
  updated_at = now();

-- Confirmed assignment for Marcus PT (shows on angel Home)
insert into public.ride_assignments (
  id, ride_request_id, angel_id, source, assigned_by_user_id, confirmation_status
)
values (
  'aaaaaaaa-bbbb-4ccc-8ddd-400000000001',
  'aaaaaaaa-bbbb-4ccc-8ddd-300000000002',
  'a2a5abb5-d79c-430a-b7ba-f5d3dad1e282',
  'private_claim',
  'a2a5abb5-d79c-430a-b7ba-f5d3dad1e282',
  'confirmed'
)
on conflict (id) do update
set
  angel_id = excluded.angel_id,
  confirmation_status = 'confirmed',
  pending_change_summary = null;

commit;

-- Quick sanity counts
select
  (select count(*) from public.profiles where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%') as seed_profiles,
  (select count(*) from public.ride_requests where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%') as seed_rides,
  (select count(*) from public.ride_angel_connections where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%') as seed_connections;
