# Database schema (V1)

Postgres schema for Ride Angels V1, defined in `supabase/migrations/`. Apply migrations in order:

1. `20260811000000_profiles.sql`
2. `20260811000001_rides_domain.sql`
3. `20260811000002_v1_hardening.sql`

**Identity rule:** `profiles.id = profiles.auth_user_id = auth.users.id`. All `rider_id` / `angel_id` foreign keys reference `profiles.id`.

---

## Entity relationship diagram

```mermaid
erDiagram
  auth_users ||--|| profiles : "id = auth_user_id"
  profiles ||--o{ appointments : "rider_id"
  profiles ||--o{ ride_requests : "rider_id"
  appointments ||--|| ride_requests : "appointment_id"
  ride_requests ||--o| ride_assignments : "ride_request_id UNIQUE"
  ride_requests ||--o{ ride_offers : "ride_request_id"
  profiles ||--o{ ride_offers : "angel_id"
  profiles ||--o{ ride_assignments : "angel_id"
  profiles ||--o{ ride_angel_connections : "rider_id"
  profiles ||--o{ ride_angel_connections : "angel_id"
  profiles ||--o{ notifications : "recipient_profile_id"
  appointments ||--o{ notifications : "related_appointment_id"
  ride_requests ||--o{ notifications : "related_ride_request_id"

  profiles {
    uuid id PK
    uuid auth_user_id UK
    text first_name
    text last_name
    text display_name
    text email
    text phone
    text avatar_url
    text_array roles
    boolean onboarding_completed
    timestamptz created_at
    timestamptz updated_at
  }

  appointments {
    uuid id PK
    uuid rider_id FK
    uuid created_by_user_id FK
    text title
    date ride_date
    time ride_time
    text notes
    timestamptz created_at
    timestamptz updated_at
  }

  ride_requests {
    uuid id PK
    uuid appointment_id FK
    uuid rider_id FK
    uuid created_by_user_id FK
    text pickup_label
    text pickup_line1
    text destination_label
    text destination_line1
    boolean return_needed
    time return_pickup_time
    text visibility
    text status
    text rider_display_name
    timestamptz created_at
    timestamptz updated_at
  }

  ride_assignments {
    uuid id PK
    uuid ride_request_id FK UK
    uuid angel_id FK
    text source
    timestamptz assigned_at
    uuid assigned_by_user_id FK
  }

  ride_offers {
    uuid id PK
    uuid ride_request_id FK
    uuid angel_id FK
    text status
    text message
    text angel_display_name
    timestamptz created_at
  }

  ride_angel_connections {
    uuid id PK
    uuid rider_id FK
    uuid angel_id FK
    text status
    text relationship_label
    text rider_display_name
    text angel_display_name
    timestamptz invited_at
    timestamptz accepted_at
  }

  notifications {
    uuid id PK
    uuid recipient_profile_id FK
    text type
    text title
    text body
    text related_entity_type
    text related_entity_id
    uuid related_appointment_id FK
    uuid related_ride_request_id FK
    timestamptz read_at
    timestamptz created_at
  }
```

---

## `profiles`

Application profile; one row per Auth user.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | Must equal `auth_user_id` |
| `auth_user_id` | `uuid` | NOT NULL, UNIQUE, FK → `auth.users(id)` ON DELETE CASCADE | Ownership key |
| `first_name` | `text` | NOT NULL, default `''` | |
| `last_name` | `text` | NOT NULL, default `''` | |
| `display_name` | `text` | NOT NULL, default `'Ride Angels member'` | |
| `email` | `text` | nullable | Contact; not PK |
| `phone` | `text` | nullable | E.164 preferred; not PK |
| `avatar_url` | `text` | nullable | Public URL after storage upload |
| `roles` | `text[]` | NOT NULL, default `{}` | e.g. `'rider'`, `'rideAngel'` |
| `onboarding_completed` | `boolean` | NOT NULL, default `false` | Required for invite lookup |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Trigger-maintained |

**Check constraints**

- `profiles_id_matches_auth_user`: `id = auth_user_id`

**Indexes**

- `profiles_auth_user_id_idx` on `(auth_user_id)`

**Triggers**

- `profiles_set_updated_at` → `set_profiles_updated_at()`
- `on_auth_user_created` on `auth.users` → `handle_new_auth_user()` (auto-insert profile)

**RLS policies:** `profiles_select_own`, `profiles_insert_own`, `profiles_update_own`, `profiles_select_related`

---

## `appointments`

