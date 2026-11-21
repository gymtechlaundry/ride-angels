/**
 * places-autocomplete
 *
 * Proxies Google Places API (New) so the API key stays in Edge secrets.
 * Auth: caller JWT required.
 *
 * Body:
 *   { action: 'suggest', input: string, sessionToken?: string }
 *   { action: 'details', placeId: string, sessionToken?: string }
 *
 * Secret: GOOGLE_PLACES_API_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const placesKey = Deno.env.get('GOOGLE_PLACES_API_KEY') ?? '';
    if (!supabaseUrl || !anonKey) {
      return json({ error: 'Supabase env missing' }, 500);
    }
    if (!placesKey.trim()) {
      return json(
        {
          error: 'places_not_configured',
          message:
            'GOOGLE_PLACES_API_KEY is not set. Address suggestions are unavailable.',
        },
        503,
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? 'suggest').trim();
    const sessionToken = String(body.sessionToken ?? '').trim() || undefined;

    if (action === 'suggest') {
      const input = String(body.input ?? '').trim();
      if (input.length < 2) {
        return json({ suggestions: [] });
      }

      const res = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': placesKey,
            'X-Goog-FieldMask':
              'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
          },
          body: JSON.stringify({
            input,
            languageCode: 'en',
            includedRegionCodes: ['us'],
            ...(sessionToken ? { sessionToken } : {}),
          }),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[places] autocomplete error', res.status, text);
        return json(
          {
            error: 'places_upstream_error',
            status: res.status,
            message: text.slice(0, 400),
          },
          502,
        );
      }

      const data = (await res.json()) as {
        suggestions?: Array<{
          placePrediction?: {
            placeId?: string;
            text?: { text?: string };
            structuredFormat?: {
              mainText?: { text?: string };
              secondaryText?: { text?: string };
            };
          };
        }>;
      };

      const suggestions = (data.suggestions ?? [])
        .map((s) => {
          const p = s.placePrediction;
          if (!p?.placeId) return null;
          return {
            placeId: p.placeId,
            primaryText:
              p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
            secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
            fullText: p.text?.text ?? '',
          };
        })
        .filter((s): s is NonNullable<typeof s> => !!s && !!s.primaryText);

      return json({ suggestions });
    }

    if (action === 'details') {
      const placeId = String(body.placeId ?? '').trim();
      if (!placeId) {
        return json({ error: 'placeId is required' }, 400);
      }

      const url = new URL(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      );
      if (sessionToken) {
        url.searchParams.set('sessionToken', sessionToken);
      }

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': placesKey,
          'X-Goog-FieldMask':
            'id,formattedAddress,location,displayName,addressComponents',
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('[places] details error', res.status, text);
        return json({ error: 'places_upstream_error' }, 502);
      }

      const data = (await res.json()) as {
        id?: string;
        formattedAddress?: string;
        displayName?: { text?: string };
        location?: { latitude?: number; longitude?: number };
        addressComponents?: Array<{
          longText?: string;
          shortText?: string;
          types?: string[];
        }>;
      };

      const component = (type: string) =>
        data.addressComponents?.find((c) => c.types?.includes(type));

      return json({
        place: {
          placeId: data.id ?? placeId,
          formattedAddress: data.formattedAddress ?? '',
          displayName: data.displayName?.text ?? '',
          latitude: data.location?.latitude ?? null,
          longitude: data.location?.longitude ?? null,
          city:
            component('locality')?.longText ??
            component('sublocality')?.longText ??
            null,
          state: component('administrative_area_level_1')?.shortText ?? null,
          postalCode: component('postal_code')?.longText ?? null,
          line1:
            [
              component('street_number')?.longText,
              component('route')?.longText,
            ]
              .filter(Boolean)
              .join(' ') ||
            data.formattedAddress ||
            '',
        },
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[places] unexpected', err);
    return json({ error: 'internal_error' }, 500);
  }
});
