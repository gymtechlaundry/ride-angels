# Circle invites (family / private)

Trusted-circle invites for people who may not have Ride Angels yet.

## App flow

1. Rider opens **My Ride Angels → Add Trusted Ride Angel** and enters email.
2. RPC `create_circle_invite`:
   - **Existing onboarded profile** → pending `ride_angel_connections` + in-app/push `angel_invited`.
   - **No profile** → `circle_invites` row + token; Edge Function emails the link via **Resend**.
3. Rider can **Share** the same link (Messages / Mail / copy).
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

Apply migration:

`supabase/migrations/20260828000028_circle_invites.sql`

## Landing page contract (Hyperion site)

Host a page at `/rideangels/invite/{token}` that:

1. Tries to open `org.rideangels.app://invite/{token}` (app already installed).
2. **Android:** redirects to the Play Store listing for `org.rideangels.app`.
3. **iOS (until App Store live):** show short copy that iOS is coming / TestFlight if they were invited to test; keep the token in the URL so a later open still works.
4. **Desktop:** show both store buttons + the deep link.

Do not require the invitee to “find” the rider after install — the token is the join path.
