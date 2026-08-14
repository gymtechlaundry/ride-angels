import { Injectable, computed, inject, signal } from '@angular/core';
import { RideCardView, RideOffer, User } from '../models';
import {
  MOCK_OFFERS,
  formatDateLabel,
  formatTimeLabel,
} from '../mock/mock-data';
import {
  RIDE_ASSIGNMENT_REPOSITORY,
  RIDE_OFFER_REPOSITORY,
  RIDE_REQUEST_REPOSITORY,
} from '../repositories/tokens';
import { isSupabaseConfigured } from '../supabase/supabase-client';
import { AppointmentService } from './appointment.service';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { newUuid } from '../utils/uuid';

export interface OfferListItem {
  offer: RideOffer;
  angel: User;
  appointmentId: string;
  appointmentTitle: string;
}

@Injectable({ providedIn: 'root' })
export class RideOfferService {
  private readonly appointments = inject(AppointmentService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly offersRepo = inject(RIDE_OFFER_REPOSITORY);
  private readonly rideRequestsRepo = inject(RIDE_REQUEST_REPOSITORY);
  private readonly assignmentsRepo = inject(RIDE_ASSIGNMENT_REPOSITORY);

  private readonly offers = signal<RideOffer[]>(
    isSupabaseConfigured() ? [] : [...MOCK_OFFERS],
  );

  readonly allOffers = computed(() => this.offers());

  readonly pendingOffersForCurrentRider = computed(() => {
    const riderId = this.auth.getCurrentUserOrNull()?.id;
    if (!riderId) {
      return [];
    }
    const items: OfferListItem[] = [];
    for (const offer of this.offers()) {
      if (offer.status !== 'pending') {
        continue;
      }
      const item = this.toListItem(offer);
      if (!item) {
        continue;
      }
      const ride = this.appointments.getRideRequestById(item.offer.rideRequestId);
      const appt = this.appointments.getAppointmentById(item.appointmentId);
      if (
        ride?.riderId === riderId &&
        this.appointments.isActiveListItem(appt, ride)
      ) {
        items.push(item);
      }
    }
    return items;
  });

  /**
   * Public offers this angel sent that still need rider acceptance —
   * shown on angel calendar as Awaiting confirm.
   */
  readonly pendingOfferCardsForCurrentAngel = computed((): RideCardView[] => {
    const angel = this.auth.getCurrentUserOrNull();
    if (!angel) {
      return [];
    }
    const cards: RideCardView[] = [];
    for (const offer of this.offers()) {
      if (offer.angelId !== angel.id || offer.status !== 'pending') {
        continue;
      }
      const ride = this.appointments.getRideRequestById(offer.rideRequestId);
      if (!ride) {
        continue;
      }
      if (
        ride.status === 'cancelled' ||
        ride.status === 'ride_cancelled' ||
        ride.status === 'completed' ||
        ride.status === 'ride_confirmed'
      ) {
        continue;
      }
      const appt = this.appointments.getAppointmentById(ride.appointmentId);
      if (!appt || !this.appointments.isActiveListItem(appt, ride)) {
        continue;
      }
      const rider = this.auth.getUserById(ride.riderId);
      cards.push({
        appointmentId: appt.id,
        rideRequestId: ride.id,
        title: appt.title,
        timeLabel: formatTimeLabel(appt.time),
        dateLabel: formatDateLabel(appt.date),
        fromLabel: ride.pickup.label.split('(')[0].trim() || ride.pickup.label,
        toLabel:
          ride.destination.label.split('(')[0].trim() || ride.destination.label,
        statusLabel: 'Awaiting confirm',
        date: appt.date,
        time: appt.time,
        viewAs: 'angel',
        riderName: rider?.displayName || ride.riderDisplayName || 'Rider',
        visibility: ride.visibility === 'public' ? 'public' : 'private',
      });
    }
    return cards.sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    );
  });

  replaceAll(offers: RideOffer[]): void {
    this.offers.set(offers);
  }

