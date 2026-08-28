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

QA phones: `supabase/seed/QA_TRIO.md`. Hosted test OTP `123456` must be set in Supabase.

## Current versions

Update before every Archive / AAB. See `android/app/build.gradle` and Xcode Version/Build.

## Signing (paths only)

```
Upload keystore path: ~/ride-angels-upload.jks
Key alias: ride-angels
android/key.properties: gitignored, local
Firebase google-services.json: android/app/ (gitignored)
```
