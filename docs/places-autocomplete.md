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

Selected place’s `formattedAddress` is saved to `pickup_label` / `destination_label` (and street line to `*_line1`). Lat/lng / place id schema is a follow-up.
