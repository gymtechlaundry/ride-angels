import { Injectable, inject } from '@angular/core';
import {
  AppNotification,
  Appointment,
  NotificationType,
  RideAngelConnection,
  RideAssignment,
  RideOffer,
  RideRequest,
  User,
} from '../models';
import { RideDomainRepository } from '../services/ride-domain.repository';
import { newUuid } from '../utils/uuid';
import {
  AppointmentRepositoryPort,
  NotificationRepositoryPort,
  ProfileDirectoryPort,
  RideAngelConnectionRepositoryPort,
  RideAssignmentRepositoryPort,
  RideOfferRepositoryPort,
  RideRequestRepositoryPort,
} from './contracts';
import {
  CalendarPreferencesPatch,
  CalendarRepositoryPort,
} from './calendar-contracts';

/**
 * Supabase adapters — repository ports backed by RideDomainRepository.
 * Presentation never imports this file; services inject tokens only.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseAppointmentRepository implements AppointmentRepositoryPort {
  private readonly domain = inject(RideDomainRepository);

  listVisible(): Promise<Appointment[]> {
    return this.domain.loadAppointmentsVisible();
  }

  async getById(id: string): Promise<Appointment | null> {
    const rows = await this.domain.loadAppointmentsVisible();
    return rows.find((a) => a.id === id) ?? null;
  }

  createWithRide(input: {
    appointment: Appointment;
    ride: RideRequest;
  }): Promise<{ appointment: Appointment; ride: RideRequest }> {
    return this.domain.insertAppointmentWithRide(input);
  }

  updateWithRide(input: {
    appointment: Appointment;
    ride: RideRequest;
    changeSummary?: string;
  }): Promise<{ needsReconfirm: boolean }> {
    return this.domain.updateAppointmentDetails(input);
  }

  cancel(appointmentId: string, reason?: string): Promise<void> {
    return this.domain.cancelAppointment(appointmentId, reason);
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseRideRequestRepository implements RideRequestRepositoryPort {
  private readonly domain = inject(RideDomainRepository);

  listVisible(): Promise<RideRequest[]> {
    return this.domain.loadRideRequestsVisible();
  }

  async getById(id: string): Promise<RideRequest | null> {
    const rows = await this.domain.loadRideRequestsVisible();
    return rows.find((r) => r.id === id) ?? null;
  }

  updateVisibilityStatus(
    id: string,
    patch: Partial<{ visibility: string; status: string }>,
  ): Promise<void> {
    return this.domain.updateRideRequest(id, patch);
  }

  setVisibility(
    id: string,
    isPublic: boolean,
  ): Promise<{ visibility: string; status: string }> {
    return this.domain.setRideRequestVisibility(id, isPublic);
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseRideOfferRepository implements RideOfferRepositoryPort {
  private readonly domain = inject(RideDomainRepository);

  listVisible(): Promise<RideOffer[]> {
    return this.domain.loadOffersVisible();
  }

  submitOffer(input: {
    rideRequestId: string;
    message?: string;
  }): Promise<{ offerId: string; rideRequestId: string }> {
    return this.domain
      .submitRideOfferRpc(input.rideRequestId, input.message)
      .then((r) => ({ offerId: r.offerId, rideRequestId: input.rideRequestId }));
  }

  acceptOffer(input: {
    rideRequestId: string;
    offerId: string;
  }): Promise<{ assignmentId: string }> {
    return this.domain.acceptRideOfferRpc(input.rideRequestId, input.offerId);
  }

  declineOffer(offerId: string): Promise<void> {
    return this.domain.updateOfferStatus(offerId, 'declined');
  }

  withdrawOffer(offerId: string, reason: string): Promise<void> {
    return this.domain.withdrawRideOffer(offerId, reason);
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseRideAssignmentRepository
  implements RideAssignmentRepositoryPort
{
  private readonly domain = inject(RideDomainRepository);

  listVisible(): Promise<RideAssignment[]> {
    return this.domain.loadAssignmentsVisible();
  }

  claimPrivateRide(
    rideRequestId: string,
  ): Promise<{ assignmentId: string }> {
    return this.domain.claimPrivateRide(rideRequestId);
  }

  confirmAfterChange(rideRequestId: string): Promise<void> {
    return this.domain.confirmAssignmentAfterChange(rideRequestId);
  }

  declineAfterChange(rideRequestId: string): Promise<void> {
    return this.domain.declineAssignmentAfterChange(rideRequestId);
  }

  cancelByAngel(rideRequestId: string, reason: string): Promise<void> {
    return this.domain.cancelAssignmentByAngel(rideRequestId, reason);
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseRideAngelConnectionRepository
  implements RideAngelConnectionRepositoryPort
{
  private readonly domain = inject(RideDomainRepository);

  listForCurrentUser(): Promise<RideAngelConnection[]> {
    return this.domain.loadConnectionsForUser();
  }

  findProfileForInvite(identifier: string): Promise<User | null> {
    return this.domain.findProfileForInvite(identifier);
  }

  insert(
    connection: RideAngelConnection,
    names: { riderDisplayName: string; angelDisplayName: string },
  ): Promise<RideAngelConnection> {
    return this.domain.insertConnection(connection, names);
  }

  updateStatus(
    id: string,
    patch: Partial<{
      status: string;
      accepted_at: string | null;
      relationship_label?: string;
      invited_at?: string;
    }>,
  ): Promise<void> {
    return this.domain.updateConnection(id, patch);
  }

  removeConnection(id: string): Promise<void> {
    return this.domain.removeRideAngelConnection(id);
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseNotificationRepository implements NotificationRepositoryPort {
  private readonly domain = inject(RideDomainRepository);

  listForRecipient(recipientProfileId: string): Promise<AppNotification[]> {
    return this.domain.listNotifications(recipientProfileId);
  }

  async create(input: {
    recipientProfileId: string;
    type: NotificationType;
    title: string;
    body: string;
    relatedAppointmentId?: string;
    relatedRideRequestId?: string;
  }): Promise<AppNotification> {
    // Client inserts are denied by RLS; transactional RPCs create rows.
    // Optimistic local-only shape for mock/optimistic UI paths.
    return {
      id: newUuid(),
      userId: input.recipientProfileId,
      type: input.type,
      title: input.title,
      body: input.body,
      read: false,
      createdAt: new Date().toISOString(),
      relatedAppointmentId: input.relatedAppointmentId,
      relatedRideRequestId: input.relatedRideRequestId,
    };
  }

  markRead(id: string): Promise<void> {
    return this.domain.markNotificationRead(id);
  }

  markAllRead(recipientProfileId: string): Promise<void> {
    return this.domain.markAllNotificationsRead(recipientProfileId);
  }

  delete(id: string): Promise<void> {
    return this.domain.deleteNotification(id);
  }

  deleteRead(recipientProfileId: string): Promise<void> {
    return this.domain.deleteReadNotifications(recipientProfileId);
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseProfileDirectory implements ProfileDirectoryPort {
  private readonly domain = inject(RideDomainRepository);

  loadByIds(ids: string[]): Promise<User[]> {
    return this.domain.loadProfilesByIds(ids);
  }
}

@Injectable({ providedIn: 'root' })
export class SupabaseCalendarRepository implements CalendarRepositoryPort {
  private readonly domain = inject(RideDomainRepository);

  getPreferences(profileId: string) {
    return this.domain.getCalendarPreferences(profileId);
  }

  upsertPreferences(patch: CalendarPreferencesPatch) {
    return this.domain.upsertCalendarPreferences(patch);
  }

  listEventsForProfile(profileId: string) {
    return this.domain.listCalendarEventsForProfile(profileId);
  }

  getActiveEvent(
    rideRequestId: string,
    profileId: string,
    provider: import('../models/calendar').CalendarProviderId,
  ) {
    return this.domain.getActiveCalendarEvent(rideRequestId, profileId, provider);
  }

  upsertActiveEvent(input: {
    rideRequestId: string;
    appointmentId?: string;
    profileId: string;
    provider: import('../models/calendar').CalendarProviderId;
    externalCalendarId?: string;
    externalEventId?: string;
    syncStatus: import('../models/calendar').CalendarEventSyncStatus;
    lastError?: string | null;
  }) {
    return this.domain.upsertActiveCalendarEvent(input);
  }

  markEventDeleted(
    rideRequestId: string,
    profileId: string,
    provider: import('../models/calendar').CalendarProviderId,
  ) {
    return this.domain.markCalendarEventDeleted(
      rideRequestId,
      profileId,
      provider,
    );
  }
}
