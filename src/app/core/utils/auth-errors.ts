import { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { AuthError } from '../models';
import { AuthChannel } from '../models/auth';

type AuthErrorContext =
  | 'sign_in'
  | 'register'
  | 'verify'
  | 'add_identity'
  | 'generic';

/** Map provider errors to friendly copy. Never surface raw Supabase messages. */
export function mapAuthError(
  err: unknown,
  context: AuthErrorContext = 'generic',
  channel?: AuthChannel,
): AuthError {
  if (err instanceof AuthError) {
    return err;
  }

  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Something went wrong.';
  const lower = message.toLowerCase();
  const status =
    err && typeof err === 'object' && 'status' in err
      ? Number((err as SupabaseAuthError).status)
      : undefined;
  const providerCode =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code ?? '').toLowerCase()
      : '';

  if (
    providerCode === 'otp_disabled' ||
    lower.includes('signups not allowed') ||
    lower.includes('otp_disabled') ||
    lower.includes('user not found') ||
    (context === 'sign_in' && (status === 400 || status === 422))
  ) {
    return new AuthError(unknownAccountMessage(channel), 'unknown_account');
  }

  if (
    lower.includes('already been registered') ||
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('identity is already linked') ||
    lower.includes('email address is already') ||
    lower.includes('phone number is already')
  ) {
    return new AuthError(
      context === 'add_identity'
        ? 'That sign-in method is already associated with another account.'
        : 'An account with that sign-in method already exists. Try signing in instead.',
      'identity_taken',
    );
  }

  if (lower.includes('expired') || lower.includes('otp_expired')) {
    return new AuthError(
      'That code has expired. Request a new one.',
      'expired_otp',
    );
  }

  if (
    lower.includes('invalid') &&
    (lower.includes('otp') || lower.includes('token') || lower.includes('code'))
  ) {
    return new AuthError(
      'That code is incorrect. Check it and try again.',
      'invalid_otp',
    );
  }

  if (lower.includes('rate') || status === 429) {
    return new AuthError(
      'Too many attempts. Please wait a moment and try again.',
      'rate_limited',
    );
  }

  if (lower.includes('network') || lower.includes('fetch')) {
    return new AuthError(
      'Network error. Check your connection and try again.',
      'network',
    );
  }

  if (isAuthSessionFailure(err)) {
    return new AuthError(
      'Your session expired. Please sign in again.',
      'session_expired',
    );
  }

  const code =
    context === 'verify' ? ('invalid_otp' as const) : ('validation' as const);
  return new AuthError(
    context === 'register'
      ? 'Unable to start registration. Try again.'
      : context === 'sign_in'
        ? 'Unable to sign in. Try again.'
        : context === 'add_identity'
          ? 'Unable to update your sign-in methods. Try again.'
          : 'Something went wrong. Try again.',
    code,
  );
}

function unknownAccountMessage(channel?: AuthChannel): string {
  if (channel === 'phone') {
    return "We couldn't find a Ride Angels account using that phone number.";
  }
  if (channel === 'email') {
    return "We couldn't find a Ride Angels account using that email.";
  }
  return "We couldn't find a Ride Angels account using that sign-in method.";
}

/**
 * True when the session/JWT is dead or revoked — the app should clear local
 * auth and send the user to sign-in (not leave an empty “signed in” shell).
 */
export function isAuthSessionFailure(err: unknown): boolean {
  if (err instanceof AuthError && err.code === 'session_expired') {
    return true;
  }

  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
  const lower = message.toLowerCase();
  const status =
    err && typeof err === 'object' && 'status' in err
      ? Number((err as { status?: number }).status)
      : undefined;
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code ?? '').toLowerCase()
      : '';

  if (status === 401 || code === 'pgrst301') {
    return true;
  }

  return (
    lower.includes('jwt expired') ||
    lower.includes('invalid jwt') ||
    lower.includes('invalid claim') ||
    lower.includes('refresh_token') ||
    lower.includes('auth session missing') ||
    lower.includes('session from session_id claim in jwt does not exist') ||
    (lower.includes('session') &&
      (lower.includes('expired') ||
        lower.includes('not found') ||
        lower.includes('missing'))) ||
    lower.includes('not authenticated') ||
    lower.includes('not_authenticated')
  );
}
