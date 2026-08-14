export type UserRole = 'rider' | 'rideAngel' | 'both';

/**
 * Personal platform capabilities (account-level).
 * Prefer checking these (or AuthorizationService) over raw role string compares in UI.
 * Organization roles are separate — see OrganizationMemberRole.
 *
 * Note: prefer roles: ['rider','rideAngel'] over legacy 'both'.
 */
export type PersonalCapability = 'act_as_rider' | 'act_as_ride_angel';

export type RideVisibility =
  | 'private'
  | 'public'
  | 'none'
  /** Reserved — not used in current UI */
  | 'organization'
  /** Reserved — not used in current UI */
  | 'organization_program';

/** Who originated the ride request record (owner remains riderId). */
export type RideRequestSource =
  | 'rider'
  | 'organization'
  | 'caregiver'
  | 'system_import';

export type RideStatus =
  | 'draft'
  | 'ride_needed'
  | 'private_requested'
  | 'public_requested'
  | 'offers_received'
  | 'ride_confirmed'
  | 'upcoming'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'ride_cancelled';

/** UI-facing status labels from Figma */
export type RideStatusLabel =
  | 'Claimed'
  | 'Unclaimed'
  | 'Needs confirm'
  | 'Awaiting confirm'
  | 'Completed'
  | 'Cancelled';

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'removed';

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'closed';

export type AssignmentConfirmationStatus =
  | 'confirmed'
  | 'pending_reconfirm'
  | 'released'
  | 'cancelled';

export type AppointmentStatus = 'active' | 'cancelled';

export type NotificationType =
  | 'angel_invited'
  | 'angel_accepted'
  | 'private_ride_confirmed'
  | 'public_offer_received'
  | 'offer_accepted'
  | 'offer_declined'
  | 'offer_withdrawn'
  | 'appointment_changed'
  | 'ride_changed'
  | 'appointment_reminder'
  | 'pickup_reminder'
  | 'angel_cancelled'
  | 'rider_cancelled'
  | 'ride_cancelled'
  | 'circle_removed'
  | 'partner_link_code'
  | 'discussion_posted'
  | 'discussion_reply';

export interface Address {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** Reserved for future geocoding */
  latitude?: number;
  longitude?: number;
}

export interface User {
  id: string;
  /**
   * Stable Supabase Auth user UUID.
   * Canonical ownership key for the Ride Angels profile.
   * Prefer this over email/phone for lookups.
   */
  authUserId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  /** Cached display only — Auth remains source of truth for login methods. */
  email?: string;
  /** Cached display only — Auth remains source of truth for login methods. */
  phone?: string;
  avatarUrl?: string;
  /**
   * Personal capabilities only (rider / rideAngel).
   * Organization participation uses OrganizationMembership — not this array.
   */
  roles: UserRole[];
  /** Product creator / discussion moderator. */
  isAppCreator?: boolean;
  homeAddress?: Address;
  onboardingCompleted?: boolean;
  /** Landing persona restored on each sign-in. */
  defaultPersona?: 'rider' | 'angel';
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  userId: string;
  accessToken: string;
  createdAt: string;
}

/** @deprecated Password auth removed — OTP only */
export interface SignInRequest {
  email: string;
  password: string;
}

