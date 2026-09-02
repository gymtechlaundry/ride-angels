# Services — Ride Angels

Map of vendors. **IDs and dashboard URLs only — never paste API keys, tokens, `.p8` bodies, or `service_role`.**

Playbook: `~/Projects/hyperion-studio/Playbooks/secrets.md`. How-tos: [phone-otp.md](./phone-otp.md), [push-notifications.md](./push-notifications.md), [circle-invites.md](./circle-invites.md), [ride-reminders.md](./ride-reminders.md), [partner-integrations.md](./partner-integrations.md).

## Status

```
Slug:                          ride-angels
Supabase project ref:          zuvfzmpdmjwewcuyxtac
Supabase dashboard:            https://supabase.com/dashboard/project/zuvfzmpdmjwewcuyxtac
Bundle ID:                     org.rideangels.app   (grandfathered)
1Password vault:               Hyperion
```

## Vendors

| Vendor | Why | Dashboard / IDs (not secrets) | Env names | Vault item | Runtime |
| --- | --- | --- | --- | --- | --- |
| Supabase | Auth, DB, Edge | ref `zuvfzmpdmjwewcuyxtac` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` (client); `SUPABASE_SERVICE_ROLE_KEY` (server) | `Hyperion / ride-angels / Supabase service_role` | Anon ? `src/environments/environment.ts` + `environment.prod.ts`. Service role ? Edge secrets only |
| Twilio Verify | Phone OTP (not Messaging) | Verify Service `VAe0461acfec2df955fb4a91a7a51319ca` (`Ride Angels OTP`); Account SID `AC…` | Dashboard fields + `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID` | `Hyperion / ride-angels / Twilio Auth Token` | **Auth ? Providers ? Phone ? Twilio Verify** (not Edge). Do not reuse the rejected toll-free Messaging number |
| Resend | Circle invite email | Domain `hyperionappstudio.com` | `RESEND_API_KEY`, `RESEND_FROM` | `Hyperion / ride-angels / Resend API key` | Edge secrets on `send-circle-invite`. From: `Ride Angels <noreply@hyperionappstudio.com>` |
| APNs | iOS push | Team `R5D743J5S2`; bundle `org.rideangels.app` | `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_P8_KEY`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION`, `RIDE_ANGELS_PUSH_SECRET` | `Hyperion / studio / APNs .p8` (shared with ColorPing) | Edge secrets. `APNS_BUNDLE_ID=org.rideangels.app`. `APNS_PRODUCTION=true` for TestFlight / store |
| Firebase / FCM | Android push | Package `org.rideangels.app` | `FCM_SERVICE_ACCOUNT_JSON` | `Hyperion / ride-angels / Firebase admin` | Edge secrets. `android/app/google-services.json` gitignored. Admin JSON currently also under studio `Admin/` (gitignored) — move to 1Password when convenient |
| ColorPing partner | Ingest appointments | ColorPing project `sglkzrstfbhzsjcxtkpd` | `COLORPING_INGEST_API_KEY` (and `set_partner_api_key` in DB) | `Hyperion / colorping / Ride Angels ingest key` | Must match ColorPing `RIDE_ANGELS_API_KEY` |

## Shared with another Hyperion app

| Secret name | This app’s env | Other app | Other app’s env | Notes |
| --- | --- | --- | --- | --- |
| Partner ingest | `COLORPING_INGEST_API_KEY` | ColorPing | `RIDE_ANGELS_API_KEY` | Same string on both sides |
| APNs .p8 | `APNS_*` | ColorPing | `APNS_*` | Same key file; different `APNS_BUNDLE_ID` |

## Local files (paths only)

```
Upload keystore:               ~/ride-angels-upload.jks  alias ride-angels
android/key.properties:        gitignored, local
google-services.json:          android/app/ (gitignored)
Firebase admin JSON:           studio Admin/ (gitignored) until moved to 1Password
APNs .p8:                      studio shared key
```

## Checklist

- [x] Map filled from existing docs (values still only in vault + Supabase / Auth)
- [ ] 1Password items created with the titles above
- [ ] Firebase admin JSON attached to the 1Password item (then delete loose copies)
