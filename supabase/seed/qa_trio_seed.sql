-- =============================================================================
-- QA trio seed — three switchable personas with ~3 months of ride mix
--
-- Users (sign in with phone + test OTP 123456 — see setup below):
--   1) Riley Rider   +15555550101  persona=rider  roles=[rider]
--   2) Avery Angel   +15555550102  persona=angel  roles=[rideAngel]
--   3) Blake Both    +15555550103  persona=rider  roles=[rider,rideAngel]
--
-- Fixed OTP setup (hosted Supabase Dashboard):
--   Authentication → Providers → Phone → Test phone numbers
--     +15555550101 → 123456
--     +15555550102 → 123456
--     +15555550103 → 123456
--
-- UUID namespace: bbbbbbbb-cccc-4ddd-8eee-*  (separate from angel_demo seed)
--
-- Apply:
--   supabase db query --linked -f supabase/seed/qa_trio_seed.sql
-- Cleanup:
--   supabase db query --linked -f supabase/seed/qa_trio_cleanup.sql
-- =============================================================================

begin;

-- —— Auth users (phone-confirmed so OTP sign-in works once test OTP is set) ——
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
    phone,
    phone_confirmed_at,
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
      'bbbbbbbb-cccc-4ddd-8eee-000000000001',
      'authenticated',
      'authenticated',
      'qa+rider@rideangels.demo',
      crypt('unused-otp-only', gen_salt('bf')),
      now(),
      '15555550101',
      now(),
      '{"provider":"phone","providers":["phone"]}'::jsonb,
      '{"full_name":"Riley Rider"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      'bbbbbbbb-cccc-4ddd-8eee-000000000002',
      'authenticated',
      'authenticated',
      'qa+angel@rideangels.demo',
      crypt('unused-otp-only', gen_salt('bf')),
      now(),
      '15555550102',
      now(),
      '{"provider":"phone","providers":["phone"]}'::jsonb,
      '{"full_name":"Avery Angel"}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      'bbbbbbbb-cccc-4ddd-8eee-000000000003',
      'authenticated',
      'authenticated',
      'qa+both@rideangels.demo',
      crypt('unused-otp-only', gen_salt('bf')),
      now(),
      '15555550103',
      now(),
      '{"provider":"phone","providers":["phone"]}'::jsonb,
      '{"full_name":"Blake Both"}'::jsonb,
      now(), now(), '', '', '', ''
    )
on conflict (id) do update
set
  phone = excluded.phone,
  phone_confirmed_at = excluded.phone_confirmed_at,
  email = excluded.email,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
values
  (
    'bbbbbbbb-cccc-4ddd-8eee-000000000001',
    'bbbbbbbb-cccc-4ddd-8eee-000000000001',
    format(
      '{"sub":"%s","phone":"15555550101"}',
      'bbbbbbbb-cccc-4ddd-8eee-000000000001'
    )::jsonb,
    'phone',
    '15555550101',
    now(), now(), now()
  ),
  (
    'bbbbbbbb-cccc-4ddd-8eee-000000000002',
    'bbbbbbbb-cccc-4ddd-8eee-000000000002',
    format(
      '{"sub":"%s","phone":"15555550102"}',
      'bbbbbbbb-cccc-4ddd-8eee-000000000002'
    )::jsonb,
    'phone',
    '15555550102',
    now(), now(), now()
  ),
  (
    'bbbbbbbb-cccc-4ddd-8eee-000000000003',
    'bbbbbbbb-cccc-4ddd-8eee-000000000003',
    format(
      '{"sub":"%s","phone":"15555550103"}',
      'bbbbbbbb-cccc-4ddd-8eee-000000000003'
    )::jsonb,
    'phone',
    '15555550103',
    now(), now(), now()
  )
on conflict do nothing;

-- Profiles (trigger may have created empty rows)
update public.profiles
set
  first_name = 'Riley',
  last_name = 'Rider',
  display_name = 'Riley Rider',
  email = 'qa+rider@rideangels.demo',
  phone = '+15555550101',
  roles = array['rider'],
  default_persona = 'rider',
  onboarding_completed = true,
  updated_at = now()
