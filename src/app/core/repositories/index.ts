/**
 * Repository ports (swap points for future backends) + org mock repo.
 */

export * from './contracts';
export * from './tokens';
export * from './providers';
export * from './mock-organization.repository';

import {
  Appointment,
  Organization,
  OrganizationId,
  OrganizationMembership,
  RideAngelConnection,
  RideAssignment,
  RideOffer,
  RideRequest,
} from '../models';

/** Legacy in-memory-shaped interfaces kept for org readiness docs/samples. */
export interface AppointmentRepository {
  listByRider(riderId: string): Appointment[];
  getById(appointmentId: string): Appointment | undefined;
}

export interface RideRequestRepository {
  listByRider(riderId: string): RideRequest[];
  getById(rideRequestId: string): RideRequest | undefined;
  getByAppointmentId(appointmentId: string): RideRequest | undefined;
}

export interface RideOfferRepository {
  listByRideRequest(rideRequestId: string): RideOffer[];
}

export interface RideAssignmentRepository {
  getByRideRequest(rideRequestId: string): RideAssignment | undefined;
}

export interface RideAngelConnectionRepository {
  listForRider(riderId: string): RideAngelConnection[];
  listPendingForAngel(angelId: string): RideAngelConnection[];
}

export interface OrganizationRepository {
  listAll(): Organization[];
  getById(organizationId: OrganizationId): Organization | undefined;
  listMembershipsForUser(userId: string): OrganizationMembership[];
}
