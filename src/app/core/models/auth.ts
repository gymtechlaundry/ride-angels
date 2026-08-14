/**
 * Application-level auth intent.
 * Do not expose raw Supabase create-user semantics to UI components.
 */
export type AuthIntent = 'register' | 'sign_in' | 'add_identity';

export type AuthChannel = 'phone' | 'email';

export type SignInMethodStatus = 'verified' | 'pending' | 'not_added';

export interface LinkedSignInMethod {
  channel: AuthChannel;
  /** Display value (formatted phone or email). Empty when not_added. */
  value: string | null;
  status: SignInMethodStatus;
  isPrimary: boolean;
}

export interface PendingAuthChallenge {
  intent: AuthIntent;
  channel: AuthChannel;
  /** E.164 phone or normalized email */
  identifier: string;
}
