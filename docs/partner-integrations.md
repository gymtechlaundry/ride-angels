# Ride Angels partner integrations

Any external app (ColorPing today, others later) can:

1. **Link once** — verify the end user owns a Ride Angels account (OTP in Ride Angels).
2. **Ingest appointments** — create reporting/TIME_WINDOW appointments only for that verified pair.

Partner identity comes from the **API key**, not from a client-supplied `partnerId` (so apps can’t impersonate each other).

---

## One-time verification

Yes — verification is **one-time per partner ↔ Ride Angels profile**:

| Event | What happens |
| --- | --- |
| First link | User enters phone/email in partner app → code appears in Ride Angels notifications → user enters code in partner app |
| After success | `partner_account_links` stores `(partner_id, external_user_id, profile_id)` as `verified` |
| Later appointments | No new code — ingest checks the verified link |
| Unlink | Partner calls unlink (or Ride Angels revokes) → must verify again to recreate |

A Ride Angels profile can have at most one **active** verified link **per partner**. Linking again revokes the previous link for that partner.

---

## Adding a new partner app

1. Insert partner:

```sql
insert into public.integration_partners (id, name, api_key_hash, active)
values ('my_app', 'My App', 'UNSET', true);
```

2. Set API key (service role):

```sql
select public.set_partner_api_key('my_app', 'long-random-shared-secret');
```

3. Deploy (once):

```bash
supabase functions deploy partner-link
supabase functions deploy partner-ingest
```

4. Partner backend calls:

- `POST /functions/v1/partner-link` — `{ action, externalUserId, contact | challengeId, code }`
- `POST /functions/v1/partner-ingest` — appointment payload with `externalUserId` + verified `riderIdentity.profileId`

Auth header: `Authorization: Bearer <partner-api-key>`

---

## Security model

| Check | Rule |
| --- | --- |
| Who is the partner? | SHA-256 of API key → `integration_partners` |
| Who is the rider? | Only `profileId` from a **verified** `partner_account_links` row |
| Spoofed email? | Blocked — OTP is delivered in the Ride Angels account for that contact; attacker never sees it |
| Cross-partner abuse? | Links are scoped by `partner_id`; ColorPing link ≠ other app’s link |

---

## ColorPing

ColorPing is partner id `colorping`. Its Edge Functions call `partner-link` / `partner-ingest` with `RIDE_ANGELS_API_KEY` registered via `set_partner_api_key('colorping', …)`.

Legacy `colorping-link` / `colorping-ingest` function names remain as copies of the partner endpoints.
