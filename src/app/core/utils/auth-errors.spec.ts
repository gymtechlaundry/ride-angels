import { AuthError } from '../models';
import { isAuthSessionFailure, mapAuthError } from './auth-errors';

describe('isAuthSessionFailure', () => {
  it('detects AuthError session_expired', () => {
    expect(
      isAuthSessionFailure(
        new AuthError('Your session expired.', 'session_expired'),
      ),
    ).toBe(true);
  });

  it('detects JWT / 401 style failures', () => {
    expect(isAuthSessionFailure(new Error('JWT expired'))).toBe(true);
    expect(isAuthSessionFailure({ message: 'Invalid JWT', status: 401 })).toBe(
      true,
    );
    expect(isAuthSessionFailure({ message: 'x', code: 'PGRST301' })).toBe(true);
  });

  it('detects JWT issued-at-future clock skew', () => {
    expect(
      isAuthSessionFailure(new Error('JWT issued at future')),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isAuthSessionFailure(new Error('Network request failed'))).toBe(
      false,
    );
    expect(isAuthSessionFailure(new Error('ride_already_assigned'))).toBe(
      false,
    );
  });
});

describe('mapAuthError', () => {
  it('maps JWT issued-at-future to a clock sync message', () => {
    const mapped = mapAuthError(new Error('JWT issued at future'), 'sign_in');
    expect(mapped.code).toBe('session_expired');
    expect(mapped.message.toLowerCase()).toContain('clock');
    expect(mapped.message.toLowerCase()).not.toContain('jwt');
  });
});
