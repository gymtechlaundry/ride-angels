# Store submission packet — Ride Angels

One packet for **TestFlight / Play testing through production**. How to upload: `~/Projects/hyperion-studio/Playbooks/store/`.

**Rules**

- Do not paste passwords, `.p8` contents, keystore passwords, or API keys here.
- Bundle ID is grandfathered: `org.rideangels.app` (not `com.hyperionappstudio.*`).
- Live HTTPS legal pages are required before App Review / Play production (and before Play closed testing).

---

## 0. Hyperion defaults (this app)

| Field | Value |
| --- | --- |
| Seller / developer | Hyperion App Studio (Play account may show **BARFLY ENTERPRISE LLC**) |
| Support email | `support@hyperionappstudio.com` |
| Review contact email | same |
| Support / privacy / terms | `https://hyperionappstudio.com/rideangels/support/` `/privacy/` `/terms/` |
| SMS opt-in (Twilio) | `https://hyperionappstudio.com/rideangels/sms-opt-in/` |
| Copyright | `2026 Hyperion App Studio` |
| Primary language | English (United States) |
| Price | Free (no IAP in this binary) |
| Kids / Made for Kids | No |
| Ads in the app | No |
| Tracking / ATT | No |
| Encryption | Standard HTTPS/TLS only → iOS `ITSAppUsesNonExemptEncryption = false` |
| Account deletion | In-app: Profile → Account & Security → Delete account |

---

## 1. Identity

```
Display name: Ride Angels
Slug (folder / package.json): ride-angels
Bundle ID / applicationId: org.rideangels.app
SKU (iOS, internal): ride-angels-ios
Apple Team ID: R5D743J5S2
App Store Connect Apple ID (numeric, after create): UNKNOWN
Play Console app ID (after create): UNKNOWN
Category Apple primary: Lifestyle
Category Apple secondary (optional): Health & Fitness (optional; medical transport coordination — not a clinical app)
Play category: Lifestyle
Play tags (optional): transportation, family, productivity
```

**Permanent:** do not change `org.rideangels.app` or the site path `/rideangels/`.

---

## 2. What reviewers must understand

```
One-sentence pitch: Coordinate rides to appointments with people you already trust — not random drivers.
Who it is for: Families, caregivers, and neighbors helping someone get to appointments.
What a first-time user does (first-run path):
  1. Create account or Sign in with phone or email OTP
  2. Choose I’m a Rider or I’m a Ride Angel
  3. Land on Home (optional card to add a backup phone/email)
  4. Rider: invite circle + Add an appointment; Angel: wait for / open requests
What is out of scope / not in this binary:
  - Public / community ride board (hidden)
  - Google Calendar OAuth
  - Sign in with Apple / Google
  - Passwords
  - Live GPS / maps / turn-by-turn
  - Payments, subscriptions, or organizations
  - Marketing SMS (OTP auth SMS only)
Sign-in required?     Yes
How sign-in works:    Phone OTP (Twilio Verify) and/or Email OTP (Supabase Auth) — no password
In-app account delete path: Profile → Account & Security → Delete account
```

---

## 3. Legal URLs (must be live HTTPS)

| Page | URL | Live? |
| --- | --- | --- |
| Privacy policy | https://hyperionappstudio.com/rideangels/privacy/ | Yes (update + redeploy before submit if stale) |
| Support | https://hyperionappstudio.com/rideangels/support/ | Yes |
| Terms | https://hyperionappstudio.com/rideangels/terms/ | Yes (update + redeploy before submit if stale) |
| Account deletion instructions | https://hyperionappstudio.com/rideangels/support/ (Account and data requests) | Yes |
| SMS opt-in | https://hyperionappstudio.com/rideangels/sms-opt-in/ | Yes |
| Marketing / homepage | https://hyperionappstudio.com/rideangels/ | optional |

Repo mirrors: `docs/legal/` and studio `website/rideangels/`. Reviewers open the HTTPS URLs — a 404 fails review.

---

## 4. Listing copy (both stores)

See [LISTING.md](./LISTING.md) for paste-ready text and character counts.

### Names

```
App name: Ride Angels
Subtitle (iOS, 30): Trusted rides from loved ones
Short description (Play, 80): Trusted rides to appointments from family, friends, and neighbors.
Promotional text (iOS, 170): Need a lift to an appointment? Ask the people who already show up for you. Riders request. Ride Angels offer. Your circle stays in the loop.
```

### Full description / What’s New / Keywords

Copy from [LISTING.md](./LISTING.md).

### Screenshot shot list

Lived-in data, light mode, no “Test User”, no OTP screen, no Delete account.

