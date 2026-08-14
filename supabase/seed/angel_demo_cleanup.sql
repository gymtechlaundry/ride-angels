-- =============================================================================
-- Remove angel demo seed data created by angel_demo_seed.sql
-- Safe: only deletes fixed aaaaaaaa-bbbb-4ccc-8ddd-* rows (+ related auth users)
-- Does NOT delete the real angel profile a2a5abb5-d79c-430a-b7ba-f5d3dad1e282
--
-- Apply:
--   supabase db query --linked -f supabase/seed/angel_demo_cleanup.sql
-- =============================================================================

begin;

-- Domain rows first (FK order)
delete from public.ride_assignments
where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or ride_request_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%';

delete from public.ride_offers
where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or ride_request_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or angel_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%';

delete from public.ride_requests
where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or appointment_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or rider_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%';

delete from public.appointments
where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or rider_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%';

delete from public.ride_angel_connections
where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or rider_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or (
     angel_id = 'a2a5abb5-d79c-430a-b7ba-f5d3dad1e282'
     and rider_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   );

delete from public.notifications
where recipient_profile_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or related_ride_request_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%'
   or related_appointment_id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%';

-- Seed auth identities + users (cascade may also remove profiles)
delete from auth.identities
where user_id in (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000003'
);

delete from auth.users
where id in (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000003'
);

-- Profiles if any orphaned (auth delete usually cascades)
delete from public.profiles
where id in (
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000001',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000002',
  'aaaaaaaa-bbbb-4ccc-8ddd-000000000003'
);

commit;

select
  (select count(*) from public.profiles where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%') as remaining_seed_profiles,
  (select count(*) from public.ride_requests where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%') as remaining_seed_rides,
  (select count(*) from public.ride_angel_connections where id::text like 'aaaaaaaa-bbbb-4ccc-8ddd-%') as remaining_seed_connections;
