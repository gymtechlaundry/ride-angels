import { Injectable, inject } from '@angular/core';
import {
  Organization,
  OrganizationId,
  OrganizationMembership,
} from '../models';
import { OrganizationRepository } from '../repositories';
import { OrganizationContextService } from '../services/organization-context.service';

/**
 * In-memory organization repository.
 * Catalog stays empty until organization features are launched.
 */
@Injectable({ providedIn: 'root' })
export class MockOrganizationRepository implements OrganizationRepository {
  private readonly context = inject(OrganizationContextService);

  listAll(): Organization[] {
    return this.context.listOrganizations();
  }

  getById(organizationId: OrganizationId): Organization | undefined {
    return this.context.listOrganizations().find((o) => o.id === organizationId);
  }

  listMembershipsForUser(userId: string): OrganizationMembership[] {
    return this.context.listMembershipsForUser(userId);
  }
}
