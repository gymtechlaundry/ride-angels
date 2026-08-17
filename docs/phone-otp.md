# Phone OTP (iOS / Android)

Ride Angels phone sign-in uses **Supabase Auth → Twilio Verify**. The Capacitor
app is the same on iOS and Android; delivery failures are almost always Twilio /
Dashboard config, not platform-specific code.

App flow: [`src/app/core/services/auth.service.ts`](../src/app/core/services/auth.service.ts)
normalizes to E.164 (`+1…`) then calls `signInWithOtp` / `verifyOtp`. **No app
code change** is required when switching SMS providers in Supabase.

```mermaid
flowchart LR
  App[iOS_or_Android] --> GoTrue[Supabase_Auth]
  GoTrue --> Verify[Twilio_Verify]
  Verify --> Carrier[Carrier]
  Carrier --> Phone[User_phone]
```

---

## Why Twilio Verify (not Twilio Messaging)

US **toll-free Messaging** verification for `+18559705852` was **rejected**
(Twilio reason **30526** — high-risk domain). That path cannot be resubmitted on
the same domain.

**Twilio Verify** is the right OTP product:

- Built for one-time codes (not marketing / conversation SMS)
- Uses a **Verify Service** (`VA…` SID), not your toll-free From number
- Avoids Toll-Free Messaging Verification for Auth OTP
- Same Supabase client APIs (`signInWithOtp` / `verifyOtp`)

Keep the rejected toll-free number released/deleted in Twilio if you no longer
need it for Messaging. Do **not** put that number in the Verify Supabase fields.

---

## Status checklist

| Step | Status |
|------|--------|
| App OTP send/verify | Done (shared iOS/Android code) |
| Supabase Phone + QA test OTPs | Live — `+15555550101`…`103` → `123456` (`message_id: test-otp`) |
| Twilio Verify Service + Supabase provider | Done — Service `VAe0461acfec2df955fb4a91a7a51319ca` (`Ride Angels OTP`); hosted Phone provider = `twilio_verify` |
| Device smoke on TestFlight / Play Internal | Use test OTPs until Verify is wired; then real SMS |

---

## 1. Create a Twilio Verify Service

1. Open [Twilio Console → Verify → Services](https://console.twilio.com/us1/develop/verify/services)
2. **Create new** service
   - Friendly name: `Ride Angels OTP`
   - Enable **SMS**
   - Leave Fraud Guard on (recommended)
3. Copy the **Service SID** (starts with `VA`)
4. From Account Dashboard, copy **Account SID** and **Auth Token**

Trial accounts can only SMS **verified** personal numbers until you upgrade.
Add your handset under Twilio → Phone Numbers → Verified Caller IDs if needed.

---

## 2. Supabase Phone provider (Twilio Verify)

Project: `zuvfzmpdmjwewcuyxtac`

1. Dashboard → **Authentication → Providers → Phone**
2. Enable **Phone**
3. SMS provider: **Twilio Verify** (not “Twilio”)
4. Paste:
   - **Twilio Account SID**
   - **Twilio Auth Token**
   - **Twilio Verify Service SID** (`VA…`) — *not* a Messaging Service / phone SID
5. Save
6. Disable / clear the old **Twilio** (Messaging) provider fields if still filled so Auth does not keep trying the rejected toll-free path

Never put Twilio credentials in the Ionic app (`environment*.ts` only gets
Supabase URL + anon key).

Official reference: [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login)

---

## 3. Test phone numbers (immediate device testing)

Use **Authentication → Providers → Phone → Test phone numbers** anytime you need
OTP without burning Verify credits.

| Phone (E.164) | OTP | Purpose |
|---------------|-----|---------|
| `+15555550101` | `123456` | QA Riley (rider) — see [`supabase/seed/QA_TRIO.md`](../supabase/seed/QA_TRIO.md) |
| `+15555550102` | `123456` | QA Avery (angel) |
| `+15555550103` | `123456` | QA Blake (both) |

Hosted Auth already returns `message_id: "test-otp"` for these numbers.

Add your own device numbers temporarily the same way for TestFlight / Play
Internal, then remove when real Verify SMS works.

**Auth phone format:** GoTrue stores phones as digits-only (`15555550101`). The
app sends E.164 (`+15555550101`) — that pairing is expected.

Local CLI `config.toml` maps the same trio under `[auth.sms.test_otp]`. For local
GoTrue + Verify, enable `[auth.sms.twilio_verify]` and set env
`SUPABASE_AUTH_SMS_TWILIO_VERIFY_AUTH_TOKEN` (hosted Dashboard is the source of
truth for production).

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

### After Twilio Verify is configured

Repeat with a **real** handset number (not on the test list). If SMS fails:

1. Twilio → **Monitor → Logs → Verify** (not Messaging)  
2. Supabase → **Authentication** logs  
3. Confirm Phone provider is **Twilio Verify** with a `VA…` Service SID  
4. Trial Twilio: confirm the destination number is a Verified Caller ID  

---

## 5. Legacy: toll-free Messaging (do not use for OTP)

Previous runbook targeted Twilio **Programmable Messaging** From `+18559705852`
and Toll-Free Verification. That verification was rejected (**30526**). Prefer
Verify above. Legal drafts for a future Messaging / marketing use case still live
under [`docs/legal/`](./legal/).

---

## Related docs

- [supabase-setup.md](./supabase-setup.md) — Dashboard overview  
- [authentication.md](./authentication.md) — register vs sign-in intents  
- [testflight.md](./testflight.md) / [android-testing.md](./android-testing.md) — store builds  
