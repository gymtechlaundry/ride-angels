/**
 * send-circle-invite
 *
 * Emails a family circle invite via Resend.
 * Body: { inviteId: string } — caller JWT must own the invite (rider).
 *
 * Secrets: RESEND_API_KEY, optional RESEND_FROM (default Hyperion noreply).
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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Supabase env missing' }, 500);
    }
    if (!resendKey) {
      return json({ error: 'RESEND_API_KEY not configured' }, 500);
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

    const body = await req.json();
    const inviteId = String(body.inviteId ?? '').trim();
    if (!inviteId) {
      return json({ error: 'inviteId is required' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, display_name')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (profileError || !profile?.id) {
      return json({ error: 'profile_not_found' }, 400);
    }

    const { data: invite, error: inviteError } = await admin
      .from('circle_invites')
      .select(
        'id, token, email, relationship_label, status, expires_at, rider_id',
      )
      .eq('id', inviteId)
      .maybeSingle();
    if (inviteError || !invite) {
      return json({ error: 'invite_not_found' }, 404);
    }
    if (invite.rider_id !== profile.id) {
      return json({ error: 'forbidden' }, 403);
    }
    if (invite.status !== 'pending') {
      return json({ error: 'invite_not_pending' }, 400);
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return json({ error: 'invite_expired' }, 400);
    }

    const inviteUrl =
      `https://hyperionappstudio.com/rideangels/invite/${invite.token}`;
    const inviterName =
      String(profile.display_name || '').trim() || 'Someone in your family';
    const from =
      Deno.env.get('RESEND_FROM')?.trim() ||
      'Ride Angels <noreply@hyperionappstudio.com>';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; line-height: 1.5; color: #1a1a1a;">
        <p><strong>${escapeHtml(inviterName)}</strong> invited you to be a Ride Angel in their trusted circle on Ride Angels.</p>
        <p>Ride Angels helps family and close friends coordinate rides to appointments — private to your circle, not a public rideshare board.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;background:#6C47FF;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:600;">Accept invite</a></p>
        <p style="font-size:14px;color:#555;">Or open this link:<br/><a href="${inviteUrl}">${inviteUrl}</a></p>
        <p style="font-size:13px;color:#777;">On Android, this opens the Play Store if you need the app. iOS App Store listing is rolling out — TestFlight testers can open the link after installing.</p>
      </div>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [invite.email],
        subject: `${inviterName} invited you to Ride Angels`,
        html,
        text:
          `${inviterName} invited you to be a Ride Angel in their trusted circle.\n\n` +
          `Open this link to join: ${inviteUrl}\n`,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend error', resendRes.status, errText);
      return json({ error: 'email_send_failed', detail: errText }, 502);
    }

    const resendBody = await resendRes.json();
    return json({
      ok: true,
      email: invite.email,
      inviteUrl,
      resendId: resendBody?.id ?? null,
    });
  } catch (err) {
    console.error(err);
    return json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      500,
    );
  }
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
