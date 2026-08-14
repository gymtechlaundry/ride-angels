/**
 * partner-ingest
 *
 * Create a Ride Angels appointment (optional private ride) for a verified
 * partner↔profile link. Partner is resolved from the API key.
 *
 * Requires: externalReference, externalUserId, riderIdentity.profileId, appointment
 */

import {
  partnerCorsHeaders,
  partnerJson,
  resolvePartnerFromRequest,
  serviceClient,
} from '../_shared/partner-auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: partnerCorsHeaders });
  }
  if (req.method !== 'POST') {
    return partnerJson({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabase = serviceClient();
    const { partnerId } = await resolvePartnerFromRequest(req, supabase);
    const body = await req.json();

    const externalUserId = String(
      body.externalUserId ?? body.colorPingUserId ?? '',
    ).trim();

    if (!body?.externalReference) {
      return partnerJson({ error: 'externalReference is required' }, 400);
    }
    if (!externalUserId) {
      return partnerJson({ error: 'externalUserId is required' }, 400);
    }
    if (!body?.riderIdentity?.profileId) {
      return partnerJson(
        { error: 'riderIdentity.profileId is required (verified link only)' },
        400,
      );
    }
    if (!body?.appointment?.date || !body?.appointment?.time) {
      return partnerJson(
        { error: 'appointment.date and appointment.time are required' },
        400,
      );
    }

    const payload = {
      ...body,
      partnerId,
      externalUserId,
      source: body.source ?? partnerId.toUpperCase(),
    };

    const { data, error } = await supabase.rpc('ingest_partner_appointment', {
      payload,
    });

    if (error) {
      const msg = error.message ?? 'ingest failed';
      const status =
        msg.includes('rider_not_found') || msg.includes('account_link_not_verified')
          ? 403
          : msg.includes('_required') || msg.includes('partner_not_found')
          ? 400
          : 500;
      return partnerJson({ error: msg }, status);
    }

    return partnerJson({ ok: true, partnerId, ...(data as Record<string, unknown>) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const status = msg === 'Unauthorized' ? 401 : 500;
    if (status >= 500) console.error(err);
    return partnerJson({ error: msg }, status);
  }
});
