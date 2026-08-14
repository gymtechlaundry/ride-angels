import { Injectable, computed, signal } from '@angular/core';
import {
  Organization,
  OrganizationId,
  OrganizationMembership,
  OrganizationRiderConnection,
} from '../models';

/**
 * Optional organization context.
 * The consumer app must work with activeOrganizationId === null.
 * Never require this service for Rider / Ride Angel core flows.
 */
@Injectable({ providedIn: 'root' })
export class OrganizationContextService {
  private readonly activeOrganizationId = signal<OrganizationId | null>(null);
  private readonly organizations = signal<Organization[]>([]);
  private readonly memberships = signal<OrganizationMembership[]>([]);
  private readonly riderConnections = signal<OrganizationRiderConnection[]>([]);

  readonly activeOrganizationId$ = this.activeOrganizationId.asReadonly();

  readonly activeOrganization = computed(() => {
    const id = this.activeOrganizationId();
    if (!id) {
      return null;
    }
    return this.organizations().find((o) => o.id === id) ?? null;
  });

  readonly hasActiveOrganization = computed(() => !!this.activeOrganizationId());

  /** Explicit opt-in — personal mode is the default. */
  setActiveOrganization(organizationId: OrganizationId | null): void {
    this.activeOrganizationId.set(organizationId);
  }

  clearActiveOrganization(): void {
    this.activeOrganizationId.set(null);
  }

  listOrganizations(): Organization[] {
    return this.organizations();
  }

  listMembershipsForUser(userId: string): OrganizationMembership[] {
    return this.memberships().filter(
      (m) => m.userId === userId && m.status === 'active',
    );
  }

  listRiderConnectionsForOrganization(
    organizationId: OrganizationId,
  ): OrganizationRiderConnection[] {
    return this.riderConnections().filter(
      (c) => c.organizationId === organizationId && c.status === 'active',
    );
  }

  /**
   * Seed hook for future mock/API hydration.
   * Today the store stays empty so the product remains individual-first.
   */
  replaceCatalog(input: {
    organizations?: Organization[];
    memberships?: OrganizationMembership[];
    riderConnections?: OrganizationRiderConnection[];
  }): void {
    if (input.organizations) {
      this.organizations.set(input.organizations);
    }
    if (input.memberships) {
      this.memberships.set(input.memberships);
    }
    if (input.riderConnections) {
      this.riderConnections.set(input.riderConnections);
    }
  }
}