where id = 'bbbbbbbb-cccc-4ddd-8eee-000000000001';

update public.profiles
set
  first_name = 'Avery',
  last_name = 'Angel',
  display_name = 'Avery Angel',
  email = 'qa+angel@rideangels.demo',
  phone = '+15555550102',
  roles = array['rideAngel'],
  default_persona = 'angel',
  onboarding_completed = true,
  updated_at = now()
where id = 'bbbbbbbb-cccc-4ddd-8eee-000000000002';

update public.profiles
set
  first_name = 'Blake',
  last_name = 'Both',
  display_name = 'Blake Both',
  email = 'qa+both@rideangels.demo',
  phone = '+15555550103',
  roles = array['rider', 'rideAngel'],
  default_persona = 'rider',
  onboarding_completed = true,
  updated_at = now()
where id = 'bbbbbbbb-cccc-4ddd-8eee-000000000003';

-- —— Trusted circles ——
-- Avery (angel) supports Riley + Blake as riders
-- Blake (both) also supports Riley so dual-angel claim paths exist
insert into public.ride_angel_connections (
  id, rider_id, angel_id, status, relationship_label,
  rider_display_name, angel_display_name, invited_at, accepted_at
)
values
  (
    'bbbbbbbb-cccc-4ddd-8eee-100000000001',
    'bbbbbbbb-cccc-4ddd-8eee-000000000001',
    'bbbbbbbb-cccc-4ddd-8eee-000000000002',
    'accepted', 'Neighbor', 'Riley Rider', 'Avery Angel',
    now() - interval '60 days', now() - interval '59 days'
  ),
  (
    'bbbbbbbb-cccc-4ddd-8eee-100000000002',
    'bbbbbbbb-cccc-4ddd-8eee-000000000003',
    'bbbbbbbb-cccc-4ddd-8eee-000000000002',
    'accepted', 'Friend', 'Blake Both', 'Avery Angel',
    now() - interval '45 days', now() - interval '44 days'
  ),
  (
    'bbbbbbbb-cccc-4ddd-8eee-100000000003',
    'bbbbbbbb-cccc-4ddd-8eee-000000000001',
    'bbbbbbbb-cccc-4ddd-8eee-000000000003',
    'accepted', 'Family', 'Riley Rider', 'Blake Both',
    now() - interval '30 days', now() - interval '29 days'
  )
on conflict (rider_id, angel_id) do update
set
  status = 'accepted',
  accepted_at = coalesce(public.ride_angel_connections.accepted_at, excluded.accepted_at),
  relationship_label = excluded.relationship_label;

