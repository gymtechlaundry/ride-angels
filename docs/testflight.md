# TestFlight release checklist

Upload Ride Angels (`org.rideangels.app`) to TestFlight.

Public App Store / Play Store listing (copy, privacy labels, screenshots, review notes): [store-publish.md](./store-publish.md).

Trusted-circle invites (email + deep link): [circle-invites.md](./circle-invites.md).

## Prerequisites

- [ ] Apple Developer Program membership (paid)
- [ ] App record in [App Store Connect](https://appstoreconnect.apple.com) for bundle ID `org.rideangels.app`
- [ ] Xcode 26+ with iOS 26 SDK (required by current App Store Connect)
- [ ] Signing team set in Xcode (this repo uses team `R5D743J5S2`)
- [ ] Supabase migrations through **`00011`** applied on the hosted project
- [ ] Production env points at the correct Supabase URL + anon key (`src/environments/environment.prod.ts`)

## Build the release bundle (from repo root)

```bash
# Production www/ + Cap sync + open Xcode (must NOT include a live-reload server.url)
npm run ios:release

# Confirm live-reload is gone (should print nothing or no "url": "http...")
grep -n '"url"' ios/App/App/capacitor.config.json || echo "OK: no live server url"
```

If `capacitor.config.json` still has `"url": "http://…"`, remove it and re-run `npx cap sync ios`. A TestFlight build that points at your Mac will show a white screen for testers.

## Xcode steps

1. Select scheme **App**, destination **Any iOS Device (arm64)**.
2. **Signing & Capabilities** → Team selected, bundle ID `org.rideangels.app`, automatic signing.
3. Set versions if needed:
   - **Version** (`MARKETING_VERSION`) — e.g. `1.0`
   - **Build** (`CURRENT_PROJECT_VERSION`) — increment every upload (1, 2, 3…)
4. Menu **Product → Archive**.
5. Organizer → select the archive → **Distribute App** → **App Store Connect** → **Upload**.
6. Wait for processing in App Store Connect (email / Activity tab).

## App Store Connect → TestFlight

1. Open the app → **TestFlight**.
2. When the build is ready, answer export compliance if prompted (`ITSAppUsesNonExemptEncryption` is already `false` in Info.plist — usually “No” encryption).
3. Add **Internal** testers (same team) and/or create an **External** group (may need Beta App Review the first time).
4. Testers install via the TestFlight app.

## Smoke test on a device

- [ ] Sign in with phone or email OTP (real SMS/email)
  - Phone SMS: Twilio **Verify** configured — see [phone-otp.md](./phone-otp.md)
  - Pending SMS: use Dashboard **Test phone numbers** (QA trio `123456`)
- [ ] Complete onboarding if needed
- [ ] Rider: add appointment (with notes), see trusted angels notified in-app
- [ ] Angel: offer to drive; rider accepts one offer
- [ ] Profile: edit name, **Take photo** (camera) / Choose from library
- [ ] Notifications: mark read / clear read / open deep link
- [ ] Profile → Apple Calendar connect (optional) → claim/accept creates an event
- [ ] No white screen on cold launch (confirms no live-reload URL)

## Notes

- Push notifications are **not** in this build — see [future-features.md](./future-features.md).
- Google Calendar remains disabled.
- Organizations remain disabled (`organizationsEnabled: false`).
- Calendar and avatar APIs need a **physical device** (not just Simulator) for full validation.