  getOffersForRide(rideRequestId: string): RideOffer[] {
    return this.offers().filter((o) => o.rideRequestId === rideRequestId);
  }

  getPendingOfferItemsForRide(rideRequestId: string): OfferListItem[] {
    return this.getOffersForRide(rideRequestId)
      .filter((o) => o.status === 'pending')
      .map((offer) => this.toListItem(offer))
      .filter((item): item is OfferListItem => !!item);
  }

  async submitOffer(
    rideRequestId: string,
    angelId: string,
    message?: string,
  ): Promise<RideOffer> {
    const ride = this.appointments.getRideRequestById(rideRequestId);
    if (!ride) {
      throw new Error('Ride not found.');
    }
    if (ride.riderId === angelId) {
      throw new Error('You cannot offer to drive your own ride.');
    }

    const existing = this.offers().find(
      (o) =>
        o.rideRequestId === rideRequestId &&
        o.angelId === angelId &&
        o.status === 'pending',
    );
    if (existing) {
      return existing;
    }

    if (isSupabaseConfigured()) {
      const { offerId } = await this.offersRepo.submitOffer({
        rideRequestId,
        message,
      });
      const offers = await this.offersRepo.listVisible();
      this.offers.set(offers);
      const rides = await this.rideRequestsRepo.listVisible();
      this.appointments.replaceAll(
        this.appointments.allAppointments(),
        rides,
        this.appointments.allAssignments(),
      );
      const saved = offers.find((o) => o.id === offerId);
      if (!saved) {
        throw new Error('Offer was created but could not be loaded.');
      }
      return saved;
    }

    const angel = this.auth.getUserById(angelId) ?? this.auth.getCurrentUser();
    const offer: RideOffer = {
      id: newUuid(),
      rideRequestId,
      angelId,
      status: 'pending',
      message: message?.trim() || undefined,
      createdAt: new Date().toISOString(),
      angelDisplayName: angel.displayName,
    };

    this.offers.update((list) => [...list, offer]);
    await this.appointments.submitPublicOffer(rideRequestId);
    return offer;
  }

  async acceptOffer(offerId: string): Promise<void> {
    const offer = this.offers().find((o) => o.id === offerId);
    if (!offer) {
      return;
    }

    if (isSupabaseConfigured()) {
      await this.offersRepo.acceptOffer({
        rideRequestId: offer.rideRequestId,
        offerId,
      });
      const [offers, rides, assignments] = await Promise.all([
        this.offersRepo.listVisible(),
        this.rideRequestsRepo.listVisible(),
        this.assignmentsRepo.listVisible(),
      ]);
      this.offers.set(offers);
      this.appointments.replaceAll(
        this.appointments.allAppointments(),
        rides,
        assignments,
      );
      this.appointments.queueCalendarSync(offer.rideRequestId);
      return;
    }

    this.offers.update((list) =>
      list.map((o) => {
        if (o.rideRequestId !== offer.rideRequestId) {
          return o;
        }
        if (o.id === offerId) {
          return { ...o, status: 'accepted' as const };
        }
        if (o.status === 'pending') {
          return { ...o, status: 'closed' as const };
        }
        return o;
      }),
    );

    await this.appointments.assignRide(
      offer.rideRequestId,
      offer.angelId,
      'public_offer',
    );
    this.appointments.queueCalendarSync(offer.rideRequestId);

    const ride = this.appointments.getRideRequestById(offer.rideRequestId);
    if (ride) {
      this.notifications.notify({
        userId: offer.angelId,
        type: 'offer_accepted',
        title: 'Offer Accepted',
        body: `${this.auth.getCurrentUser().displayName} accepted your ride offer.`,
        relatedRideRequestId: offer.rideRequestId,
        relatedAppointmentId: ride.appointmentId,
      });
    }
  }