/** @deprecated Password signup removed — OTP only */
export interface SignUpRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface AuthAccountRecord {
  email: string;
  /** Mock-only credential store — replace with real auth provider */
  password: string;
  user: User;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_credentials'
      | 'email_taken'
      | 'validation'
      | 'not_authenticated'
      | 'unknown_account'
      | 'identity_taken'
      | 'invalid_otp'
      | 'expired_otp'
      | 'rate_limited'
      | 'network'
      | 'delivery_failed'
      | 'not_configured'
      | 'session_expired'
      | 'verification_required' = 'validation',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface RiderProfile {
  userId: string;
  preferredName?: string;
  accessibilityNotes?: string;
}

export interface RideAngelProfile {
  userId: string;
  relationshipLabel?: string;
  bio?: string;
  isPublicVolunteer: boolean;
  /**
   * @deprecated Prefer contextual verification (global vs org vs program).
   * Do not treat a single boolean as organization approval.
   */
  verified?: boolean;
  rating?: number;
}

/** Personal trusted-circle link (not organization membership). */
export interface RideAngelConnection {
  id: string;
  riderId: string;
  angelId: string;
  status: ConnectionStatus;
  relationshipLabel: string;
  invitedAt: string;
  acceptedAt?: string;
  /** Denormalized for UI when the other profile is not in local directory. */
  riderDisplayName?: string;
  angelDisplayName?: string;
}

export interface Appointment {
  id: string;
  /** Owner of the need — always the rider, even if created by someone else. */
  riderId: string;
  /** Actor who created the record (may differ from riderId later). */
  createdByUserId?: string;
  /**
   * Optional coordination context. Never required for personal appointments.
   * Prefer OrganizationRiderConnection + coordinatingOrganizationId on RideRequest
   * when org coordination is introduced.
   */
  coordinatingOrganizationId?: string;
  title: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  /** Local time HH:mm */
  time: string;
  notes?: string;
  status?: AppointmentStatus;
  cancellationReason?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  updatedByUserId?: string;
}

export interface RideRequest {
  id: string;
  appointmentId: string;
  riderId: string;
  /** Actor who created the ride request (defaults to rider today). */
  createdByUserId?: string;
  /** How the request entered the system. Defaults to 'rider'. */
  source?: RideRequestSource;
  /**
   * Optional org coordinating this request — never ownership of the rider.
   * Absence means individual / personal coordination.
   */
  coordinatingOrganizationId?: string;
  /** Future OrganizationProgram association — optional. */
  programId?: string;
  pickup: Address;
  destination: Address;
  returnNeeded: boolean;
  returnPickupTime?: string;
  returnDestination?: Address;
  visibility: RideVisibility;
  status: RideStatus;
  notesForAngel?: string;
  accessibilityNotes?: string;
  estimatedTravelMinutes?: number;
  requestedPickupTime?: string;
  /** Denormalized rider name for claim board / cards. */
  riderDisplayName?: string;
  createdAt: string;
  updatedAt: string;
  updatedByUserId?: string;
}

export interface RideOffer {
  id: string;
  rideRequestId: string;
  angelId: string;
  status: OfferStatus;
  message?: string;
  createdAt: string;
  /** Optional org context if the offer was made while volunteering for an org program. */
  organizationId?: string;
  /** Denormalized for rider review UI. */
  angelDisplayName?: string;
}

export interface RideAssignment {
  id: string;
  rideRequestId: string;
  angelId: string;
  source: 'private_claim' | 'public_offer';
  assignedAt: string;
  /** Usually same as angelId for self-claim; reserved when a coordinator assigns. */
  assignedByUserId?: string;
  /** Optional coordination context — assignment remains rider↔angel. */
  coordinatingOrganizationId?: string;
  confirmationStatus?: AssignmentConfirmationStatus;
  pendingChangeSummary?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  relatedAppointmentId?: string;
  relatedRideRequestId?: string;
  relatedOrganizationId?: string;
}

/** View model used by list cards */
export interface RideCardView {
  appointmentId: string;
  rideRequestId: string;
  title: string;
  timeLabel: string;
  dateLabel: string;
  fromLabel: string;
  toLabel: string;
  statusLabel: RideStatusLabel;
  claimedByName?: string;
  claimedByAvatarUrl?: string;
  date: string;
  time: string;
  /** When viewing as the assigned Ride Angel */
  viewAs?: 'rider' | 'angel';
  riderName?: string;
  visibility?: Extract<RideVisibility, 'private' | 'public'>;
}

export type ClaimBoardFilter = 'all' | 'private' | 'public';

export interface ClaimBoardItem {
  appointmentId: string;
  rideRequestId: string;
  riderName: string;
  riderRelationship: string;
  title: string;
  whenLabel: string;
  routeLabel: string;
  visibility: Extract<RideVisibility, 'private' | 'public'>;
  claimedByCurrentUser: boolean;
  /** Angel already submitted a public offer; waiting on rider accept. */
  offerPendingByCurrentUser?: boolean;
  /** YYYY-MM-DD for sorting */
  date: string;
  /** HH:mm for sorting */
  time: string;
}

export * from './organization';
export * from './auth';
export * from './calendar';
