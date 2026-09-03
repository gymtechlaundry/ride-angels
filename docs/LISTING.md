# Store listing — Ride Angels

Console field limits: `~/Projects/hyperion-studio/Playbooks/store/README.md`. iOS and Android are independent.

Paste into App Store Connect / Play Console from here. Full review packet: [STORE-SUBMISSION.md](./STORE-SUBMISSION.md).

**Name:** Ride Angels  
**Subtitle (iOS, 30):** Trusted rides from loved ones  
**Short description (Play, 80):** Trusted rides to appointments from family, friends, and neighbors.

**Promotional text (iOS, 170):**

```
Need a lift to an appointment? Ask the people who already show up for you. Riders request. Ride Angels offer. Your circle stays in the loop.
```

**Full description:**

```
Ride Angels helps you get to appointments with the people you already trust — family, close friends, and neighbors who have offered to drive.

Create a ride request, notify your circle, and let someone you know claim the trip. Trips stay private to your trusted Ride Angels.

FOR RIDERS
• Add an appointment with pickup, destination, date, and notes
• Invite Ride Angels by email or phone
• Notify your trusted circle first when you need a ride
• Review ride offers and accept the driver you want
• Call or text your Ride Angel from the ride card
• Get On my way updates and reminders so pickups stay clear
• Stay updated from the in-app inbox and optional push notifications

FOR RIDE ANGELS
• See open requests from people you support
• Offer to drive when you can
• Keep confirmed trips on Home under upcoming drives
• Call or text the rider, and tap On my way when you leave
• Optionally add claimed rides to your device calendar so pickups are on your schedule

BUILT AROUND A CIRCLE OF TRUST
Ride Angels are not random drivers. You invite people you know. They accept. Then they are first in line when you need a ride.

Choose Rider or Ride Angel when you set up the app. Switch anytime in Profile — one account, both roles.

Ride Angels uses a one-time code to verify your phone or email. No passwords to remember.

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
| 1 | Welcome — “Trusted rides with the people who care” |
| 2 | Rider Home — upcoming rides + contact method card (or appointments) |
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
