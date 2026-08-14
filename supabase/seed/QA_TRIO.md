# QA trio seed

Three switchable login personas for Ride Angels UI/QA testing.

## Accounts

| Persona | Name | Phone | Roles | Default persona |
|---------|------|-------|-------|-----------------|
| Rider | Riley Rider | `+15555550101` | rider | rider |
| Angel | Avery Angel | `+15555550102` | rideAngel | angel |
| Both | Blake Both | `+15555550103` | rider + rideAngel | rider |

**Passcode:** `123456` (after test OTP is configured — see below).

Auth stores phones as digits only (`15555550101`). The app still sends E.164
(`+15555550101`) on login — that is expected and works with test OTP.

The app is OTP-only; there is no password login. The seed creates phone-confirmed auth users so these numbers can sign in once Supabase accepts the fixed OTP.

For **real SMS** (non-test numbers) on iOS/Android store builds, complete Twilio
toll-free verification first — see [`docs/phone-otp.md`](../../docs/phone-otp.md).

## Fixed OTP setup (required once)

### Hosted project (Dashboard)

1. Open **Authentication → Providers → Phone**
2. Add **Test phone numbers**:
   - `+15555550101` → `123456`
   - `+15555550102` → `123456`
   - `+15555550103` → `123456`

### Local (`supabase start`)

`supabase/config.toml` already maps those three numbers to `123456` under `[auth.sms.test_otp]`.

## Apply / cleanup

```bash
supabase db query --linked -f supabase/seed/qa_trio_seed.sql
supabase db query --linked -f supabase/seed/qa_trio_cleanup.sql
```

UUID namespace: `bbbbbbbb-cccc-4ddd-8eee-*` (safe alongside `angel_demo` seed).

## What the data covers

Dense **next ~2 weeks** for day-to-day flows, sparse **+21d … +90d** for calendar scroll, plus a few **past completed** rides:

- Riley open private (Avery or Blake can claim)
- Riley claimed by Avery / by Blake
- Riley public open + one with Avery’s pending offer
- Blake-as-rider open (for Avery to claim) and claimed
- Horizon opens for Blake-as-angel claim practice
- Trusted circle: Avery↔Riley, Avery↔Blake, Blake↔Riley
