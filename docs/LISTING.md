# Store listing — Ride Angels

Paste from this file into **App Store Connect** and **Google Play Console**.  
Full review packet / forms: [STORE-SUBMISSION.md](./STORE-SUBMISSION.md) · IDs: [IDENTITY.md](./IDENTITY.md) · Preflight: `npm run store:preflight`

Console limits: `~/Projects/hyperion-studio/Playbooks/store/README.md`.

---

## Paste checklist

### Google Play — Store listing
- [ ] App name: Ride Angels  
- [ ] Short description (below)  
- [ ] Full description (below)  
- [ ] App icon 512×512: `resources/play-icon-512.png`  
- [ ] Feature graphic 1024×500: `resources/play-feature-graphic-1024x500.png`  
- [ ] Phone screenshots (shot list below)  
- [ ] Privacy policy: `https://hyperionappstudio.com/rideangels/privacy/`  
- [ ] Category: Lifestyle  

### Google Play — This production release
- [ ] Release name: `1.0 (12)` (or current `versionCode`)  
- [ ] Release notes — use the `<en-US>` block under What’s New  
- [ ] Upload AAB + `android/app/build/outputs/mapping/release/mapping.txt`  

### App Store Connect — Version / listing
- [ ] Name: Ride Angels  
- [ ] Subtitle, promotional text, description, keywords, What’s New (below)  
- [ ] Support URL / Privacy URL / Marketing URL (below)  
- [ ] Screenshots (shot list) · App icon 1024: `ride-angels-final-exact-brand-kit/app-icons/app-icon-ios-1024.png`  
- [ ] This version: **1.0 (12)** (Waiting for Review). Xcode is at 13 for the next archive.  
- [ ] App Review Information notes (full block at bottom)  
- [ ] Contact: Devin Cooper · 904-556-1823 · support@hyperionappstudio.com  

---

## Names & short lines

**Name:** Ride Angels  
**Subtitle (iOS, 30):** No more last-minute asks  
**Short description (Play, 80):** Plan appointment rides with family and friends—so it’s not a last-minute ask.

**Promotional text (iOS, 170):**

```
Stop the last-minute scramble. Add the appointment, ask your circle, and know who’s driving—before the day arrives.
```

**URLs**

```
Support:  https://hyperionappstudio.com/rideangels/support/
Privacy:  https://hyperionappstudio.com/rideangels/privacy/
Terms:    https://hyperionappstudio.com/rideangels/terms/
Marketing: https://hyperionappstudio.com/rideangels/
```

---

## Full description (both stores)

```
Ride Angels helps families and friends decide in advance who’s driving each appointment—so rides stop falling on whoever answers the phone that morning.

This is for people you already trust: family, close friends, and neighbors who already help with rides. Not random drivers. Not last-minute chaos.

HOW IT WORKS
• Add an appointment (pickup, destination, date, notes)
• Invite your circle by email or phone
• Someone offers to drive; you accept
• Everyone sees who’s covering the trip
• Call, text, On my way, and reminders keep the day clear

FOR RIDERS (OR THE PERSON ORGANIZING)
• Put appointments on a shared plan before the week gets busy
• Notify trusted Ride Angels first
• Review offers and lock in a driver
• Stay updated from the in-app inbox and optional push

FOR RIDE ANGELS
• See open requests from people you support
• Offer when you can—share the load across the circle
• Keep upcoming drives on Home
• Call or text the rider; tap On my way when you leave
• Optionally add claimed rides to your device calendar

BUILT AROUND A CIRCLE OF TRUST
You invite people you know. They accept. Then rides are planned ahead instead of scrambled at the last minute.

Choose Rider or Ride Angel when you set up. Switch anytime in Profile—one account, both roles.

Sign in with a one-time code to your phone or email. No passwords.

Questions or account help: https://hyperionappstudio.com/rideangels/support/
```

---

## Keywords (iOS only)

```
ride,driver,appointment,caregiver,family,senior,volunteer,transport,carpool,trusted,medical
```

---

## What’s New / Play release notes

**Plain text** (App Store “What’s New” and TestFlight):

```
Plan rides ahead with your circle so appointments aren’t a last-minute scramble. Invite by phone or email, Call and Text from ride cards, On my way, and reminders. Clearer Rider / Ride Angel setup, a sharper Android app icon, and sign-in fixes so your one-time code still works if you leave for Messages or Mail.
```

**Play Console** (keep the language tags):

```
<en-US>
Plan rides ahead with your circle so appointments aren’t a last-minute scramble. Invite by phone or email, Call and Text from ride cards, On my way, and reminders. Clearer Rider / Ride Angel setup, a sharper Android app icon, and sign-in fixes so your one-time code still works if you leave for Messages or Mail.
</en-US>
```

---

## Screenshot shot list

Lived-in data, light mode. Skip OTP, empty lists, Delete account, and Feedback & ideas.

| # | Screen |
| --- | --- |
| 1 | Welcome — plan-ahead / trusted circle framing |
| 2 | Rider Home — upcoming rides planned |
| 3 | Add Appointment — filled title, date, pickup, destination |
| 4 | My Ride Angels — 2–3 trusted people |
| 5 | Angel mode — open request / On my way |

iPhone 6.9" required. Binary supports iPad — add iPad 13" if Connect requires it.

---

## App Review notes (App Store Connect → App Review Information)

Paste into **Notes**:

```
Thank you for reviewing Ride Angels.

HOW TO SIGN IN
Sign in or create an account with phone or email OTP. There is no password.
Demo phones (hosted test OTP 123456):
• +15555550101 — Riley Rider
• +15555550102 — Avery Angel

FIRST RUN
After OTP, choose I’m a Rider or I’m a Ride Angel, then Home.
One account can use both roles later via Profile → “Using the app as”.

WHAT TO TRY
1. Riley (Rider): invite Avery from My Ride Angels by email or phone (or use seeded circle).
2. Riley: Add an appointment (pickup, destination, date/time, notes).
3. Avery (Ride Angel): Open requests → offer / claim.
4. Riley: accept an offer.
5. Call or Text from the ride card; Avery can tap On my way.
6. Optional: device calendar for claimed rides; Profile → Enable push.
7. Delete account is in Profile → Account & Security (please use a disposable test account, not the shared QA phones if possible).

NOTES FOR REVIEW
• Public/community board UI is hidden in this binary.
• Google Calendar OAuth is off (device calendar only).
• No Sign in with Apple/Google; no passwords; no payments.
• Camera/Photos: optional profile picture (and Feedback & ideas screenshots).
• SMS is auth OTP only (not marketing).
• Product job: plan who’s driving each appointment with an existing trusted circle—so it is not a last-minute burden.

Contact: Devin Cooper · 904-556-1823 · support@hyperionappstudio.com
```

**Sign-in required:** Yes  
**Demo account:** `+15555550101` / OTP `123456` (also Avery `+15555550102`)

---

## Privacy / age (summary)

- Collect: name, email, phone, photos, other user content, user ID, device ID (push) — linked to identity, not tracking, App Functionality  
- Do not collect: precise location, ads, analytics SDKs, purchases  
- Age: UGC Yes · Messaging Yes · Made for Kids No  
- Account deletion: Profile → Account & Security → Delete account  

Details: [STORE-SUBMISSION.md](./STORE-SUBMISSION.md) §6–7 and live privacy URL above.
