#!/usr/bin/env node
/**
 * Delete a Supabase Auth user (and cascaded profile / domain rows) by email or phone.
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/delete-auth-user-by-email.mjs user@example.com
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/delete-auth-user-by-email.mjs +15551234567
 *
 * Or use the wrapper (loads keys via `supabase projects api-keys`):
 *   ./scripts/reset-test-user.sh user@example.com
 *
 * Never commit service_role. Never run against an account you still need.
 */
import { createClient } from '@supabase/supabase-js';

const identifier = (process.argv[2] || '').trim().toLowerCase();
if (!identifier) {
  console.error('Usage: node scripts/delete-auth-user-by-email.mjs <email-or-e164-phone>');
  process.exit(1);
}

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !serviceKey) {
  console.error(
    'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see scripts/reset-test-user.sh).',
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function matchesUser(user) {
  const email = (user.email || '').trim().toLowerCase();
  if (email && email === identifier) {
    return true;
  }
  const phone = (user.phone || '').trim();
  if (phone && (phone === identifier || `+${phone}` === identifier)) {
    return true;
  }
  return false;
}

async function findUser() {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }
    const users = data?.users ?? [];
    const hit = users.find(matchesUser);
    if (hit) {
      return hit;
    }
    if (users.length < perPage) {
      return null;
    }
    page += 1;
    if (page > 50) {
      throw new Error('Gave up after 50 pages of users.');
    }
  }
}

async function clearStoragePrefix(bucket, prefix) {
  const { data: listed, error: listError } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 100 });
  if (listError) {
    // Bucket may not exist or path empty — ignore.
    return;
  }
  const paths = (listed ?? [])
    .filter((obj) => obj.name)
    .map((obj) => `${prefix}/${obj.name}`);
  if (!paths.length) {
    return;
  }
  const { error: removeError } = await admin.storage.from(bucket).remove(paths);
  if (removeError) {
    console.warn(`[warn] storage ${bucket}/${prefix}: ${removeError.message}`);
  }
}

const user = await findUser();
if (!user) {
  console.error(`No Auth user found for: ${identifier}`);
  process.exit(2);
}

console.log(`Found user ${user.id} (${user.email || user.phone || 'no contact'})`);

await clearStoragePrefix('avatars', user.id);
await clearStoragePrefix('feedback-screenshots', user.id);

const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
if (deleteError) {
  console.error('Delete failed:', deleteError.message);
  process.exit(1);
}

console.log('Deleted Auth user and cascaded domain data. Safe to re-register for onboarding.');
