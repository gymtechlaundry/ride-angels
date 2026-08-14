# Phone OTP (iOS / Android)

Ride Angels phone sign-in uses **Supabase Auth → Twilio SMS**. The Capacitor app
is the same on iOS and Android; delivery failures are almost always Twilio /
Dashboard config, not platform-specific code.

App flow: [`src/app/core/services/auth.service.ts`](../src/app/core/services/auth.service.ts)
normalizes to E.164 (`+1…`) then calls `signInWithOtp` / `verifyOtp`.

```mermaid
flowchart LR
  App[iOS_or_Android] --> GoTrue[Supabase_Auth]
  GoTrue --> Twilio[Twilio_SMS]
  Twilio -->|"needs TFN verified"| Carrier[Carrier]
  Carrier --> Phone[User_phone]
```

---

## Status checklist

| Step | Status |
|------|--------|
| App OTP send/verify | Done (shared iOS/Android code) |
| Supabase Phone + QA test OTPs | Live — `+15555550101`…`103` → `123456` (`message_id: test-otp`) |
| Twilio toll-free messaging verification for `+18559705852` | **You must submit** in Twilio Console (blocks real SMS) |
| Device smoke on TestFlight / Play Internal | Use test OTPs now; real SMS after TFN Approved |

---

## 1. Twilio toll-free messaging verification (required for real SMS)

**Number in use:** `(855) 970-5852` → E.164 `+18559705852`

If the Twilio number page shows a red banner:

> Toll-free verification for messaging is required…

**outbound OTP will not deliver** until verification is **Approved**.

### Step 1/2 — Business and contact (matches Console form)

| Field | Value |
|-------|--------|
| Business profile | Ride Angels (existing ISV / BU profile) |
| Legal entity name | Ride Angels |
| Website URL | `https://hyperionappstudio.com` (or `https://rideangels.org` when live) |
| Business type | Sole Proprietor |
| Business DBA | Devin Cooper |

Business address / contact should match the Trust Hub profile (already filled).

### Step 2/2 — Messaging use case (paste these)

| Field | Value |
|-------|--------|
| Estimated monthly volume | `1,000` (fine for early launch) |
| Opt-in type | Prefer **Website** if available; **Mobile / QR Code** is OK if that is the closest match for in-app entry |
| Messaging use case categories | `Two-Factor Authentication` (or `Account Notifications` / OTP — pick the OTP/2FA category in the picker) |
| Proof of consent (opt-in) collected | Host [`docs/legal/ride-angels-sms-opt-in.md`](./legal/ride-angels-sms-opt-in.md) publicly, **or** paste a public URL to a screenshot of the in-app phone screen. Temporary: upload the markdown / PDF to a public Drive/Dropbox link |
| Use case description | see block below |
| Sample message | `Your Ride Angels code is: 123456` |
| E-mail for notifications | `looking@devincoopers.space` |
| Additional information | `Transactional OTP only. No marketing, no promotional SMS. Users enter their own number in the Ride Angels iOS/Android app.` |
| Opt-In Confirmation Message | *(leave blank — OTP is the message)* |
| Help Message Sample | `Ride Angels: For help with sign-in codes, contact looking@devincoopers.space or reply HELP. Msg&data rates may apply.` |
| Privacy Policy URL | Host [`docs/legal/ride-angels-privacy.md`](./legal/ride-angels-privacy.md) publicly (required) |
| Terms & Conditions URL | Host [`docs/legal/ride-angels-terms.md`](./legal/ride-angels-terms.md) publicly (required) |
| Opt-In Keywords | *(optional)* `START` |
| Contains Age Gated Content | **Unchecked** |
| Terms of Service Agreement | **Checked** |

**Use case description** (copy/paste):

```text
Ride Angels is a mobile app (iOS and Android) that helps people coordinate
trusted rides to appointments. We send SMS only as transactional one-time
passcodes when a user creates an account or signs in with their phone number.
The user types their own mobile number in the app and taps Continue to request
the code. We do not send marketing or promotional messages. Message frequency
is limited to authentication events. Reply STOP to opt out; reply HELP for help.
```

