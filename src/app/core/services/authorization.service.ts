import { Injectable, inject } from '@angular/core';
import {
  OrganizationId,
  OrganizationMemberRole,
  OrganizationPermission,
  PersonalCapability,
  User,
} from '../models';
import { userHasPersonalCapability } from '../utils/personal-capability';
import { AuthService } from './auth.service';
import { OrganizationContextService } from './organization-context.service';

const ROLE_BASELINE: Record<OrganizationMemberRole, OrganizationPermission[]> = {
  owner: [
    'org.manage',
    'org.members.manage',
    'org.rides.coordinate',
    'org.rides.view',
    'org.riders.view',
    'org.volunteers.manage',
    'org.programs.manage',
    'org.reports.view',
    'org.settings.manage',
    'org.billing.manage',
  ],
  admin: [
    'org.manage',
    'org.members.manage',
    'org.rides.coordinate',
    'org.rides.view',
    'org.riders.view',
    'org.volunteers.manage',
    'org.programs.manage',
    'org.reports.view',
    'org.settings.manage',
  ],
  coordinator: [
    'org.rides.coordinate',
    'org.rides.view',
    'org.riders.view',
    'org.volunteers.manage',
    'org.reports.view',
  ],
  staff: ['org.rides.view', 'org.riders.view', 'org.reports.view'],
  volunteer: ['org.rides.view'],
  viewer: ['org.rides.view', 'org.reports.view'],
};

/**
 * Centralized authorization helpers.
 * UI may hide actions using these methods; backend must enforce for real security.
 * Do not scatter `role === 'admin'` checks in components.
 */
@Injectable({ providedIn: 'root' })
export class AuthorizationService {
  private readonly auth = inject(AuthService);
  private readonly orgContext = inject(OrganizationContextService);

  hasPersonalCapability(
    capability: PersonalCapability,
    user: User | null = this.auth.getCurrentUserOrNull(),
  ): boolean {
    if (!user) {
      return false;
    }
    return userHasPersonalCapability(user.roles, capability);
  }

  /**
   * Organization permission check.
   * Returns false when organizations are empty / inactive (current product state).
   */
  hasOrganizationPermission(
    permission: OrganizationPermission,
    organizationId: OrganizationId | null = this.orgContext.activeOrganizationId$(),
    userId: string | null = this.auth.getCurrentUserOrNull()?.id ?? null,
  ): boolean {
    if (!organizationId || !userId) {
      return false;
    }

    const membership = this.orgContext
      .listMembershipsForUser(userId)
      .find((m) => m.organizationId === organizationId && m.status === 'active');

    if (!membership) {
      return false;
    }

    const grants = new Set<OrganizationPermission>([
      ...ROLE_BASELINE[membership.role],
      ...(membership.permissions ?? []),
    ]);
    return grants.has(permission);
  }

  /** Explicit org coordination consent — membership alone is insufficient. */
  canCoordinateRider(
    organizationId: OrganizationId,
    riderUserId: string,
  ): boolean {
    return this.orgContext
      .listRiderConnectionsForOrganization(organizationId)
      .some(
        (c) =>
          c.riderUserId === riderUserId &&
          c.status === 'active' &&
          (c.permissions?.includes('coordinate_rides') ?? true),
      );
  }
}
