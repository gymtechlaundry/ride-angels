import { isAuthSessionFailure } from './auth-errors';
import { AuthError } from '../models';

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

  it('ignores unrelated errors', () => {
    expect(isAuthSessionFailure(new Error('Network request failed'))).toBe(
      false,
    );
    expect(isAuthSessionFailure(new Error('ride_already_assigned'))).toBe(
      false,
    );
  });
});