### Hosting the legal URLs (required for Submit)

Twilio needs **https** URLs for privacy, terms, and opt-in proof. Repo drafts live under
[`docs/legal/`](./legal/). Publish them somewhere public before clicking
**Send information for verification**, for example:

1. GitHub → upload the three files to a public repo / GitHub Pages, **or**
2. Add matching pages on `https://hyperionappstudio.com`, **or**
3. Export to PDF and use a public share link (weaker; Pages preferred)

Then paste those live URLs into the form fields.

### After submit

1. Wait for **Approved** (often several business days).
2. Confirm Supabase **Authentication → Phone** still has Twilio SID/token and From `+18559705852`.
3. Retest OTP with a real handset number (not a test OTP number).

Optional (unrelated to OTP): accept emergency calling terms / add emergency address to clear the orange Console banners.

**Inbound messaging webhooks** on the number’s Configure tab are not required for
Supabase Auth OTP (Supabase sends *outbound* SMS via the Twilio REST API).

---

## 2. Supabase Phone provider (Twilio)

Project: `zuvfzmpdmjwewcuyxtac`

1. Dashboard → **Authentication → Providers → Phone**
2. Enable **Phone** (already used by hosted test OTP)
3. SMS provider: **Twilio**
4. Paste:
   - **Twilio Account SID**
   - **Twilio Auth Token**
   - **Message Service SID** *or* From number `+18559705852`
5. Save

Never put Twilio credentials in the Ionic app (`environment*.ts` only gets
Supabase URL + anon key).

Official reference: [Supabase phone login (Twilio)](https://supabase.com/docs/guides/auth/phone-login?showSMSProvider=Twilio)

---

## 3. Test phone numbers (immediate device testing)

While toll-free verification is pending, use **Authentication → Providers → Phone → Test phone numbers**.
Supabase accepts the fixed code **without sending SMS**.

| Phone (E.164) | OTP | Purpose |
|---------------|-----|---------|
| `+15555550101` | `123456` | QA Riley (rider) — see [`supabase/seed/QA_TRIO.md`](../supabase/seed/QA_TRIO.md) |
| `+15555550102` | `123456` | QA Avery (angel) |
| `+15555550103` | `123456` | QA Blake (both) |

Hosted Auth already returns `message_id: "test-otp"` for these numbers.

Add your own device numbers temporarily the same way (e.g. `+1XXXXXXXXXX` → `123456`)
for TestFlight / Play Internal builds, then remove when real SMS works.

**Auth phone format:** GoTrue stores phones as digits-only (`15555550101`). The app
sends E.164 (`+15555550101`) — that pairing is expected.

---

## 4. Device smoke checklist

Use a **release** sync (no live-reload `server.url`):

```bash
npm run build:ios:release    # then archive / TestFlight
npm run build:android:release
# AAB: cd android && bash ../scripts/android-with-jdk.sh ./gradlew :app:bundleRelease
```

On each platform:

1. **Register** with a test (or real) phone → enter OTP → finish onboarding  
2. Sign out  
3. **Sign in** with the same phone → OTP again  
4. Confirm no white screen / network errors talking to `*.supabase.co`

Quick API check (hosted test number):

```bash
curl -sS -X POST "$SUPABASE_URL/auth/v1/otp" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+15555550101","create_user":false}'
# expect: {"message_id":"test-otp"}
```

### After TFN is Approved

Repeat with a **real** handset number (not on the test list). If SMS fails:

1. Twilio → **Monitor → Logs → Messaging** (error codes / TFN not verified)  
2. Supabase → **Authentication** logs  
3. Confirm Phone provider From / Messaging Service matches the verified number  

---

## Related docs

- [supabase-setup.md](./supabase-setup.md) — Dashboard overview  
- [authentication.md](./authentication.md) — register vs sign-in intents  
- [testflight.md](./testflight.md) / [android-testing.md](./android-testing.md) — store builds  
