/**
 * partner-link
 *
 * Verified account linking for any registered integration partner.
 * Partner is resolved from the API key (not client-supplied).
 *
 * Actions:
 *   { action: "start", externalUserId, contact }
 *   { action: "verify", externalUserId, challengeId, code }
 *   { action: "unlink", externalUserId }
 */

import {
  maskContact,
  partnerCorsHeaders,
  partnerJson,
  resolvePartnerFromRequest,
  serviceClient,
  sha256Hex,
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
    const action = String(body.action ?? '');
    const externalUserId = String(
      body.externalUserId ?? body.colorPingUserId ?? '',
    ).trim();

    if (!externalUserId) {
      return partnerJson({ error: 'externalUserId is required' }, 400);
    }

    if (action === 'start') {
      return partnerJson(
        await startLink(supabase, partnerId, externalUserId, body.contact),
      );
    }
    if (action === 'verify') {
      return partnerJson(
        await verifyLink(
          supabase,
          partnerId,
          externalUserId,
          String(body.challengeId ?? ''),
          String(body.code ?? ''),
        ),
      );
    }
    if (action === 'unlink') {
      return partnerJson(await unlinkAccount(supabase, partnerId, externalUserId));
    }

    return partnerJson({ error: 'Unknown action' }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const status =
      msg === 'Unauthorized'
        ? 401
        : msg === 'rider_not_found'
        ? 404
        : msg.startsWith('invalid_') ||
            msg.startsWith('expired_') ||
            msg.startsWith('too_many')
        ? 400
        : 500;
    if (status >= 500) console.error(err);
    return partnerJson({ error: msg }, status);
  }
});

async function startLink(
  supabase: ReturnType<typeof serviceClient>,
  partnerId: string,
  externalUserId: string,
  contactRaw: unknown,
) {
  const contact = String(contactRaw ?? '').trim();
  if (!contact) throw new Error('invalid_contact');

  const { data: rows, error } = await supabase.rpc('find_profile_for_invite', {
    identifier: contact,
  });
  if (error) throw new Error(error.message);
  const profile = Array.isArray(rows) ? rows[0] : rows;
  if (!profile?.id) throw new Error('rider_not_found');

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await supabase
    .from('partner_link_challenges')
    .update({ consumed_at: new Date().toISOString() })
    .eq('partner_id', partnerId)
    .eq('external_user_id', externalUserId)
    .is('consumed_at', null);

  const { data: challenge, error: insertError } = await supabase
    .from('partner_link_challenges')
    .insert({
      partner_id: partnerId,
      profile_id: profile.id,
      external_user_id: externalUserId,
      contact_submitted: contact,
      code_hash: codeHash,
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single();
  if (insertError) throw new Error(insertError.message);

  const partnerName = partnerId === 'colorping' ? 'ColorPing' : partnerId;

  await supabase.from('notifications').insert({
    recipient_profile_id: profile.id,
    type: 'partner_link_code',
    title: `${partnerName} link code`,
    body:
      `Your ${partnerName} account-link code is ${code}. ` +
      'Enter it in that app within 15 minutes. Do not share this code.',
    related_entity_type: 'partner_link',
    related_entity_id: challenge.id,
  });

  const debug =
    (Deno.env.get('PARTNER_LINK_DEBUG_CODE') ??
      Deno.env.get('COLORPING_LINK_DEBUG_CODE') ??
      '').toLowerCase() === 'true';

  return {
    ok: true,
    partnerId,
    challengeId: challenge.id,
    expiresAt: challenge.expires_at,
    maskedContact: maskContact(contact),
    delivery: 'ride_angels_notification',
    ...(debug ? { debugCode: code } : {}),
  };
}

async function verifyLink(
  supabase: ReturnType<typeof serviceClient>,
  partnerId: string,
  externalUserId: string,
  challengeId: string,
  code: string,
) {
  if (!challengeId || !/^\d{6}$/.test(code.trim())) {
    throw new Error('invalid_code');
  }

  const { data: challenge, error } = await supabase
    .from('partner_link_challenges')
    .select('*')
    .eq('id', challengeId)
    .eq('partner_id', partnerId)
    .eq('external_user_id', externalUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!challenge) throw new Error('invalid_challenge');
  if (challenge.consumed_at) throw new Error('expired_challenge');
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new Error('expired_challenge');
  }
  if (challenge.attempts >= challenge.max_attempts) {
    throw new Error('too_many_attempts');
  }

  const incomingHash = await sha256Hex(code.trim());
  if (incomingHash !== challenge.code_hash) {
    await supabase
      .from('partner_link_challenges')
      .update({ attempts: challenge.attempts + 1 })
      .eq('id', challenge.id);
    throw new Error('invalid_code');
  }

  // Free the partial unique (partner_id, profile_id) where status=verified
  // for other ColorPing users previously linked to this Ride Angels profile.
  await supabase
    .from('partner_account_links')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('partner_id', partnerId)
    .eq('profile_id', challenge.profile_id)
    .eq('status', 'verified')
    .neq('external_user_id', externalUserId);

  // UNIQUE (partner_id, external_user_id) survives unlink — must upsert, not insert.
  const now = new Date().toISOString();
  const { data: link, error: linkError } = await supabase
    .from('partner_account_links')
    .upsert(
      {
        partner_id: partnerId,
        profile_id: challenge.profile_id,
        external_user_id: externalUserId,
        status: 'verified',
        verified_at: now,
        revoked_at: null,
        updated_at: now,
      },
      { onConflict: 'partner_id,external_user_id' },
    )
    .select('id, profile_id, verified_at')
    .single();
  if (linkError) throw new Error(linkError.message);

  // Consume only after the link row is durable so a unique conflict can't burn the code.
  await supabase
    .from('partner_link_challenges')
    .update({
      consumed_at: now,
      attempts: challenge.attempts + 1,
    })
    .eq('id', challenge.id);

  const partnerName = partnerId === 'colorping' ? 'ColorPing' : partnerId;
  await supabase.from('notifications').insert({
    recipient_profile_id: challenge.profile_id,
    type: 'partner_link_code',
    title: `${partnerName} linked`,
    body: `Your Ride Angels account is now linked to ${partnerName}.`,
    related_entity_type: 'partner_link',
    related_entity_id: link.id,
  });

  return {
    ok: true,
    partnerId,
    profileId: link.profile_id,
    verifiedAt: link.verified_at,
  };
}

async function unlinkAccount(
  supabase: ReturnType<typeof serviceClient>,
  partnerId: string,
  externalUserId: string,
) {
  const { error } = await supabase
    .from('partner_account_links')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('partner_id', partnerId)
    .eq('external_user_id', externalUserId)
    .eq('status', 'verified');
  if (error) throw new Error(error.message);
  return { ok: true, partnerId, unlinked: true };
}
