import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const partnerCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-partner-api-key, x-colorping-api-key',
};

export function partnerJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...partnerCorsHeaders, 'Content-Type': 'application/json' },
  });
}

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Resolve partner from Bearer / x-partner-api-key. Falls back to COLORPING_INGEST_API_KEY → colorping. */
export async function resolvePartnerFromRequest(
  req: Request,
  supabase: SupabaseClient,
): Promise<{ partnerId: string; apiKey: string }> {
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerKey = (
    req.headers.get('x-partner-api-key') ??
    req.headers.get('x-colorping-api-key') ??
    ''
  ).trim();
  const apiKey = bearer || headerKey;
  if (!apiKey) throw new Error('Unauthorized');

  const { data: partnerId, error } = await supabase.rpc(
    'resolve_integration_partner',
    { p_api_key: apiKey },
  );
  if (error) throw new Error(error.message);

  if (partnerId) {
    return { partnerId: String(partnerId), apiKey };
  }

  // Legacy ColorPing secret until set_partner_api_key is run
  const legacy = Deno.env.get('COLORPING_INGEST_API_KEY') ?? '';
  if (legacy && apiKey === legacy) {
    return { partnerId: 'colorping', apiKey };
  }

  throw new Error('Unauthorized');
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function maskContact(contact: string): string {
  if (contact.includes('@')) {
    const [user, domain] = contact.split('@');
    return `${user.slice(0, 1)}***@${domain}`;
  }
  const digits = contact.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  return `***${digits.slice(-4)}`;
}
