# Identity — Ride Angels

Universal store steps: `~/Projects/hyperion-studio/Playbooks/store/`

## Identity (permanent)

```
App name: Ride Angels
Company / seller: Hyperion App Studio
Bundle ID / applicationId: org.rideangels.app
Play package name: org.rideangels.app
SKU (iOS): ride-angels-ios
```

**Grandfathered:** do not change the bundle ID (`org.rideangels.app`) or the live site path (`/rideangels/`, no hyphen). New Hyperion apps use `com.hyperionappstudio.<slug>` — see `~/Projects/hyperion-studio/Playbooks/naming.md`.

Vendors and key **names**: [SERVICES.md](./SERVICES.md).

## Public URLs

```
Support URL: https://hyperionappstudio.com/rideangels/support/
Privacy policy URL: https://hyperionappstudio.com/rideangels/privacy/
Terms URL: https://hyperionappstudio.com/rideangels/terms/
SMS opt-in: https://hyperionappstudio.com/rideangels/sms-opt-in/
Support email: support@hyperionappstudio.com
```

## Review

```
Contact name: Devin Cooper
Contact phone: 904-556-1823
Contact email: support@hyperionappstudio.com
```

QA phones: `supabase/seed/QA_TRIO.md`. Hosted test OTP `123456` must be set in Supabase.

**Play:** production listing already live — this resubmit is a **production release update** (bump `versionCode`), not a first unlock. Family can use Internal testing while that update rolls out.

## Current versions

Update before every Archive / AAB. See `android/app/build.gradle` and Xcode Version/Build.

| Platform | Marketing | Build / versionCode | Notes |
| --- | --- | --- | --- |
| iOS (repo now) | 1.0 | 11 | Last baseline in Xcode |
| Android (repo now) | 1.0 | 9 | R8 minify on; must exceed any uploaded AAB |
| **Next store upload** | 1.0 | bump if 11 / 9 already used | `npm run store:preflight` then `release:ios` / `android:bundle` |

Full packet: [STORE-SUBMISSION.md](./STORE-SUBMISSION.md). Listing paste: [LISTING.md](./LISTING.md).

## Signing (paths only)

```
Upload keystore path: ~/ride-angels-upload.jks
Key alias: ride-angels
android/key.properties: gitignored, local
Firebase google-services.json: android/app/ (gitignored)
```