| # | Screen | iPhone 6.9" (1320×2868) | Play phone (~1080×1920) |
| --- | --- | --- | --- |
| 1 | Welcome | | |
| 2 | Rider Home | | |
| 3 | Add Appointment (filled) | | |
| 4 | My Ride Angels | | |
| 5 | Angel — open request / On my way | | |

iPad 13" screenshots: binary supports iPad (`TARGETED_DEVICE_FAMILY = 1,2`). Provide iPad shots if Connect requires them for this listing. This is **not** iPhone-only.

### Graphics checklist

- [ ] iOS App Store icon 1024×1024, **no alpha**, no rounded corners
- [ ] Play hi-res icon 512×512 PNG (square; Play rounds it)
- [ ] Play feature graphic 1024×500, **no alpha**
- [ ] At least 2 Play phone screenshots
- [ ] iPhone 6.9" screenshots
- [ ] iPad 13" if required
- [ ] App preview video (optional)

---

## 5. Testing tracks

### Family / friends testing while production is pending

1. **Bump builds** (never reuse): next iOS build after `9`; next Android `versionCode` after `5` — see §10.
2. **iOS:** Archive → Upload → TestFlight **Internal** (and External if needed). Family on TestFlight install while App Review / production waits.
3. **Android:** Upload AAB to **Internal testing** (and **Closed testing** if your Play account still needs 12 testers / 14 days before production unlocks). Share the **opt-in link**; testers must accept before install.
4. Submit the **same marketing version** toward production on both stores when ready.

### Apple — TestFlight

```
Internal testers (App Store Connect users): Hyperion team + family Apple IDs added as internal/external
External testers needed?     Yes (family who are not App Store Connect users)
What to put in TestFlight test details:
  Sign in with phone OTP. Reviewer / tester phones: see supabase/seed/QA_TRIO.md
  (Riley +15555550101 / Avery +15555550102 / Blake +15555550103, code 123456).
  Or use your real number if Twilio Verify is live.
  First run: pick Rider or Ride Angel → Home.
  Rider: invite a circle member, add appointment, accept an offer.
  Angel: offer / claim, Call or Text, On my way.
  Do not use Delete account on shared QA accounts unless resetting.
Export compliance (encryption):  HTTPS only → ITSAppUsesNonExemptEncryption=false
```

- [ ] Internal TestFlight smoke (`docs/SMOKE.md`) on a physical device
- [ ] External / Beta App Review if people outside the ASC team need builds

### Google Play — tracks

Personal Play accounts created after 13 Nov 2023 often need **closed testing: 12 opted-in testers for 14 continuous days** before production.

```
Internal testers (Gmail list): family Gmail addresses on internal track
Closed testers (12+ if required): UNKNOWN — fill if production is locked
Open testing?     No (optional)
```

- [ ] Internal testing AAB uploaded (`versionName (versionCode)`)
- [ ] Testers opened the **opt-in link** and installed from Play
- [ ] Device smoke of that exact AAB
- [ ] Closed test started if production is still locked
- [ ] **AAB only** (no APK for a new upload)

---

## 6. Apple — App Store Connect forms

### App Information

```
Name: Ride Angels
Subtitle: Trusted rides from loved ones
Bundle ID: org.rideangels.app
SKU: ride-angels-ios
Primary language: English (U.S.)
Category: Lifestyle
Content rights: No, I do not use third-party content that requires rights clearance
Age rating: see questionnaire below
License: Apple Standard EULA
Copyright: 2026 Hyperion App Studio
```

### Age rating questionnaire (from the binary)

| Feature | Yes / No | Notes |
| --- | --- | --- |
| Unrestricted web access (in-app browser to arbitrary URLs) | No | |
| User-generated content | Yes | Appointments, notes, Feedback & ideas, profile |
| Messaging / chat | Yes | In-app notifications / invite flows; Call/Text open the phone dialer/SMS — not an in-app chat room |
| Advertising | No | |
| Gambling / contests | No | |
| Medical or treatment information | No | Coordinates rides to appointments; not clinical advice |
| Health or wellness topics | No | |
| Parental controls | No | |
| Age assurance | No | |
| Social networking | No | Private trusted circle only; public board hidden |
| Frequent/intense violence, horror, mature themes | No | |

Made for Kids: **No**.

### Pricing and Availability

```
Price: Free
Countries: All
Release: Automatic after approval (or Manual if you want a coordinated go-live)
Phased release (7-day)?     No for first public; optional later
```

### App Privacy (nutrition label)

Must match the privacy policy **and** SDKs. Not “Data Not Collected”.