Scheduled appointment owned by a rider.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `rider_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Owner |
| `created_by_user_id` | `uuid` | FK → `profiles(id)` | Who created the row |
| `title` | `text` | NOT NULL | |
| `ride_date` | `date` | NOT NULL | |
| `ride_time` | `time` | NOT NULL | |
| `notes` | `text` | nullable | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes**

- `appointments_rider_id_idx` on `(rider_id)`
- `appointments_rider_date_idx` on `(rider_id, ride_date)` *(hardening)*

**Triggers**

- `appointments_set_updated_at` → `set_updated_at()` *(hardening)*

**RLS policies:** `appointments_select`, `appointments_insert`, `appointments_update`

---

## `ride_requests`

Transportation need; one per appointment in V1 flows. Addresses are flattened (no address table).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `appointment_id` | `uuid` | NOT NULL, FK → `appointments(id)` ON DELETE CASCADE | |
| `rider_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `created_by_user_id` | `uuid` | FK → `profiles(id)` | |
| `pickup_label` | `text` | NOT NULL | Short label (e.g. "Home") |
| `pickup_line1` | `text` | NOT NULL | Street / primary line |
| `destination_label` | `text` | NOT NULL | |
| `destination_line1` | `text` | NOT NULL | |
| `return_needed` | `boolean` | NOT NULL, default `false` | |
| `return_pickup_time` | `time` | nullable | When return trip needed |
| `visibility` | `text` | NOT NULL | `'private'`, `'public'`, `'none'` |
| `status` | `text` | NOT NULL | See status enum below |
| `rider_display_name` | `text` | NOT NULL, default `'Rider'` | Denormalized for board display |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Check constraints**

- `visibility IN ('private', 'public', 'none')`
- `ride_requests_status_check` *(hardening)*: status ∈  
  `'draft'`, `'ride_needed'`, `'private_requested'`, `'public_requested'`, `'offers_received'`, `'ride_confirmed'`, `'upcoming'`, `'in_progress'`, `'completed'`, `'cancelled'`, `'ride_cancelled'`

**Indexes**

- `ride_requests_rider_id_idx` on `(rider_id)`
- `ride_requests_visibility_idx` on `(visibility)`
- `ride_requests_appointment_id_idx` on `(appointment_id)`
- `ride_requests_rider_status_idx` on `(rider_id, status)` *(hardening)*
- `ride_requests_public_status_idx` on `(visibility, status)` WHERE `visibility = 'public'` *(hardening)*

**Triggers**

- `ride_requests_set_updated_at` → `set_updated_at()` *(hardening)*

**RLS policies:** `ride_requests_select`, `ride_requests_insert`, `ride_requests_update`

---

## `ride_assignments`

Confirmed driver for a ride. At most one assignment per ride.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `ride_request_id` | `uuid` | NOT NULL, **UNIQUE**, FK → `ride_requests(id)` ON DELETE CASCADE | One angel per ride |
| `angel_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Driver |
| `source` | `text` | NOT NULL | `'private_claim'` or `'public_offer'` |
| `assigned_at` | `timestamptz` | NOT NULL, default `now()` | |
| `assigned_by_user_id` | `uuid` | FK → `profiles(id)` | Who confirmed |

**Check constraints**

- `source IN ('private_claim', 'public_offer')`

**RLS policies:** `ride_assignments_select`, `ride_assignments_insert`

---

## `ride_offers`

Offers from Ride Angels on **public** rides.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `ride_request_id` | `uuid` | NOT NULL, FK → `ride_requests(id)` ON DELETE CASCADE | |
| `angel_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | Offer author |
| `status` | `text` | NOT NULL | See offer status enum |
| `message` | `text` | nullable | Optional note |
| `angel_display_name` | `text` | NOT NULL, default `'Ride Angel'` | Denormalized |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Check constraints**

- `status IN ('pending', 'accepted', 'declined', 'withdrawn', 'closed')`

**Indexes**

- `ride_offers_ride_request_id_idx` on `(ride_request_id)`
- `ride_offers_angel_id_idx` on `(angel_id)`
- `ride_offers_one_pending_per_angel` — **unique partial** on `(ride_request_id, angel_id)` WHERE `status = 'pending'` *(hardening)*

**RLS policies:** `ride_offers_select`, `ride_offers_insert`, `ride_offers_update`

---

## `ride_angel_connections`

Personal trusted circle (not organization membership).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `rider_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `angel_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `status` | `text` | NOT NULL | Connection lifecycle |
| `relationship_label` | `text` | NOT NULL, default `'Trusted contact'` | |
| `rider_display_name` | `text` | NOT NULL, default `'Rider'` | |
| `angel_display_name` | `text` | NOT NULL, default `'Ride Angel'` | |
| `invited_at` | `timestamptz` | NOT NULL, default `now()` | |
| `accepted_at` | `timestamptz` | nullable | Set when accepted |

**Check constraints**

