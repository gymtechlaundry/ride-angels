import { PersonalCapability, UserRole } from '../models';

/**
 * Pure personal-capability checks (no DI).
 * Organization permissions live in AuthorizationService.
 */
export function userHasPersonalCapability(
  roles: UserRole[],
  capability: PersonalCapability,
): boolean {
  const normalized = new Set<UserRole>();
  for (const role of roles) {
    if (role === 'both') {
      normalized.add('rider');
      normalized.add('rideAngel');
    } else {
      normalized.add(role);
    }
  }

  if (capability === 'act_as_rider') {
    return normalized.has('rider');
  }
  return normalized.has('rideAngel');
}