| Data type | Collect? | Linked to user? | Tracking? | Purpose |
| --- | --- | --- | --- | --- |
| Name | Yes | Yes | No | App Functionality |
| Email | Yes | Yes | No | App Functionality |
| Phone | Yes | Yes | No | App Functionality |
| Physical address | No | — | — | Free-text pickup/destination labels only — not declared as Physical Address |
| Photos or videos | Yes | Yes | No | App Functionality (profile photo; optional feedback screenshots) |
| Audio | No | — | — | |
| User ID | Yes | Yes | No | App Functionality |
| Device ID | Yes | Yes | No | App Functionality (push tokens) |
| Product interaction | No | — | — | No analytics SDK |
| Other user content | Yes | Yes | No | App Functionality (rides, offers, notes, invites, Feedback & ideas) |
| Precise / coarse location | No | — | — | No GPS tracking |
| Health / fitness | No | — | — | |
| Purchases | No | — | — | |
| Crash data | No | — | — | No Crashlytics declared |
| Performance / diagnostics | No | — | — | |
| Advertising data | No | — | — | |

Sold to third parties: **No**.  
Used for tracking: **No**.

Privacy Policy URL: https://hyperionappstudio.com/rideangels/privacy/

### App Review Information

```
Contact name: Devin Cooper
Contact phone: UNKNOWN
Contact email: support@hyperionappstudio.com
Sign-in required: Yes
Demo username / phone: +15555550101 (Riley Rider) and/or +15555550102 (Avery Angel)
How reviewer gets OTP / password: Hosted Supabase test OTP 123456 for those numbers (Auth → Phone → Test phone numbers). No password.
First-run notes:
  After OTP, choose I’m a Rider or I’m a Ride Angel, then Home.
  Use Riley as rider and Avery as angel to demo invite → appointment → offer → Call/Text → On my way.
  Seed: supabase/seed/QA_TRIO.md. Push may need Profile → Enable push on device.
Anything hidden behind flags: Public/community board UI is hidden. Google Calendar OAuth is off. No Sign in with Apple/Google.
Attachments (optional): none
```

### Export compliance

```
Uses encryption: HTTPS/TLS only
ITSAppUsesNonExemptEncryption: false
```

### Capabilities that must match the binary

- [x] Push Notifications
- [ ] Associated Domains (N/A unless configured)
- [ ] Sign in with Apple (N/A — OTP only)
- [x] Background modes: remote-notification
- [ ] In-App Purchase
- [x] Camera / Photo library / Calendar — matching Info.plist:

```
NSCameraUsageDescription: Ride Angels uses the camera so you can take a profile photo.
NSPhotoLibraryUsageDescription: Ride Angels lets you choose a photo for your profile picture.
NSPhotoLibraryAddUsageDescription: Ride Angels can save photos you take for your profile picture.
NSCalendarsUsageDescription: Ride Angels adds claimed rides to your calendar so you don’t miss pickups.
NSCalendarsFullAccessUsageDescription: Ride Angels needs calendar access to create and update events for claimed rides, and so you can choose which calendar to use.
NSCalendarsWriteOnlyAccessUsageDescription: Ride Angels adds claimed rides to your calendar so you don’t miss pickups.
NSLocationWhenInUseUsageDescription: N/A (not in Info.plist)
```

---

## 7. Google Play — Console forms

### Create app / store settings

```
App name: Ride Angels
Default language: English (United States)
App or game: App
Free or paid: Free
Developer name (public): Hyperion App Studio / BARFLY ENTERPRISE LLC
Contact email: support@hyperionappstudio.com
Contact phone: UNKNOWN
Contact website: https://hyperionappstudio.com/rideangels/
```

### Store listing

```
Short description (80): Trusted rides to appointments from family, friends, and neighbors.
Full description (4000): see LISTING.md
App icon 512×512:
Feature graphic 1024×500:
Phone screenshots:
7" / 10" tablet screenshots: optional
Privacy policy URL: https://hyperionappstudio.com/rideangels/privacy/
```

### App category & tags

```
Category: Lifestyle
Tags: transportation, family (as available)
```

### Target audience

```
Target age: 18 and over (or 13+ if console options force a younger band — not child-directed)
Primarily child-directed?     No
Families policy?              No
```

### Content rating (IARC)

| Topic | None / Mild / Strong | Notes |
| --- | --- | --- |
| Violence | None | |
| Sexual content | None | |
| Profanity | None | |
| Controlled substances | None | |
| Gambling | None | |
| Horror / fear | None | |
| User interaction (UGC, chat, share) | Users can communicate / UGC | Private circle invites, ride notes, Feedback & ideas |
| Shares location | No | |
| Digital purchases | No | |
| Miscellaneous (unrestricted internet) | No | |

Expected rating: **Everyone** / **PEGI 3** / similar after IARC.

### Ads

```
Contains ads: No
```

### Advertising ID

```
Does any SDK use the advertising ID?     No
(Confirm merged manifest / Firebase; FCM for push only — declare no ads ID use)
```

### Data safety