- `status IN ('pending', 'accepted', 'declined', 'removed')`
- `ride_angel_connections_no_self`: `rider_id <> angel_id` *(hardening)*

**Unique constraints**

- `(rider_id, angel_id)`

**Indexes**

- `ride_angel_connections_rider_id_idx` on `(rider_id)`
- `ride_angel_connections_angel_id_idx` on `(angel_id)`
- `ride_angel_connections_rider_status_idx` on `(rider_id, status)` *(hardening)*
- `ride_angel_connections_angel_status_idx` on `(angel_id, status)` *(hardening)*

**RLS policies:** `connections_select`, `connections_insert`, `connections_update`

**Semantics:** `accepted` = active trusted angel (required for private ride claims via `is_active_private_angel`).

---

## `notifications`

In-app notifications; inserts from RPCs only.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `recipient_profile_id` | `uuid` | NOT NULL, FK → `profiles(id)` ON DELETE CASCADE | |
| `type` | `text` | NOT NULL | e.g. `private_ride_confirmed`, `public_offer_received`, `offer_accepted` |
| `title` | `text` | NOT NULL | |
| `body` | `text` | NOT NULL | |
| `related_entity_type` | `text` | nullable | e.g. `'ride_request'` |
| `related_entity_id` | `text` | nullable | Opaque related id |
| `related_appointment_id` | `uuid` | FK → `appointments(id)` ON DELETE SET NULL | |
| `related_ride_request_id` | `uuid` | FK → `ride_requests(id)` ON DELETE SET NULL | |
| `read_at` | `timestamptz` | nullable | NULL = unread |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes**

- `notifications_recipient_created_idx` on `(recipient_profile_id, created_at DESC)`
- `notifications_recipient_unread_idx` on `(recipient_profile_id, read_at)` WHERE `read_at IS NULL`

**RLS policies:** `notifications_select_own`, `notifications_update_own`, `notifications_insert_denied` (client insert always false)

---

## Functions & RPCs

| Name | Kind | Purpose |
|------|------|---------|
| `set_profiles_updated_at()` | trigger | Updates `profiles.updated_at` |
| `set_updated_at()` | trigger | Updates `appointments` / `ride_requests.updated_at` |
| `handle_new_auth_user()` | trigger (security definer) | Inserts profile on Auth signup |
| `current_profile_id()` | helper | Returns `auth.uid()` |
| `is_active_private_angel(uuid, uuid?)` | helper (security definer) | Trusted-circle check |
| `is_ride_owner(uuid)` | helper (security definer) | Rider ownership check |
| `find_profile_for_invite(text)` | RPC (security definer) | Invite lookup by email/phone |
| `create_appointment_with_ride(jsonb)` | RPC (security definer) | Atomic appointment + ride create |
| `claim_private_ride(uuid)` | RPC (security definer) | Private claim + notification |
| `submit_ride_offer(uuid, text?)` | RPC (security definer) | Public offer + notification |
| `accept_ride_offer(uuid, uuid)` | RPC (security definer) | Accept offer + assignment + notification |

---

## Enumerated values (reference)

### `ride_requests.visibility`

| Value | Meaning |
|-------|---------|
| `private` | Trusted circle only |
| `public` | Community board |
| `none` | Hidden / not shared |

### `ride_requests.status`

| Value | Typical use |
|-------|-------------|
| `draft` | Not yet submitted |
| `ride_needed` | Needs driver |
| `private_requested` | Private ride posted |
| `public_requested` | Public ride posted |
| `offers_received` | At least one pending public offer |
| `ride_confirmed` | Assignment exists |
| `upcoming` | Scheduled, confirmed |
| `in_progress` | Ride underway |
| `completed` | Finished |
| `cancelled` / `ride_cancelled` | Cancelled |

### `ride_offers.status`

`pending`, `accepted`, `declined`, `withdrawn`, `closed`

### `ride_angel_connections.status`

`pending`, `accepted`, `declined`, `removed`

### `ride_assignments.source`

`private_claim`, `public_offer`

### `profiles.roles` (app convention)

`'rider'`, `'rideAngel'` (legacy `'both'` may appear in app code)

---

## Not in V1 schema (app models only)

These exist on TypeScript models for future organization support but **do not** have Postgres columns yet:

- `coordinating_organization_id` on appointments / ride requests / assignments
- `organizationId` on ride offers
- Organization tables / memberships

See [organization-readiness.md](./organization-readiness.md).

---

## Related

- [backend-architecture.md](./backend-architecture.md) — RLS, RPC usage, auth separation
- [supabase-setup.md](./supabase-setup.md) — How to apply migrations
- `supabase/migrations/*.sql` — Authoritative SQL
