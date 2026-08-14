/**
 * Future organization domain types.
 * Additive only — no UI or billing behavior is wired yet.
 * See docs/organization-readiness.md.
 */

export type OrganizationId = string;
export type OrganizationMembershipId = string;
export type OrganizationProgramId = string;

export type OrganizationType =
  | 'healthcare'
  | 'church'
  | 'nonprofit'
  | 'senior_community'
  | 'municipality'
  | 'community_group'
  | 'volunteer_program'
  | 'other';

/** Descriptive metadata — do not switch behavior solely on type. */
export type OrganizationStatus = 'draft' | 'active' | 'suspended' | 'archived';

/**
 * Membership role within an organization.
 * Personal Rider / Ride Angel capabilities remain on User.roles.
 */
export type OrganizationMemberRole =
  | 'owner'
  | 'admin'
  | 'coordinator'
  | 'staff'
  | 'volunteer'
  | 'viewer';

export type OrganizationMembershipStatus =
  | 'invited'
  | 'active'
  | 'suspended'
  | 'removed';

export type OrganizationRiderConnectionStatus =
  | 'pending'
  | 'active'
  | 'revoked'
  | 'expired';

/**
 * Org-scoped permission keys (future).
 * Evaluate only through AuthorizationService — never scatter role string checks in UI.
 */
export type OrganizationPermission =
  | 'org.manage'
  | 'org.members.manage'
  | 'org.rides.coordinate'
  | 'org.rides.view'
  | 'org.riders.view'
  | 'org.volunteers.manage'
  | 'org.programs.manage'
  | 'org.reports.view'
  | 'org.settings.manage'
  | 'org.billing.manage';

export interface Organization {
  id: OrganizationId;
  name: string;
  displayName: string;
  type: OrganizationType;
  status: OrganizationStatus;
  logoUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  timezone?: string;
  defaultLocationLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  id: OrganizationMembershipId;
  organizationId: OrganizationId;
  userId: string;
  role: OrganizationMemberRole;
  status: OrganizationMembershipStatus;
  /** Optional finer-grained grants beyond the role baseline. */
  permissions?: OrganizationPermission[];
  invitedByUserId?: string;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Consent-based link: organization may coordinate certain rides for a rider.
 * Membership alone must never imply unrestricted rider data access.
 */
export interface OrganizationRiderConnection {
  id: string;
  organizationId: OrganizationId;
  riderUserId: string;
  status: OrganizationRiderConnectionStatus;
  relationshipType?: string;
  /** Purpose-scoped permissions granted by the rider (future). */
  permissions?: Array<'coordinate_rides' | 'view_schedule' | 'view_contact'>;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

/**
 * Programs are reserved for future org transportation initiatives.
 * Not implemented in product UI.
 */
export interface OrganizationProgram {
  id: OrganizationProgramId;
  organizationId: OrganizationId;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

/** Invitation to join an organization (future). */
export interface OrganizationInvitation {
  id: string;
  organizationId: OrganizationId;
  email: string;
  role: OrganizationMemberRole;
  invitedByUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt?: string;
}

/**
 * Placeholder settings shape — persist later with backend.
 * Keep billing out of User; attach plan/entitlements here or via dedicated services.
 */
export interface OrganizationSettings {
  organizationId: OrganizationId;
  allowPublicBoardSharing?: boolean;
  requireVolunteerApproval?: boolean;
  defaultRideVisibility?: 'private' | 'public' | 'organization';
}

/**
 * Monetization lives at the organization layer (future).
 * Do not implement payments — interfaces reserve the boundary only.
 */
export interface OrganizationSubscription {
  id: string;
  organizationId: OrganizationId;
  planCode: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
  currentPeriodEnd?: string;
}

export interface OrganizationBillingAccount {
  id: string;
  organizationId: OrganizationId;
  providerCustomerId?: string;
}

/** Sponsor vs operating organization may differ (future). */
export interface OrganizationSponsor {
  id: string;
  organizationId: OrganizationId;
  sponsorName: string;
  status: 'active' | 'ended';
}

export interface OrganizationAuditEvent {
  id: string;
  organizationId: OrganizationId;
  actorUserId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  metadata?: Record<string, string>;
}