| Data type | Collect? | Share with third parties? | Required / Optional | Purpose | Encrypted in transit? | Users can request delete? |
| --- | --- | --- | --- | --- | --- | --- |
| Name | Yes | No (processors only) | Optional | App functionality | Yes | Yes |
| Email | Yes | No (processors / Resend for invites) | Optional | App functionality | Yes | Yes |
| Phone | Yes | No (Twilio for OTP) | Optional | App functionality | Yes | Yes |
| Photos | Yes | No | Optional | App functionality | Yes | Yes |
| User IDs | Yes | No | Required | App functionality | Yes | Yes |
| Device or other IDs (push token) | Yes | Shared with Apple/Google push | Optional | App functionality | Yes | Yes |
| App activity | No | — | — | — | — | — |
| App info and performance | No | — | — | — | — | — |
| Location | No | — | — | — | — | — |
| Financial / payment | No | — | — | — | — | — |
| Health | No | — | — | — | — | — |
| Messages | Yes (invite / notification content) | No | Optional | App functionality | Yes | Yes |
| Files and docs | No | — | — | — | — | — |
| Calendar | No on our servers | — | — | Device calendar events stay on-device via OS APIs | — | — |
| Contacts | No | — | — | — | — | — |

Data deletion URL (Play): https://hyperionappstudio.com/rideangels/support/

### App access (sign-in required)

```
All functionality behind login?     Yes
Instructions: Use test phone + OTP below. After code, pick Rider or Ride Angel.
Test account: +15555550101 (rider) / +15555550102 (angel)
How to get OTP: 123456 (Supabase Auth test phone numbers)
```

### Other Play declarations

| Declaration | Yes / No |
| --- | --- |
| Government / political | No |
| Health | No |
| News | No |
| Financial features | No |
| Crypto | No |
| VPN / proxy | No |
| Foreground services that need extra disclosure | No |
| Photo/video permissions | Camera + Photo Picker; broad READ_MEDIA_* removed |
| Health Connect | No |
| COVID contact tracing | No |

### Production

```
Countries: All available
Release notes: see LISTING.md What’s New
Staged rollout % (first public: often 100): 100
```

- [ ] Dashboard / publishing overview is green
- [ ] Production not greyed out (closed-test 12–14 done if required)
- [ ] After live, install from the **public listing**, not the internal opt-in link

---

## 8. Monetization

```
Free / paid download: Free
In-app purchases:     None
Apple product IDs: N/A
Play product IDs / base plans: N/A
Free trial: N/A
Paywall screens in this binary?     No
Restore purchases path: N/A
```

Subscriptions may come later; ship free now. Do not claim paid features in listing.

---

## 9. Third parties (feeds privacy forms)

From [SERVICES.md](./SERVICES.md):

| Vendor | Why | Data | In privacy policy? |
| --- | --- | --- | --- |
| Supabase | Auth, database, Edge | Account, rides, invites, tokens | Yes |
| Twilio Verify | Phone OTP SMS | Phone number, OTP | Yes |
| Resend | Circle invite email | Invitee email, invite content | Yes |
| Apple APNs | iOS push | Device push token | Yes |
| Firebase / FCM | Android push | Device push token | Yes |
| ColorPing partner | Optional appointment ingest | Partner-linked appointment data when enabled | Mention if enabled for this release |

---

## 10. Version line (this upload)

| Store | Marketing | Build / versionCode | What changed |
| --- | --- | --- | --- |
| iOS (current in repo) | 1.0 | build **9** | Last uploaded baseline |
| Android (current in repo) | 1.0 | versionCode **5** | Last AAB baseline |
| **Next upload (bump first)** | 1.0 | iOS build **10+** / Android **6+** | V1 circle UX: phone invites, Call/Text, On my way, reminders, clearer modes, contact nudge, OTP leave-app fix |

Never reuse a build number. iOS build and Android `versionCode` do not need to match.

---

## 11. Ready? (testing → production)

### Testing

- [ ] Identity + this packet filled; UNKNOWNs listed below
- [ ] Legal URLs live with **September 2026** product privacy/terms (not SMS-only stubs)
- [ ] Production binary (no `server.url` / live-reload)
- [ ] iOS: TestFlight internal (+ external for family) smoke
- [ ] Android: Play internal smoke of the AAB testers will get

### First production

- [ ] Apple: age rating, privacy label, review notes, screenshots, build attached → Submit
- [ ] Play: listing, IARC, target audience, Data safety, ads, app access, closed test if required → Production
- [ ] Same marketing version on both stores

### After live

- [ ] Install from **App Store** and **Play Store** public listings
- [ ] Run `docs/SMOKE.md` once more on production backends

### Still UNKNOWN

- App Store Connect numeric Apple ID
- Play Console numeric app ID
- Review / Play contact phone number
- Closed-testing tester list (if production still locked on the Play account)
