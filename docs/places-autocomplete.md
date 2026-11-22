# Address autocomplete (Google Places)

Schedule form pickup/destination fields suggest real addresses as you type.

## Architecture

- UI: `src/app/shared/components/address-autocomplete/`
- Client: `PlacesService` → Supabase Edge Function `places-autocomplete`
- Upstream: Google Places API (New) Autocomplete + Place Details
- API key stays in Edge secrets (`GOOGLE_PLACES_API_KEY`) — never in `environment.ts`

## Setup

1. Google Cloud Console → enable **Places API (New)**.
2. Create an API key restricted to Places API (New).
3. Store in 1Password: `Hyperion / ride-angels / Google Places API key`.
4. Set Edge secret and deploy:

```bash
supabase secrets set \
  GOOGLE_PLACES_API_KEY='your-key' \
  --project-ref zuvfzmpdmjwewcuyxtac

supabase functions deploy places-autocomplete \
  --project-ref zuvfzmpdmjwewcuyxtac
```

Without the secret, typing still works as free text; suggestions stay empty (function returns `places_not_configured`).

## Persistence

- Address text (Places `formattedAddress` or typed value) → `pickup_line1` / `destination_line1`
- Optional nickname (“Home”, “Clinic”) → `pickup_label` / `destination_label` when set; otherwise label matches line1
- Cards prefer the nickname; detail shows nickname + full address when they differ
- Lat/lng / place id / saved-places table are follow-ups
