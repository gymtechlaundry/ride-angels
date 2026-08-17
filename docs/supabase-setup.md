# Supabase setup (Ride Angels V1)

Step-by-step guide to configure a hosted Supabase project for the Ride Angels Ionic app. The app uses **only** `environment.supabase.url` and `environment.supabase.anonKey` — never the `service_role` key in client code.

---

## Prerequisites

- Supabase account ([supabase.com](https://supabase.com))
- Ride Angels repo cloned locally
- Optional: [Supabase CLI](https://supabase.com/docs/guides/cli) for local Postgres (not required for hosted-only setup)

---

## 1. Create a Supabase project

1. Supabase Dashboard → **New project**
2. Choose organization, name (e.g. `ride-angels-dev`), database password, region
3. Wait for provisioning
4. Copy from **Project Settings → API**:
   - **Project URL** → `environment.supabase.url`
   - **anon public** (or publishable) key → `environment.supabase.anonKey`

Update `src/environments/environment.ts` (and `environment.prod.ts` for production builds):

```ts
export const environment = {
  production: false,
  organizationsEnabled: false,
  supabase: {
    url: 'https://YOUR_PROJECT_REF.supabase.co',
    anonKey: 'YOUR_ANON_OR_PUBLISHABLE_KEY',
  },
  defaultCountryCallingCode: '+1',
};
```

Leave `url` and `anonKey` empty to use the local OTP mock adapter (`123456`) without a live backend.

---

## 2. Apply SQL migrations (in order)

Run each file in **SQL Editor** (Dashboard → **SQL Editor** → New query → paste → Run).

| Order | File | Adds |
|-------|------|------|
| 1 | `supabase/migrations/20260811000000_profiles.sql` | `profiles`, Auth trigger, profile RLS |
| 2 | `supabase/migrations/20260811000001_rides_domain.sql` | Appointments, rides, offers, assignments, connections, domain RLS, `find_profile_for_invite` |
| 3 | `supabase/migrations/20260811000002_v1_hardening.sql` | Notifications, status constraints, indexes, atomic RPCs, helpers |
| 4 | `supabase/migrations/20260811000003_avatars_storage.sql` | `avatars` storage bucket + path-scoped policies |
| 5 | `supabase/migrations/20260811000004_cancel_ops.sql` | `cancel_ride_request`, `withdraw_ride_offer` |

**Verify**

- **Table Editor:** `profiles`, `appointments`, `ride_requests`, `ride_offers`, `ride_assignments`, `ride_angel_connections`, `notifications`
- **Database → Functions:** `create_appointment_with_ride`, `claim_private_ride`, `submit_ride_offer`, `accept_ride_offer`, `find_profile_for_invite`, `cancel_ride_request`, `withdraw_ride_offer`
- **Storage:** bucket `avatars`

If migrations are skipped, the app shows errors like missing `profiles` table or failed RPC calls.

---

## 3. Authentication — Phone (Twilio Verify)

Primary sign-in: **passwordless SMS OTP** via **Twilio Verify** (not Programmable
Messaging / toll-free From numbers).

1. Dashboard → **Authentication → Providers**
2. Enable **Phone**
3. SMS provider: **Twilio Verify**
   - Account SID, Auth Token, **Verify Service SID** (`VA…`)
   - Follow [phone-otp.md](./phone-otp.md)
4. **Do not** put Twilio credentials in the Ionic app — Supabase Auth sends SMS

### Why not toll-free Messaging?

US toll-free Messaging verification for the previous From number was rejected
(Twilio **30526**). Twilio Verify is the supported OTP path and does not use that
toll-free sender.

While Verify is being configured, use **Authentication → Phone → Test phone numbers**
so iOS/Android builds can exercise the OTP UI without real SMS.

Full runbook (Verify setup, test numbers, device smoke):
[phone-otp.md](./phone-otp.md).

**App behavior**

- Register: `signInWithOtp({ phone, options: { shouldCreateUser: true } })`
- Sign in: `shouldCreateUser: false` (no silent account creation)

See [authentication.md](./authentication.md).

---

## 4. Authentication — Email (Resend / SMTP)

Secondary sign-in and add-email flow: **email OTP**.

1. Dashboard → **Authentication → Providers** → enable **Email**
2. Dashboard → **Authentication → SMTP Settings**
   - Configure **Resend** (or another SMTP provider): host, port, user, password, sender address
3. **Authentication → Email Templates**
   - Use OTP templates with `{{ .Token }}` (not magic-link-only templates) for verify flows

**Do not** embed Resend API keys in the Ionic app.

---

## 5. Storage — avatars bucket

Apply `20260811000003_avatars_storage.sql`, **or** configure manually in Dashboard → **Storage**:

1. Create bucket **`avatars`** (public for V1 shareable avatar URLs)
2. Policies (already in the migration):
   - Anyone can read objects in `avatars`
   - Authenticated users may insert/update/delete only under `{auth.uid()}/…`

Path convention: `{authUserId}/avatar.jpg` (or `.png` / `.webp`). Store the resulting public URL on `profiles.avatar_url`.

Never use `service_role` in the client for uploads.

---

## 6. Row Level Security

Migrations enable RLS on all domain tables. No extra dashboard toggle is needed if migrations ran successfully.

Quick sanity check: sign in as User A, create a private ride — User B (not in trusted circle) should not see it in `ride_requests` queries.

For multi-device testing (Rider phone + Angel simulator), enable **Realtime** replication for:

- `ride_requests`
- `appointments`
- `ride_offers`
- `ride_assignments`
- `notifications`
- `ride_angel_connections`

Dashboard → **Database → Publications → supabase_realtime** → add those tables.

Without Realtime, pull-to-refresh / revisiting Home still reloads domain data.

Details: [backend-architecture.md](./backend-architecture.md#row-level-security-rls).

---

## 7. Optional — TypeScript type generation

If using Supabase CLI linked to the project:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/app/core/supabase/database.types.ts
```

This is **optional** for V1; the app currently maps rows manually in `RideDomainRepository` and `UserProfileRepository`.

---

## 8. Seed / test data notes

There is **no** checked-in seed SQL for production. For manual testing:

1. Register two accounts (phone OTP) — profiles auto-create via trigger
2. Complete onboarding on both (`onboarding_completed = true`) so `find_profile_for_invite` works
3. User A invites User B by verified email or E.164 phone
4. User B accepts connection → status `accepted`
5. User A creates appointment + ride (`create_appointment_with_ride` via app)
6. Test private claim (trusted angel) or public offer flow

Use **separate devices or browsers** (or sign out between accounts) to validate RLS across accounts.

Mock data for UI-only development: `src/app/core/mock/mock-data.ts` (used when Supabase env is empty).

---

## 9. Optional — Local Supabase CLI

For local Postgres + Auth emulation:

```bash
# From repo root (requires supabase CLI installed)
supabase init   # if not already initialized
supabase start
supabase db reset   # applies migrations from supabase/migrations/
```

This repo ships SQL migrations but may not include `config.toml` until CLI init is run. Hosted Dashboard setup (sections 1–5) is the primary path documented for the team.

Local URLs/keys from `supabase start` output can replace `environment.supabase` for local dev.

---

## 10. Environments

| File | Use |
|------|-----|
| `src/environments/environment.ts` | Local / dev builds |
| `src/environments/environment.prod.ts` | Production builds |

Use **separate Supabase projects** for dev and production. Never share production keys in dev builds committed to git if the repo is public.

`organizationsEnabled: false` — no org-specific Supabase config in V1.

---

## 11. Checklist before live testing

- [ ] Project created; URL + anon key in environment files
- [ ] All five migrations applied in order
- [ ] Phone provider enabled (Twilio configured)
- [ ] Email provider + SMTP configured (Resend or other)
- [ ] Email templates use OTP token
- [ ] `avatars` bucket + policies (if testing profile photos)
- [ ] Two test accounts registered; invite + ride flows exercised

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| "Profiles table is missing" | Migration `00000_profiles.sql` not applied |
| RPC / relation errors on appointments | Migration `00001_rides_domain.sql` not applied |
| Notifications or claim/offer RPC missing | Migration `00002_v1_hardening.sql` not applied |
| Invite lookup returns no one | Target profile `onboarding_completed = false` or email/phone mismatch |
| OTP not received | Twilio/Resend dashboard config, template, or provider quota |
| User sees another user's private ride | RLS misconfiguration — re-run migrations; do not disable RLS |

---

## Related docs

- [backend-architecture.md](./backend-architecture.md)
- [database-schema.md](./database-schema.md)
- [authentication.md](./authentication.md)
- [../supabase/README.md](../supabase/README.md)
