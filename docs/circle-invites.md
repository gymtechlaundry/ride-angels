# Circle invites (family / private)

Trusted-circle invites for people who may not have Ride Angels yet.

## App flow

1. Rider opens **My Ride Angels → Add Trusted Ride Angel** and enters **email or phone**.
2. RPC `create_circle_invite(p_identifier, …)`:
   - **Existing onboarded profile** (match on email or E.164 phone) → pending `ride_angel_connections` + in-app/push `angel_invited`.
   - **No profile + email** → `circle_invites` row + token; Edge Function emails the link via **Resend**.
   - **No profile + phone** → `circle_invites` row with `phone` + token; app opens Messages / share with the link (no Resend SMS yet).
3. Rider can **Share** / **Text link** the same URL.
4. Invitee opens `https://hyperionappstudio.com/rideangels/invite/{token}` (or `org.rideangels.app://invite/{token}`).
5. After signup + onboarding, the app claims the token → **pending** connection → Accept on Ride circle (`accept_ride_angel_invite` notifies the rider with `angel_accepted`).

Public / community board UI is paused; new rides stay private to the circle.

## Supabase secrets

```bash
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
# Optional override (must be a verified Resend domain):
supabase secrets set RESEND_FROM="Ride Angels <noreply@hyperionappstudio.com>"
```

Deploy the function:

```bash
supabase functions deploy send-circle-invite
```

Apply migrations:

- `supabase/migrations/20260828000028_circle_invites.sql`
- `supabase/migrations/20260902000031_circle_phone_invite_on_my_way.sql` (phone column + `p_identifier`)

## Landing page contract (Hyperion site)

Host a page at `/rideangels/invite/{token}` that:

1. Tries to open `org.rideangels.app://invite/{token}` (app already installed).
2. **Android:** redirects to the Play Store listing for `org.rideangels.app`.
3. **iOS / desktop:** shows App Store / download guidance and keeps the token recoverable via query if the SPA drops path segments.
