-- =============================================================================
-- Cleanup for qa_trio_seed.sql (bbbbbbbb-cccc-4ddd-8eee-* only)
--
-- Apply:
--   supabase db query --linked -f supabase/seed/qa_trio_cleanup.sql
-- =============================================================================

begin;

delete from public.ride_assignments
where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or ride_request_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or angel_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%';

delete from public.ride_offers
where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or ride_request_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or angel_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%';

delete from public.ride_requests
where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or appointment_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or rider_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%';

delete from public.appointments
where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or rider_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%';

delete from public.ride_angel_connections
where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or rider_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or angel_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%';

delete from public.notifications
where recipient_profile_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or related_ride_request_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%'
   or related_appointment_id::text like 'bbbbbbbb-cccc-4ddd-8eee-%';

delete from auth.identities
where user_id in (
  'bbbbbbbb-cccc-4ddd-8eee-000000000001',
  'bbbbbbbb-cccc-4ddd-8eee-000000000002',
  'bbbbbbbb-cccc-4ddd-8eee-000000000003'
);

delete from auth.users
where id in (
  'bbbbbbbb-cccc-4ddd-8eee-000000000001',
  'bbbbbbbb-cccc-4ddd-8eee-000000000002',
  'bbbbbbbb-cccc-4ddd-8eee-000000000003'
);

delete from public.profiles
where id in (
  'bbbbbbbb-cccc-4ddd-8eee-000000000001',
  'bbbbbbbb-cccc-4ddd-8eee-000000000002',
  'bbbbbbbb-cccc-4ddd-8eee-000000000003'
);

commit;

select
  (select count(*) from public.profiles where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%') as remaining_qa_profiles,
  (select count(*) from public.ride_requests where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%') as remaining_qa_rides;
