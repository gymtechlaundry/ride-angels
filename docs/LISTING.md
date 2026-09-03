# Store listing — Ride Angels

Console field limits: `~/Projects/hyperion-studio/Playbooks/store/README.md`. iOS and Android are independent.

Paste into App Store Connect / Play Console from here. Full review packet: [STORE-SUBMISSION.md](./STORE-SUBMISSION.md).

**Name:** Ride Angels  
**Subtitle (iOS, 30):** No more last-minute asks  
**Short description (Play, 80):** Plan appointment rides with family and friends—so it’s not a last-minute ask.

**Promotional text (iOS, 170):**

```
Stop the last-minute scramble. Add the appointment, ask your circle, and know who’s driving—before the day arrives.
```

**Full description:**

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

**Keywords (iOS):**

```
ride,driver,appointment,caregiver,family,senior,volunteer,transport,carpool,trusted,medical
```

**What’s New (this resubmit — TestFlight / Play test + production):**

```
Trusted-circle upgrades for family testing: invite by phone or email, Call and Text from ride cards, On my way for your circle, and ride reminders. Clearer Rider / Ride Angel setup, a Home prompt to add a backup contact method, and sign-in fixes so your one-time code still works if you leave the app for Messages or Mail.
```

## Screenshot shot list

Lived-in data, light mode. Skip OTP, empty lists, Delete account, and Feedback & ideas.

| # | Screen |
| --- | --- |
| 1 | Welcome — plan-ahead / trusted circle framing |
| 2 | Rider Home — upcoming rides planned (not empty scramble) |
| 3 | Add Appointment — filled title, date, pickup, destination |
| 4 | My Ride Angels — 2–3 trusted people |
| 5 | Angel mode — Open requests / On my way on a claimed ride |

iPhone 6.9" required. Binary also supports iPad (`TARGETED_DEVICE_FAMILY` 1,2) — include iPad 13" shots if App Store Connect requires them for this app.

## Review / privacy (this app)

- Sign-in required: **Yes**. OTP only (phone or email). QA: `supabase/seed/QA_TRIO.md`
- Age rating: User-Generated Content **Yes** (appointments, notes, Feedback & ideas); Messaging **Yes** (in-app notifications / invites, not open chat); not Made for Kids
- Privacy: collect name, email, phone, photos, other user content, user ID, device ID (push) — linked to identity, not tracking, app functionality. No precise location / ads / analytics SDKs / purchases declared.
- Account deletion: Profile → Account & Security → Delete account (in-app required)
- Legal URLs must stay live: [IDENTITY.md](./IDENTITY.md)
