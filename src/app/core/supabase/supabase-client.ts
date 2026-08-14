import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(environment.supabase.url && environment.supabase.anonKey);
}

/** Public anon client only — never use service_role in the Ionic app. */
export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  if (!client) {
    client = createClient(environment.supabase.url, environment.supabase.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
