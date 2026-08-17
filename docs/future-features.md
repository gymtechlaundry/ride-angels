# Future features & backlog

Living list of planned updates for Ride Angels. **Add new ideas at the bottom of the matching section** (or create a new section). Mark items done by moving them to [Shipped](#shipped-reference) with the version/date.

Last updated: 2026-08-14 (flexible errands / anytime rides)

---

## How to use this doc

1. When we discuss a future idea, add a bullet here (owner optional, priority optional).
2. Prefer short bullets: **what** + **why** (one line each is enough).
3. Link related docs when they already exist (`docs/…`, migrations, flags).
4. Do **not** treat this as a commitment to ship order — reorder freely.

Suggested priority tags: `P0` next release · `P1` soon · `P2` later · `P3` exploratory

---

## Next release candidates

### Push notifications — `P0`

- Capacitor `@capacitor/push-notifications` (native only).
- Store device tokens in Supabase (`device_push_tokens` or similar) with RLS.
- On `notifications` insert → Edge Function / FCM (iOS via APNs key) so riders/angels get OS banners when offline.
- Deep-link taps into appointment / circle / notifications screens.
- **Not in V1 TestFlight.** In-app notification inbox remains the V1 channel.

### Google Calendar sync — `P1`

- Code exists; flagged off: `googleCalendar.enabled: false`.
- Enable OAuth PKCE clients, Profile “Connect Google”, and sync path.
- See [calendar-integration.md](./calendar-integration.md).

### Supabase Realtime — `P1`

- Live updates for `notifications` and `ride_offers` (and optionally rides) without pull-to-refresh.
- Subscribe only to RLS-readable rows. See [backend-architecture.md](./backend-architecture.md#realtime).
- Dashboard: enable replication for those tables ([supabase-setup.md](./supabase-setup.md)).

### Address / maps UX — `P1`

- Places autocomplete or geocoding for pickup / destination (today: free-text labels only).
- Optional map preview on appointment detail / claim cards.
- Store lat/lng when available (schema + RLS later).

### Auth & account polish — `P1`

- Sign in with Apple / Google (in addition to phone/email OTP). See [authentication.md](./authentication.md).
- Data export (App Store / privacy request; support or in-app flow).
- Remove orphan password demo UI (`sign-in.page`, `AuthApiService`, `DEMO_PASSWORD`) once no longer useful for local mock.

### Profile & rider preferences — `P2`

- Home address on profile.
- Accessibility / mobility notes (wheelchair, assistance, etc.) surfaced to angels.
- Preferred contact method, emergency contact.

### Mock / dual-mode cleanup — `P2`

- Collapse or gate mock OTP / seeded `mock-data.ts` more clearly for production builds.
- Move live helpers (`buildClaimBoard`, date formatters) out of `core/mock/`.

### Universal links & deep links — `P2`

- Upgrade from custom scheme `org.rideangels.app://` to Associated Domains / universal links for shared appointment links.

---

## Organizations & monetization (deferred)

Flag: `environment.organizationsEnabled` = `false`. Architecture notes: [organization-readiness.md](./organization-readiness.md).

Do **not** ship UI until product asks. Future concepts include:

- Hospitals, clinics, churches, nonprofits, senior communities, municipalities, veterans / disability orgs, volunteer transport programs.
- Org memberships, coordinator roles, org-scoped rides / visibility.
- Billing, sponsorships, admin dashboards, reporting.
- Postgres org tables (models already allow optional `coordinatingOrganizationId` in app types only).

---

## Product / UX ideas discussed

- Invite Ride Angels by **phone** as well as email (parity with auth channels).
- Richer notification preferences (mute types, quiet hours).
- Angel availability / “I’m free this week” signals.
- Ride history / completed trip archive UI.
- SMS fallback when push isn’t available (Twilio already used for OTP — separate product decision).
- Android Play Store release — see [`android-testing.md`](./android-testing.md) (FCM + device calendar wired; Firebase project + `FCM_SERVER_KEY` still required per environment).
- TimeTree: no direct API — keep relying on device calendar bridge unless a partner API appears.
- Recurring appointments (e.g. weekly dialysis / therapy) with one create flow.
- Calendar: rider appointments already sync on create; angels still sync on claim (see calendar-integration.md).
- “On the way” / trip-status check-ins (angel → rider) without full GPS tracking.
- In-app call / text shortcuts to rider or angel from appointment detail (tel: / sms:).
- Share appointment summary link (once universal links exist).
- Empty-state coaching on Home / Circle for first-time riders and angels.
- Accessibility pass: Dynamic Type, VoiceOver labels, high-contrast review.
- Multi-language / localization (start with Spanish if rider communities need it).
- Widget or Lock Screen glance for next ride (iOS).
- Rate / thank angel after completed trip (lightweight, non-public).
- Duplicate / copy last appointment as a shortcut.
- Soft “needs ride again” for cancelled claims so the request reopens cleanly.
- Admin/support tooling outside the app (lookup user, resend OTP, disable account).
- **Flexible errands / anytime rides** — `P2`
  - **What:** Same create → circle/community offer → confirm flow as appointments, but as a flexible ride type with a time window (or “whenever works”) instead of a single date/time. Examples: DMV, groceries, pharmacy. Not a separate Errands product/tab first.
  - **Why:** Core mission fit. Riders often won’t text their circle because asking feels like a burden; they wait until the last minute or pay for Uber instead. Posting the need in-app lets angels opt in without the rider having to ask anyone directly. That burden-removal is a founding reason for Ride Angels.
  - **Scope notes:** Keep fixed appointments for timed medical/etc trips; errands as the flexible sibling. Calendar sync / Home day grouping need a defined behavior for windowed rides (open list, earliest day in window, or no calendar event until claimed).

---

## Infrastructure / ops

- Confirm all migrations `00000`–`00011` applied on the hosted Supabase project before each release that depends on them ([supabase/README.md](../supabase/README.md)).
- CI: lint + unit tests + optional `ng build --configuration production` on PRs.
- Staging Supabase project vs production.
- Analytics / crash reporting (e.g. Sentry) — not wired yet.
- App Store privacy nutrition labels + support URL / marketing site updates.
- App Store screenshots / preview video pipeline for public launch.
- Error monitoring on critical RPCs (claim, offer, invite) with user-safe messages.

---

## Ideas inbox

_Add new ideas below as we go. Move them into a section above when scoped._

- Tab header branding: keep page titles on tabs; reserve full logo for auth/onboarding (not every tab).
-
---

## Shipped (reference)

Keep brief so this file stays a backlog, not a changelog.

| When | Item |
|------|------|
| V1 (pre–TestFlight) | OTP auth (phone/email), profiles, circle invite/accept/remove, appointments + notes, private + public rides, multi-angel **offers** (rider chooses), in-app notifications (+ dismiss/clear read), profile edit + avatar upload, Apple Calendar sync, Capacitor iOS/Android shell |
| 2026-08-13 | In-app **Delete account** (`delete_own_account` RPC) — Profile and Account & Security |

---

## Related docs

| Doc | Topic |
|-----|--------|
| [testflight.md](./testflight.md) | Upload / TestFlight checklist |
| [store-publish.md](./store-publish.md) | App Store + Play Store public listing (independent tracks) |
| [calendar-integration.md](./calendar-integration.md) | Apple live / Google deferred |
| [organization-readiness.md](./organization-readiness.md) | Org layer prep |
| [backend-architecture.md](./backend-architecture.md) | Stack, RLS, Realtime notes |
| [supabase-setup.md](./supabase-setup.md) | Project + Auth + storage |
