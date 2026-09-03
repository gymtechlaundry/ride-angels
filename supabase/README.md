# Supabase

SQL migrations for the Ride Angels hosted Supabase project.

## Apply migrations (in order)

1. `migrations/20260811000000_profiles.sql`
2. `migrations/20260811000001_rides_domain.sql`
3. `migrations/20260811000002_v1_hardening.sql`
4. `migrations/20260811000003_avatars_storage.sql`
5. `migrations/20260811000004_cancel_ops.sql`
6. `migrations/20260811000005_set_ride_visibility.sql`
7. `migrations/20260811000006_assigned_angel_access.sql`
8. `migrations/20260811000007_appointment_edit_cancel.sql`
9. `migrations/20260811000008_angel_cancel_assignment.sql`
10. `migrations/20260811000009_calendar_sync.sql`
11. `migrations/20260811000010_circle_notify_and_remove.sql`
12. `migrations/20260811000011_notif_delete_private_offers.sql`
13. `migrations/20260812000012_colorping_ingest.sql` — appointment external_reference + ingest RPC
14. `migrations/20260812000013_colorping_verified_link.sql` — legacy ColorPing link tables
15. `migrations/20260812000014_partner_integrations.sql` — generic partners (ColorPing + future apps)

Open **SQL Editor** in the Supabase Dashboard and run each file.

Partner API: deploy `partner-link` + `partner-ingest`, then
`select set_partner_api_key('colorping', '<shared-secret>');`
See [docs/partner-integrations.md](../docs/partner-integrations.md).

### What the migrations enable

**Phase 1 — profiles (`00000`)**

- `public.profiles` keyed by `auth_user_id` (= Supabase `auth.users.id`)
- RLS so each user can read/write their own profile
- Trigger that inserts a profile row when Auth creates a user

**Phase 2a — rides domain (`00001`)**

- Appointments / public board rides visible across accounts (via RLS)
- Trusted-circle invites by verified email or phone (`find_profile_for_invite`)
- Public ride offers with optional notes
- Blocks offering on your own ride

**V1 hardening (`00002`)**

- `notifications` table (RPC-insert only)
- Status check constraints and performance indexes
- Atomic RPCs: `create_appointment_with_ride`, `claim_private_ride`, `submit_ride_offer`, `accept_ride_offer`
- Helpers: `current_profile_id`, `is_active_private_angel`, `is_ride_owner`, `set_updated_at`

**Avatars storage (`00003`)**

- Public `avatars` bucket with path-scoped upload policies (`{authUserId}/…`)

**Cancel / withdraw RPCs (`00004`)**

- `cancel_ride_request`, `withdraw_ride_offer` (status transitions, not hard deletes)

**Visibility toggle (`00005`)**

- `set_ride_request_visibility` RPC + tighter rider-only update RLS

**Assigned angel access (`00006`)**

- Assigned Ride Angels keep SELECT on rides/appointments/profiles after public→private
- Visibility = discovery only; assignment = ongoing trip access

**Appointment edit / cancel (`00007`)**

- Soft-cancel appointments; claimed cancels require a reason and notify the angel
- Claimed edits put the assignment in `pending_reconfirm`; angel confirms or releases
- RPCs: `cancel_appointment`, `update_appointment_details`, `confirm_assignment_after_change`, `decline_assignment_after_change`

**Angel cancel assignment (`00008`)**

- Assigned angels can release a claimed ride with a required reason
- Ride reopens; rider gets `angel_cancelled` notification with the reason
- RPC: `cancel_assignment_by_angel`

**Calendar sync (`00009`)**

- `calendar_preferences` + `ride_calendar_events` for calendar sync tracking
- RPC: `upsert_calendar_preferences`
- V1 client sync is Apple Calendar only; see [calendar-integration.md](../docs/calendar-integration.md)

**Circle notify + remove (`00010`)**

- `create_appointment_with_ride` fans out notifications to accepted private-circle angels
- RPC: `remove_ride_angel_connection` (rider or angel soft-removes; notifies the other party)

**Notification cleanup + private offers (`00011`)**

- Recipients can delete their own notifications (`notifications_delete_own`)
- Trusted angels submit offers on private rides (same as public); rider accepts one via `accept_ride_offer`

**Account deletion (`00024`)**

- RPC: `delete_own_account` — deletes the calling Auth user (cascades profile + domain data) and storage objects under their id
- `created_by_user_id` / `assigned_by_user_id` FKs now `ON DELETE SET NULL`
- **Dev reset (re-onboard a test email/phone):** `./scripts/reset-test-user.sh you@example.com` (requires supabase CLI login; uses service_role from `supabase projects api-keys`)

The mobile app expects profile ownership via `auth_user_id` (= Supabase `auth.users.id`). Never key ownership by email or phone.

## Documentation

Full setup and architecture docs live in [`docs/`](../docs/):

| Doc | Contents |
|-----|----------|
| [supabase-setup.md](../docs/supabase-setup.md) | Dashboard project, Auth (Twilio/Resend), storage, migrations, environments |
| [phone-otp.md](../docs/phone-otp.md) | Phone OTP on iOS/Android — Twilio TFN verification, test numbers, smoke |
| [backend-architecture.md](../docs/backend-architecture.md) | V1 stack, RLS, RPCs, repo boundaries, migration path |
| [database-schema.md](../docs/database-schema.md) | Tables, fields, constraints, ER diagram |
| [authentication.md](../docs/authentication.md) | OTP flows and profile ownership |
| [calendar-integration.md](../docs/calendar-integration.md) | Apple Calendar sync setup (Google deferred) |
| [future-features.md](../docs/future-features.md) | Living backlog for next releases |
| [testflight.md](../docs/testflight.md) | TestFlight / App Store Connect upload checklist |