-- —— Appointments (past / near / sparse future) ——
-- Dispersion strategy:
--   Past (completed history): -60d, -30d, -7d
--   Active QA window (next ~14d): dense claimed + unclaimed
--   Sparse horizon (to +90d): calendar month scroll coverage
insert into public.appointments (
  id, rider_id, created_by_user_id, title, ride_date, ride_time, notes, status
)
values
  -- Past
  ('bbbbbbbb-cccc-4ddd-8eee-200000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Past oncology (claimed by Avery)', current_date - 60, '10:00', 'QA past · Avery claimed', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000002', 'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Past PT (Blake rider · Avery drove)', current_date - 30, '14:30', 'QA past · dual persona rider', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Past pharmacy (Blake claimed)', current_date - 7, '16:00', 'QA past · Blake as angel', 'active'),

  -- Near-term active QA
  ('bbbbbbbb-cccc-4ddd-8eee-200000000011', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Riley private OPEN (Avery/Blake can claim)', current_date + 1, '09:30', 'QA open private', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000012', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Riley private CLAIMED by Avery', current_date + 2, '11:00', 'QA claimed Avery', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000013', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Riley private CLAIMED by Blake', current_date + 3, '13:15', 'QA claimed Blake angel', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000014', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Riley public OPEN (community)', current_date + 4, '10:45', 'QA open public', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000015', 'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Blake rider OPEN private (Avery claim)', current_date + 5, '15:00', 'QA Blake-as-rider open', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000016', 'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Blake rider CLAIMED by Avery', current_date + 6, '08:45', 'QA Blake-as-rider claimed', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000017', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Riley public with pending offer (Avery)', current_date + 8, '12:00', 'QA offer pending', 'active'),

  -- Sparse horizon for calendar months
  ('bbbbbbbb-cccc-4ddd-8eee-200000000021', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Riley +21d open private', current_date + 21, '09:00', 'QA horizon', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000022', 'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Blake +35d claimed Avery', current_date + 35, '14:00', 'QA horizon', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000023', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Riley +55d public open', current_date + 55, '11:30', 'QA horizon', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000024', 'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Riley +75d claimed Blake', current_date + 75, '16:20', 'QA horizon', 'active'),
  ('bbbbbbbb-cccc-4ddd-8eee-200000000025', 'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Blake +90d open private', current_date + 90, '10:10', 'QA horizon', 'active')
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
  -- Past (completed-ish statuses for history surfaces)
  ('bbbbbbbb-cccc-4ddd-8eee-300000000001', 'bbbbbbbb-cccc-4ddd-8eee-200000000001',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Coastal Cancer Center', '900 Medical Parkway',
   true, '12:00', 'private', 'completed', 'Riley Rider'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000002', 'bbbbbbbb-cccc-4ddd-8eee-200000000002',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Home', '220 Cedar Ct', 'Restore PT', '210 Wellness Blvd',
   false, null, 'private', 'completed', 'Blake Both'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000003', 'bbbbbbbb-cccc-4ddd-8eee-200000000003',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Neighborhood Pharmacy', '15 Main Street',
   false, null, 'private', 'completed', 'Riley Rider'),

  -- Near-term
  ('bbbbbbbb-cccc-4ddd-8eee-300000000011', 'bbbbbbbb-cccc-4ddd-8eee-200000000011',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Primary Care', '50 Clinic Way',
   false, null, 'private', 'private_requested', 'Riley Rider'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000012', 'bbbbbbbb-cccc-4ddd-8eee-200000000012',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Dental Group', '18 Smile Lane',
   true, '13:00', 'private', 'ride_confirmed', 'Riley Rider'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000013', 'bbbbbbbb-cccc-4ddd-8eee-200000000013',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Imaging Center', '77 Scan Blvd',
   false, null, 'private', 'ride_confirmed', 'Riley Rider'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000014', 'bbbbbbbb-cccc-4ddd-8eee-200000000014',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Community Labs', '1200 Hospital Drive',
   false, null, 'public', 'public_requested', 'Riley Rider'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000015', 'bbbbbbbb-cccc-4ddd-8eee-200000000015',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Home', '220 Cedar Ct', 'Eye Clinic', '44 Market Street',
   false, null, 'private', 'private_requested', 'Blake Both'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000016', 'bbbbbbbb-cccc-4ddd-8eee-200000000016',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Home', '220 Cedar Ct', 'Cardio Follow-up', '5 Heart Road',
   true, '11:15', 'private', 'ride_confirmed', 'Blake Both'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000017', 'bbbbbbbb-cccc-4ddd-8eee-200000000017',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Work', '300 Commerce Plaza', 'Urgent Care', '9 Relief Ave',
   false, null, 'public', 'offers_received', 'Riley Rider'),

  -- Horizon
  ('bbbbbbbb-cccc-4ddd-8eee-300000000021', 'bbbbbbbb-cccc-4ddd-8eee-200000000021',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Derm check', '3 Skin Street',
   false, null, 'private', 'private_requested', 'Riley Rider'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000022', 'bbbbbbbb-cccc-4ddd-8eee-200000000022',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Home', '220 Cedar Ct', 'Ortho review', '66 Bone Blvd',
   false, null, 'private', 'ride_confirmed', 'Blake Both'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000023', 'bbbbbbbb-cccc-4ddd-8eee-200000000023',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Blood draw', '1200 Hospital Drive',
   false, null, 'public', 'public_requested', 'Riley Rider'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000024', 'bbbbbbbb-cccc-4ddd-8eee-200000000024',
   'bbbbbbbb-cccc-4ddd-8eee-000000000001', 'bbbbbbbb-cccc-4ddd-8eee-000000000001',
   'Home', '100 Maple Ave', 'Hearing aid fit', '2 Audio Way',
   false, null, 'private', 'ride_confirmed', 'Riley Rider'),
  ('bbbbbbbb-cccc-4ddd-8eee-300000000025', 'bbbbbbbb-cccc-4ddd-8eee-200000000025',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'bbbbbbbb-cccc-4ddd-8eee-000000000003',
   'Home', '220 Cedar Ct', 'Nutrition consult', '8 Greens Lane',
   false, null, 'private', 'private_requested', 'Blake Both')
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

-- Assignments (claimed rides)
insert into public.ride_assignments (
  id, ride_request_id, angel_id, source, assigned_by_user_id, confirmation_status
)
values
  -- Past
  ('bbbbbbbb-cccc-4ddd-8eee-400000000001', 'bbbbbbbb-cccc-4ddd-8eee-300000000001',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'private_claim',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'confirmed'),
  ('bbbbbbbb-cccc-4ddd-8eee-400000000002', 'bbbbbbbb-cccc-4ddd-8eee-300000000002',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'private_claim',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'confirmed'),
  ('bbbbbbbb-cccc-4ddd-8eee-400000000003', 'bbbbbbbb-cccc-4ddd-8eee-300000000003',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'private_claim',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'confirmed'),
  -- Near
  ('bbbbbbbb-cccc-4ddd-8eee-400000000012', 'bbbbbbbb-cccc-4ddd-8eee-300000000012',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'private_claim',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'confirmed'),
  ('bbbbbbbb-cccc-4ddd-8eee-400000000013', 'bbbbbbbb-cccc-4ddd-8eee-300000000013',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'private_claim',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'confirmed'),
  ('bbbbbbbb-cccc-4ddd-8eee-400000000016', 'bbbbbbbb-cccc-4ddd-8eee-300000000016',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'private_claim',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'confirmed'),
  -- Horizon
  ('bbbbbbbb-cccc-4ddd-8eee-400000000022', 'bbbbbbbb-cccc-4ddd-8eee-300000000022',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'private_claim',
   'bbbbbbbb-cccc-4ddd-8eee-000000000002', 'confirmed'),
  ('bbbbbbbb-cccc-4ddd-8eee-400000000024', 'bbbbbbbb-cccc-4ddd-8eee-300000000024',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'private_claim',
   'bbbbbbbb-cccc-4ddd-8eee-000000000003', 'confirmed')
on conflict (id) do update
set
  angel_id = excluded.angel_id,
  confirmation_status = 'confirmed',
  pending_change_summary = null;

-- Pending public offer (Avery → Riley) for offers_received ride
insert into public.ride_offers (
  id, ride_request_id, angel_id, status, message, angel_display_name, created_at
)
values (
  'bbbbbbbb-cccc-4ddd-8eee-500000000017',
  'bbbbbbbb-cccc-4ddd-8eee-300000000017',
  'bbbbbbbb-cccc-4ddd-8eee-000000000002',
  'pending',
  'I can take this one.',
  'Avery Angel',
  now() - interval '2 hours'
)
on conflict (id) do update
set
  status = 'pending',
  message = excluded.message,
  angel_display_name = excluded.angel_display_name;

commit;

select
  (select count(*) from public.profiles where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%') as qa_profiles,
  (select count(*) from public.ride_requests where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%') as qa_rides,
  (select count(*) from public.ride_assignments where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%') as qa_assignments,
  (select count(*) from public.ride_angel_connections where id::text like 'bbbbbbbb-cccc-4ddd-8eee-%') as qa_connections;
