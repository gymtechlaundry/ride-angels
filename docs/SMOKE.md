# Smoke tests — Ride Angels

How to run a build: `~/Projects/hyperion-studio/Playbooks/testing/ios.md` and `android.md`.

Lived-in accounts: Avery (angel) `+15555550102` and Riley (rider) `+15555550101` — see `supabase/seed/QA_TRIO.md`. OTP `123456` on hosted project test phones.

## Auth

- [ ] Create account / Sign in — phone OTP
- [ ] Create account / Sign in — email OTP
- [ ] Leave the app for Messages/Mail during OTP, return, code still works
- [ ] Clock-skew / “issued at future” surfaces a clear sync message (if reproducible)
- [ ] Sign out / sign in again

## Onboarding & modes

- [ ] First run: choose **I’m a Rider** or **I’m a Ride Angel** → lands on **Home** (not Account bounce)
- [ ] Profile: switch “Using the app as” between Rider and Ride Angel
- [ ] Home contact-method card: Add phone/email works; **Not now** dismisses

## Circle & invites

- [ ] Invite by **email** (existing user → pending; accept)
- [ ] Invite by **phone** (link / share / Messages path)
- [ ] Accept invite → trusted circle shows on My Ride Angels

## Rides (private circle)

- [ ] Rider: Add appointment (pickup, destination, date, notes)
- [ ] Angel: see open request → Offer / claim
- [ ] Rider: accept offer
- [ ] Call and Text from ride card open the native dialer / SMS
- [ ] Angel: **On my way** notifies the rider / circle as designed
- [ ] Reminders / push: Profile → Enable push → `device_push_tokens` row → banner when offline if Edge push is live
- [ ] Calendar: Connect device calendar → claimed ride appears on phone calendar
- [ ] Public / community board is **not** shown

## Profile & media

- [ ] Camera / photo picker for avatar
- [ ] Feedback & ideas (optional screenshot)

## Account

- [ ] Delete account in-app (Profile → Account & Security) — **do not** run on shared QA seed accounts unless you will re-seed
- [ ] Support / privacy / terms links open the live HTTPS pages
