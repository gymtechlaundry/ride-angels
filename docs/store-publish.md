# Store publish — iOS and Android

Public listing for Ride Angels (`org.rideangels.app`). **iOS and Android are independent.** You can ship one store without the other.

| Store | Testing doc | Public console |
|---|---|---|
| Apple App Store | [testflight.md](./testflight.md) | [App Store Connect](https://appstoreconnect.apple.com) |
| Google Play | [android-testing.md](./android-testing.md) | [Play Console](https://play.google.com/console) |

Shared listing URLs (both stores):

- Privacy: `https://hyperionappstudio.com/rideangels/privacy/`
- Support: `https://hyperionappstudio.com/rideangels/support/`
- Marketing (optional): `https://hyperionappstudio.com/`
- Support email: `support@hyperionappstudio.com`

---

## Shared product copy

Use the same voice on both stores. Do not mention TestFlight, QA, or 555 numbers.

**Name:** Ride Angels  
**Subtitle (iOS, 30 chars):** Trusted rides from loved ones  
**Short description (Play, 80 chars):** Trusted rides to appointments from family, friends, and neighbors.

**Promotional text (iOS, 170 chars, editable without a new build):**

```
Need a lift to an appointment? Ask the people who already show up for you. Riders request. Ride Angels offer. Your circle stays in the loop.
```

**Full description (both, 4000 chars max):**

```
Ride Angels helps you get to appointments with the people you already trust — family, close friends, and neighbors who have offered to drive.

Create a ride request, notify your circle, and let someone you know claim the trip. If your trusted drivers are busy, you can optionally open the request to community Ride Angels.

FOR RIDERS
• Add an appointment with pickup, destination, date, and notes
• Notify your trusted Ride Angels first
• Review ride offers and accept the driver you want
• Keep trips private to your circle, or open them to the community
• Stay updated from the in-app inbox

FOR RIDE ANGELS
• See open requests from people you support
• Offer to drive when you can
• Keep confirmed trips on Home under upcoming drives
• Optionally add claimed rides to your device calendar so pickups are on your schedule

BUILT AROUND A CIRCLE OF TRUST
Ride Angels are not random drivers. You invite people you know. They accept. Then they are first in line when you need a ride.

Switch between Rider and Ride Angel anytime in Profile — one account, both roles.

Ride Angels uses a one-time code to verify your phone or email. No passwords to remember.

Questions or account help: https://hyperionappstudio.com/rideangels/support/
```

**Keywords (iOS, 100 chars, no spaces after commas):**

```
ride,driver,appointment,caregiver,family,senior,volunteer,transport,carpool,community,medical
```

**What’s New (first public version):**

```
Welcome to Ride Angels — coordinate rides to appointments with the people you already trust.
```

### Screenshot shot list (both stores)

Use a lived-in test account (real-looking names/photos, not “Test User”). Light mode. Skip OTP, empty lists, Delete account, and discussion.

| # | Screen |
|---|---|
| 1 | Welcome — “Trusted rides with the people who care” |
| 2 | Rider Home — upcoming rides + Add an appointment |
| 3 | Add Appointment — filled title, date, pickup, destination |
| 4 | My Ride Angels — 2–3 trusted people |
| 5 | Angel mode — Open requests |

QA phones (hosted test OTP `123456` must be set in Supabase): see [QA_TRIO.md](../supabase/seed/QA_TRIO.md). Avery `+15555550102` (angel) and Riley `+15555550101` (rider) are the best pair.

---

## iOS — App Store

Build/upload: [testflight.md](./testflight.md). Distribute in Xcode as **App Store Connect**, not TestFlight Internal Only, or the build cannot be selected for the store.

### App Store Connect — App Information

| Field | Value |
|---|---|
| Name | Ride Angels |
| Subtitle | Trusted rides from loved ones |
| Bundle ID | `org.rideangels.app` |
| SKU | `ride-angels-ios` |
| Primary language | English (U.S.) |
| Category | Lifestyle / Health & Fitness |
| Content rights | **No** third-party content |
| Age rating | 4+ (see questionnaire below) |
| License | Apple’s Standard License Agreement |
| Copyright | `2026 Hyperion App Studio` |

**Age rating — Features**

- Parental Controls: No
- Age Assurance: No
- Unrestricted Web Access: No
- User-Generated Content: Yes
- Social Media: No
- Social Media Disabled for Users Under 13: No
- Messaging and Chat: No
- Advertising: No

**Age rating — Medical or Wellness**

- Medical or Treatment Information: None
- Health or Wellness Topics: No

Leave **Not Applicable** on the final step (not Made for Kids, no override).

### App Privacy (nutrition labels)

Privacy Policy URL: `https://hyperionappstudio.com/rideangels/privacy/`  
User Privacy Choices URL: blank.

Declare **Yes, we collect data**. Types:

| Type | Linked to identity | Tracking | Purpose |
|---|---|---|---|
| Name | Yes | No | App Functionality |
| Email Address | Yes | No | App Functionality |
| Phone Number | Yes | No | App Functionality |
| Photos or Videos | Yes | No | App Functionality |
| Other User Content | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality |
| Device ID | Yes | No | App Functionality |

Do **not** declare Location, ads, analytics, diagnostics, or purchases. Sold to third parties: **No**.

### Version page (1.0 Prepare for Submission)

- Support URL: `https://hyperionappstudio.com/rideangels/support/`
- Privacy Policy URL (if shown on this page): same privacy URL as above
- Marketing URL: `https://hyperionappstudio.com/` (optional)
- Add the TestFlight build that includes **Delete account**
- Sign-in required: **Yes**. Leave username/password blank (OTP only). If Save requires values: username `Use email OTP — see notes`, password `none`

**iPhone screenshots**

- **6.9"**: 1320 × 2868 (iPhone 16 Pro Max simulator, File → Save Screen)
- **6.5"**: 1242 × 2688 or 1284 × 2778 (iPhone 11 Pro Max or 14 Pro Max)

Do not drop a 6.9" PNG on the 6.5" slot. Resize if needed:

```bash
mkdir -p screenshots-65
for f in *.png; do sips -z 2688 1242 "$f" --out "screenshots-65/$f"; done
```

The Xcode target is iPhone + iPad, so **iPad screenshots** are required (iPad Pro 12.9"/13" simulator).

**App Review notes**

```
Thank you for reviewing Ride Angels.

HOW TO SIGN IN
Create an account with email (recommended) or phone. We send a one-time code. There is no password.

RIDER AND RIDE ANGEL ARE ONE ACCOUNT
After onboarding, open Profile and switch “Using the app as” between Rider and Ride Angel. Both roles stay available.

WHAT TO TRY
1. Rider: Add an appointment (pickup, destination, date/time, notes).
2. Rider: Invite a trusted Ride Angel from My Ride Angels (they must already have an account).
3. Ride Angel: Open requests → offer to drive.
4. Rider: Open the appointment and accept an offer.
5. Profile: optional Apple Calendar connect.
6. Profile or Account & Security: Delete account is available (please use a test account you create).

NOTES FOR REVIEW
• Push notifications are not required; the in-app inbox is the notification channel in this version.
• Google Calendar and Organizations are disabled.
• Camera and Photos are only used for an optional profile picture.
• Calendar access is optional and only used to create/update events for claimed rides.

Contact: support@hyperionappstudio.com
```

**Pricing:** Free. Start with United States.  
**Release:** Manually release this version.  
Export compliance: **No** (`ITSAppUsesNonExemptEncryption` is `false`).

### After approval

App Store Connect → the version → **Release this Version**. Listing usually appears within a few hours. TestFlight can stay up.

Typical first review: 24–48 hours; a new 1.0 can take 2–5 days.

---

## Android — Play Store

Internal testing / FCM / JDK: [android-testing.md](./android-testing.md). Package ID: `org.rideangels.app`.

### One-time Play Console

- [ ] Google Play Developer account (paid)
- [ ] App created with package `org.rideangels.app`
- [ ] `android/key.properties` from `android/key.properties.example` pointing at the upload keystore (do not commit passwords)
- [ ] Privacy policy URL on the store listing **and** in App content → Privacy policy

Google also requires in-app account deletion for apps that create accounts (already in Profile / Account & Security).

### Build a release AAB

```bash
# Bump versionCode in android/app/build.gradle, then:
npm run android:bundle
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

Or open Android Studio after a prod sync: `npm run android:release`.

Increment `versionCode` in `android/app/build.gradle` for every Play upload (`versionName` can stay `1.0` until you bump marketing version).

### Play Console tracks (independent of iOS)

1. **Internal testing** — up to 100 testers, no review. Use this first.
2. **Closed testing** — optional; first time may need a short review.
3. **Production** — public listing; full review.

Upload the AAB to a track, then promote that same release to Production when ready. You do not need a new binary to move tracks unless you want a new version.

### Store listing

| Field | Value |
|---|---|
| App name | Ride Angels |
| Short description | Trusted rides to appointments from family, friends, and neighbors. |
| Full description | Same as iOS description above |
| App icon | 512 × 512 PNG |
| Feature graphic | 1024 × 500 |
| Phone screenshots | At least 2 (use the same 5 shot list); JPEG/PNG, 16:9 or 9:16, 320–3840 px on a side |
| Tablet screenshots | Optional but recommended if you ship the tablet layout |
| Category | Lifestyle (or Health & Fitness) |
| Contact email | `support@hyperionappstudio.com` |
| Privacy policy | `https://hyperionappstudio.com/rideangels/privacy/` |

### App content / Data safety

- **Privacy policy:** required URL above
- **Ads:** No
- **Content rating:** IARC questionnaire — not a kids app; no violence/sexual content; UGC yes (notes + discussion)
- **Target audience:** 18+ (or 13+ if you prefer; the app is not directed at children under 13)
- **News / COVID / Data safety:** Data safety must match iOS nutrition labels:

  Collected, linked to identity, not sold, not used for ads: name, email, phone, photos, other user content, user ID, device ID (push token). Approximate/precise location: **not collected**.

- **Government apps:** No

### Review notes (Play)

Same OTP instructions as iOS. Reviewers create their own account with email. One account can switch Rider / Ride Angel.

### After production review

Play review is often 1–7 days for a new app. When approved, the listing goes live on the track’s release settings (you can staged-rollout 20% → 100%).

---

## Gate checklist (both stores)

Do not submit until:

- [ ] Production build has **no** live-reload `server.url`
- [ ] Hosted Supabase has migrations including `delete_own_account` (`20260814000024`)
- [ ] In-app **Delete account** works on a throwaway account
- [ ] Privacy and support URLs load (no 404)
- [ ] Store privacy / Data safety labels match what the app actually collects
- [ ] Screenshots are the correct pixel sizes for that store slot

iOS and Android listings can go live on different days. Keep version names aligned when you can (`1.0` on both), but `versionCode` / iOS build number increment independently.