  async declineOffer(offerId: string): Promise<void> {
    const offer = this.offers().find((o) => o.id === offerId);
    if (!offer) {
      return;
    }

    if (isSupabaseConfigured()) {
      await this.offersRepo.declineOffer(offerId);
    }

    this.offers.update((list) =>
      list.map((o) =>
        o.id === offerId ? { ...o, status: 'declined' as const } : o,
      ),
    );

    this.notifications.notify({
      userId: offer.angelId,
      type: 'offer_declined',
      title: 'Offer Declined',
      body: `${this.auth.getCurrentUser().displayName} declined your ride offer.`,
      relatedRideRequestId: offer.rideRequestId,
    });
  }

  getPendingOfferIdForCurrentAngel(rideRequestId: string): string | null {
    const angelId = this.auth.getCurrentUserOrNull()?.id;
    if (!angelId) {
      return null;
    }
    return (
      this.offers().find(
        (o) =>
          o.rideRequestId === rideRequestId &&
          o.angelId === angelId &&
          o.status === 'pending',
      )?.id ?? null
    );
  }

  async withdrawOffer(offerId: string, reason: string): Promise<void> {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new Error('Please share a reason for removing your offer.');
    }

    const offer = this.offers().find((o) => o.id === offerId);
    if (!offer || offer.status !== 'pending') {
      return;
    }

    const angelId = this.auth.getCurrentUserOrNull()?.id;
    if (!angelId || offer.angelId !== angelId) {
      throw new Error('You can only remove your own pending offer.');
    }

    if (isSupabaseConfigured()) {
      await this.offersRepo.withdrawOffer(offerId, trimmed);
      const [offers, rides] = await Promise.all([
        this.offersRepo.listVisible(),
        this.rideRequestsRepo.listVisible(),
      ]);
      this.offers.set(offers);
      this.appointments.replaceAll(
        this.appointments.allAppointments(),
        rides,
        this.appointments.allAssignments(),
      );
      return;
    }

    this.offers.update((list) =>
      list.map((o) =>
        o.id === offerId ? { ...o, status: 'withdrawn' as const } : o,
      ),
    );

    const remainingPending = this.offers().some(
      (o) =>
        o.rideRequestId === offer.rideRequestId &&
        o.status === 'pending',
    );
    if (!remainingPending) {
      const ride = this.appointments.getRideRequestById(offer.rideRequestId);
      if (ride?.status === 'offers_received') {
        const openStatus =
          ride.visibility === 'public' ? 'public_requested' : 'private_requested';
        this.appointments.replaceAll(
          this.appointments.allAppointments(),
          this.appointments.allRideRequests().map((r) =>
            r.id === ride.id
              ? { ...r, status: openStatus, updatedAt: new Date().toISOString() }
              : r,
          ),
          this.appointments.allAssignments(),
        );
      }
    }

    const ride = this.appointments.getRideRequestById(offer.rideRequestId);
    const angel = this.auth.getCurrentUser();
    if (ride) {
      this.notifications.notify({
        userId: ride.riderId,
        type: 'offer_withdrawn',
        title: 'Offer withdrawn',
        body: `${angel.displayName} withdrew their offer. Reason: ${trimmed}`,
        relatedRideRequestId: offer.rideRequestId,
        relatedAppointmentId: ride.appointmentId,
      });
    }
  }

  private toListItem(offer: RideOffer): OfferListItem | null {
    const angel =
      this.auth.getUserById(offer.angelId) ??
      (offer.angelDisplayName
        ? {
            id: offer.angelId,
            authUserId: offer.angelId,
            firstName: '',
            lastName: '',
            displayName: offer.angelDisplayName,
            roles: ['rideAngel' as const],
          }
        : undefined);
    const ride = this.appointments.getRideRequestById(offer.rideRequestId);
    const appointment = ride
      ? this.appointments.getAppointmentById(ride.appointmentId)
      : undefined;
    if (!angel || !ride || !appointment) {
      return null;
    }
    return {
      offer,
      angel,
      appointmentId: appointment.id,
      appointmentTitle: appointment.title,
    };
  }
}
