# Push notifications (Ride Angels)

In-app `notifications` remain the source of truth. Push is additive and respects
per-type preferences on Profile.

Profile → **Notifications** lists channels:

- **Push notifications** — device push on/off + “Choose events” (per-type push prefs)
- **In-app notifications** — master switch (`channel_in_app` in `notification_preferences`); when off, the inbox and badge hide on the client (rows stay in the DB)
- **SMS notifications** — Coming soon (`channel_sms` reserved; not wired)

## Client

- `@capacitor/push-notifications`
- `PushRegistrationService` registers after sign-in and upserts `device_push_tokens`
- Profile → Notifications: channel rows above; push event types at `/account/notifications`
- Profile → Connected apps: ColorPing linked badge (`get_my_partner_links`)

iOS: Push capability + `UIBackgroundModes` → `remote-notification`. Bundle ID: `org.rideangels.app`.

Android: `POST_NOTIFICATIONS` in the manifest + Firebase `google-services.json`
(see [`android-testing.md`](./android-testing.md)). Bundle / applicationId: `org.rideangels.app`.

```bash
npx cap sync ios
npx cap sync android
```

## Server

`AFTER INSERT ON notifications` → `notify_dispatch_push` (pg_net) → Edge `dispatch-push`.

### Deployed (2026-08-12)

- Migration `20260812000015_push_prefs_partner_select.sql` applied
- Edge `dispatch-push` deployed
- Vault secret `ride_angels_push_secret` created (matches `RIDE_ANGELS_PUSH_SECRET`)
- Edge secrets set: `RIDE_ANGELS_PUSH_SECRET`, `APNS_BUNDLE_ID=org.rideangels.app`
- **TestFlight / App Store:** `APNS_PRODUCTION=true` (production APNs host)
- **Xcode debug installs:** temporarily use `APNS_PRODUCTION=false` (sandbox); flip back for TestFlight

### Remaining APNs key material

Reuse the **same** Apple APNs key as ColorPing (Key ID / Team ID / `.p8`), but keep
`APNS_BUNDLE_ID=org.rideangels.app`:

```bash
supabase secrets set \
  APNS_KEY_ID='XXXXXXXXXX' \
  APNS_TEAM_ID='XXXXXXXXXX' \
  APNS_P8_KEY="$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' AuthKey_XXXXXXXXXX.p8)" \
  APNS_BUNDLE_ID=org.rideangels.app \
  APNS_PRODUCTION=true \
  --project-ref zuvfzmpdmjwewcuyxtac
```

Optional Android (required for OS banners on Android) — **FCM HTTP v1**:

1. Firebase → Project settings → **Service accounts** → **Generate new private key**
2. Set the JSON as an Edge secret:

```bash
supabase secrets set \
  FCM_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/your-firebase-adminsdk.json)" \
  --project-ref zuvfzmpdmjwewcuyxtac
```

Place `android/app/google-services.json` from the Firebase Console (package
`org.rideangels.app`). Full steps: [`android-testing.md`](./android-testing.md).

Redeploy after changing secrets (optional for secret-only flips; required for code changes):

```bash
supabase functions deploy dispatch-push --project-ref zuvfzmpdmjwewcuyxtac --no-verify-jwt
```

### Manual banner smoke test (SQL)

Push fires on `INSERT` into `public.notifications` (when device push is on, prefs allow the type, and a `device_push_tokens` row exists):

```sql
insert into public.notifications (
  recipient_profile_id, type, title, body
) values (
  '<PROFILE_UUID>',  -- same as auth.users id for this app
  'appointment_changed',
  'Push test',
  'If you see this banner, APNs or FCM delivery works.'
);
```

## Preferences

`notification_preferences.preferences` is a jsonb map of type → boolean.
Missing keys default to **enabled**. In-app inbox is never filtered by these prefs.

## Smoke test

1. **Native build** — Xcode (iOS) or `npm run android:run` on device; allow notifications when prompted.
2. **Token** — Profile → Enable push; confirm a row in `device_push_tokens` for your user (`ios` or `android`).
3. **Prefs gate** — Toggle a type off on Profile; insert a matching `notifications` row (or trigger a real event); confirm no APNs/FCM delivery for that type; inbox still shows it.
4. **Prefs on** — Toggle type back on; trigger again; confirm push arrives (after APNs / `FCM_SERVER_KEY` are set).
5. **Android FCM** — Requires `google-services.json` + `FCM_SERVICE_ACCOUNT_JSON` (see [`android-testing.md`](./android-testing.md)).
6. **ColorPing link badge** — Link from ColorPing; Profile → Connected apps shows **ColorPing linked**.
7. **Appointment parity** — Force a color match with Ride Angels integration on; Ride Angels Home/Calendar shows a private ride card like a manual Add Appointment (pickup placeholder until edited).
