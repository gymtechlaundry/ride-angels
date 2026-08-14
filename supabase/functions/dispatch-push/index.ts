/**
 * dispatch-push
 *
 * Sends APNs/FCM for a Ride Angels in-app notification when the recipient
 * has the type enabled in notification_preferences.
 *
 * Auth: x-push-secret matching RIDE_ANGELS_PUSH_SECRET
 *       or Authorization Bearer service role
 *
 * Body:
 *   { notificationId }
 *   or { recipientProfileId, type, title, body }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { dispatchPushForUser } from '../_shared/push.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-push-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    assertPushAuth(req);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Supabase env missing' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json();
    let recipientProfileId = String(body.recipientProfileId ?? '');
    let type = String(body.type ?? '');
    let title = String(body.title ?? '');
    let notifBody = String(body.body ?? '');
    let notificationId = body.notificationId
      ? String(body.notificationId)
      : null;

    if (notificationId) {
      const { data: row, error } = await supabase
        .from('notifications')
        .select('id, recipient_profile_id, type, title, body')
        .eq('id', notificationId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!row) return json({ error: 'Notification not found' }, 404);
      recipientProfileId = String(row.recipient_profile_id);
      type = String(row.type);
      title = String(row.title);
      notifBody = String(row.body);
    }

    if (!recipientProfileId || !title) {
      return json(
        { error: 'recipientProfileId and title are required' },
        400,
      );
    }

    const { data: enabled, error: prefError } = await supabase.rpc(
      'notification_type_enabled',
      { p_profile_id: recipientProfileId, p_type: type || 'unknown' },
    );
    if (prefError) {
      console.error('[dispatch-push] prefs check failed', prefError.message);
    } else if (enabled === false) {
      console.info('[dispatch-push] skipped type_disabled', {
        recipientProfileId,
        type,
        notificationId,
      });
      return json({ ok: true, skipped: true, reason: 'type_disabled' });
    }

    const result = await dispatchPushForUser(supabase, {
      userId: recipientProfileId,
      title,
      body: notifBody,
      data: {
        type: type || '',
        notificationId: notificationId ?? '',
      },
    });

    console.info('[dispatch-push] result', {
      recipientProfileId,
      type,
      notificationId,
      ...result,
    });

    return json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const status = msg === 'Unauthorized' ? 401 : 500;
    if (status >= 500) console.error(err);
    return json({ error: msg }, status);
  }
});

function assertPushAuth(req: Request): void {
  const expected = Deno.env.get('RIDE_ANGELS_PUSH_SECRET') ?? '';
  const headerSecret = (req.headers.get('x-push-secret') ?? '').trim();
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (expected && headerSecret && headerSecret === expected) return;
  if (serviceKey && bearer && bearer === serviceKey) return;

  if (!expected && !serviceKey) {
    console.warn('[dispatch-push] no auth secrets configured — allowing (dev)');
    return;
  }

  throw new Error('Unauthorized');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
