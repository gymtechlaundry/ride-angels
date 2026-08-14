/**
 * Push dispatch for Ride Angels (APNs + FCM HTTP v1).
 * Badge count = unread in-app notifications (read_at IS NULL).
 *
 * Secrets (optional — skip send if missing):
 * - APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_P8_KEY
 * - APNS_PRODUCTION=true for App Store / TestFlight production APNs
 * - FCM_SERVICE_ACCOUNT_JSON — Firebase service account JSON (FCM HTTP v1)
 * - FCM_SERVER_KEY — legacy only (ignored when service account is set)
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import * as jose from 'https://esm.sh/jose@5';

type FcmServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

let cachedFcmAccess:
  | { token: string; expiresAtMs: number; projectId: string }
  | null = null;

export async function dispatchPushForUser(
  supabase: SupabaseClient,
  params: {
    userId: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    /** Override; defaults to unread rows for this profile */
    badge?: number;
  },
): Promise<{
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: string;
}> {
  const { data: tokens, error } = await supabase
    .from('device_push_tokens')
    .select('token, platform')
    .eq('user_id', params.userId);

  if (error) {
    console.error('[push] token load failed', error.message);
    return { sent: 0, failed: 0, skipped: true };
  }

  const rows = (tokens ?? []) as Array<{ token: string; platform: string }>;
  if (rows.length === 0) {
    console.info('[push] skipped — no device_push_tokens for user', params.userId);
    return { sent: 0, failed: 0, skipped: true, reason: 'no_tokens' };
  }

  const badge =
    typeof params.badge === 'number'
      ? Math.max(0, Math.floor(params.badge))
      : await countUnreadNotifications(supabase, params.userId);

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      if (row.platform === 'ios') {
        const ok = await sendApns(
          row.token,
          params.title,
          params.body,
          badge,
          params.data,
        );
        if (ok) sent += 1;
        else failed += 1;
      } else if (row.platform === 'android') {
        const ok = await sendFcm(
          row.token,
          params.title,
          params.body,
          badge,
          params.data,
        );
        if (ok) sent += 1;
        else failed += 1;
      } else {
        failed += 1;
      }
    } catch (err) {
      console.error('[push] send failed', row.platform, err);
      failed += 1;
    }
  }

  return { sent, failed, skipped: false };
}

async function countUnreadNotifications(
  supabase: SupabaseClient,
  profileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_profile_id', profileId)
    .is('read_at', null);

  if (error) {
    console.error('[push] unread count failed', error.message);
    return 0;
  }
  return count ?? 0;
}

async function sendApns(
  deviceToken: string,
  title: string,
  body: string,
  badge: number,
  data?: Record<string, string>,
): Promise<boolean> {
  const keyId = Deno.env.get('APNS_KEY_ID') ?? '';
  const teamId = Deno.env.get('APNS_TEAM_ID') ?? '';
  const bundleId = Deno.env.get('APNS_BUNDLE_ID') ?? '';
  const p8 = (Deno.env.get('APNS_P8_KEY') ?? '').replace(/\\n/g, '\n');
  const production =
    (Deno.env.get('APNS_PRODUCTION') ?? '').toLowerCase() === 'true' ||
    Deno.env.get('APNS_PRODUCTION') === '1';

  if (!keyId || !teamId || !bundleId || !p8) {
    console.warn('[push] APNs secrets not configured — skip iOS send');
    return false;
  }

  const privateKey = await jose.importPKCS8(p8, 'ES256');
  const jwt = await new jose.SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(privateKey);

  const host = production
    ? 'https://api.push.apple.com'
    : 'https://api.sandbox.push.apple.com';

  const payload = {
    aps: {
      alert: { title, body },
      sound: 'default',
      badge,
    },
    ...data,
  };

  const res = await fetch(`${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[push] APNs error', res.status, text);
    return false;
  }
  return true;
}

async function sendFcm(
  deviceToken: string,
  title: string,
  body: string,
  badge: number,
  data?: Record<string, string>,
): Promise<boolean> {
  const sa = readFcmServiceAccount();
  if (sa) {
    return sendFcmV1(sa, deviceToken, title, body, badge, data);
  }

  // Legacy fallback for older projects that still have a Server key.
  const serverKey = Deno.env.get('FCM_SERVER_KEY') ?? '';
  if (!serverKey) {
    console.warn(
      '[push] FCM_SERVICE_ACCOUNT_JSON (or FCM_SERVER_KEY) not configured — skip Android send',
    );
    return false;
  }
  return sendFcmLegacy(serverKey, deviceToken, title, body, badge, data);
}

function readFcmServiceAccount(): FcmServiceAccount | null {
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') ?? '';
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as FcmServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      console.error('[push] FCM_SERVICE_ACCOUNT_JSON missing required fields');
      return null;
    }
    return {
      ...parsed,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch (err) {
    console.error('[push] FCM_SERVICE_ACCOUNT_JSON parse failed', err);
    return null;
  }
}

async function getFcmAccessToken(
  sa: FcmServiceAccount,
): Promise<{ token: string; projectId: string } | null> {
  const now = Date.now();
  if (
    cachedFcmAccess &&
    cachedFcmAccess.projectId === sa.project_id &&
    cachedFcmAccess.expiresAtMs > now + 60_000
  ) {
    return {
      token: cachedFcmAccess.token,
      projectId: cachedFcmAccess.projectId,
    };
  }

  try {
    const privateKey = await jose.importPKCS8(sa.private_key, 'RS256');
    const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
    const assertion = await new jose.SignJWT({
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience(tokenUri)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[push] FCM OAuth error', res.status, text);
      return null;
    }
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      console.error('[push] FCM OAuth missing access_token');
      return null;
    }
    const expiresInSec = json.expires_in ?? 3600;
    cachedFcmAccess = {
      token: json.access_token,
      projectId: sa.project_id,
      expiresAtMs: now + expiresInSec * 1000,
    };
    return { token: json.access_token, projectId: sa.project_id };
  } catch (err) {
    console.error('[push] FCM OAuth failed', err);
    return null;
  }
}

async function sendFcmV1(
  sa: FcmServiceAccount,
  deviceToken: string,
  title: string,
  body: string,
  badge: number,
  data?: Record<string, string>,
): Promise<boolean> {
  const auth = await getFcmAccessToken(sa);
  if (!auth) return false;

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${auth.projectId}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title, body },
          data: { ...(data ?? {}), badge: String(badge) },
          android: {
            priority: 'HIGH',
            notification: {
              notification_count: badge,
              channel_id: 'ride_angels_default',
            },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[push] FCM v1 error', res.status, text);
    return false;
  }
  return true;
}

async function sendFcmLegacy(
  serverKey: string,
  deviceToken: string,
  title: string,
  body: string,
  badge: number,
  data?: Record<string, string>,
): Promise<boolean> {
  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      Authorization: `key=${serverKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: deviceToken,
      notification: { title, body, badge },
      data: { ...(data ?? {}), badge: String(badge) },
      priority: 'high',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('[push] FCM legacy error', res.status, text);
    return false;
  }
  return true;
}
