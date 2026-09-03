# Product — Ride Angels

Plan who’s driving each appointment with family and friends—so rides aren’t a last-minute burden. Riders request; Ride Angels offer. One account, both roles.

**Status:** V1 feature-complete for first store production. Docs packet ready for TestFlight + Play internal/closed while production review runs. Maintain here: `~/Projects/hyperion-studio/Apps/shipped/ride-angels`

**In this binary (safe to claim):** phone/email OTP; Rider / Ride Angel modes; private-circle appointments and offers; email + phone invites; Call / Text; On my way; push + reminders; device calendar; Feedback & ideas; in-app account delete.

**Not in this binary (do not claim):** public/community board; Google Calendar OAuth; Sign in with Apple/Google; passwords; marketing SMS; live GPS/maps; payments or orgs.

## Platforms

- iOS + Android (Capacitor)

## Backend

Supabase `zuvfzmpdmjwewcuyxtac`. Twilio Verify for phone OTP. Resend for circle invite email. FCM on Android when `google-services.json` is present.

## Store docs

- [LISTING.md](./LISTING.md) — public copy  
- [STORE-SUBMISSION.md](./STORE-SUBMISSION.md) — console forms + review  
- [SMOKE.md](./SMOKE.md) — device checklist  
- Legal mirrors: `docs/legal/` → live site `/rideangels/`
