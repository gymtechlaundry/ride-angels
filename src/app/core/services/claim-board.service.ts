import { Injectable, computed, inject, signal } from '@angular/core';
import { ClaimBoardFilter, ClaimBoardItem } from '../models';
import { buildClaimBoard } from '../mock/mock-data';
import { isSupabaseConfigured } from '../supabase/supabase-client';
import { AppointmentService } from './appointment.service';
import { AuthService } from './auth.service';
import { AuthorizationService } from './authorization.service';
import { NotificationService } from './notification.service';
import { RideAngelService } from './ride-angel.service';
import { RideOfferService } from './ride-offer.service';

@Injectable({ providedIn: 'root' })
export class ClaimBoardService {
  private readonly appointments = inject(AppointmentService);
  private readonly offers = inject(RideOfferService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);
  private readonly angels = inject(RideAngelService);
  private readonly authorization = inject(AuthorizationService);

  /** Discovery locked to trusted circle while public board is paused. */
  readonly filter = signal<ClaimBoardFilter>('private');

  /** Open trusted-circle rides (ignores filter signal) — for tab badges. */
  readonly allOpenBoardItems = computed(() => {
    const angelId = this.resolveAngelId();
    if (!angelId) {
      return [];
    }
    const pendingOfferRideIds = new Set(
      this.offers
        .allOffers()
        .filter((o) => o.angelId === angelId && o.status === 'pending')
        .map((o) => o.rideRequestId),
    );
    return buildClaimBoard(
      this.appointments.allAppointments(),
      this.appointments.allRideRequests(),
      this.appointments.allAssignments(),
      this.auth.listUsers(),
      this.angels.allConnections(),
      angelId,
      { includeClaimedByMe: false },
    )
      .filter((item) => item.visibility === 'private')
      .map((item) => ({
        ...item,
        offerPendingByCurrentUser: pendingOfferRideIds.has(item.rideRequestId),
      }));
  });

  /** Open rides only — commitments live in AppointmentService.upcomingDrives. */
  readonly openBoardItems = this.allOpenBoardItems;

  /** @deprecated Prefer openBoardItems — kept as alias for templates. */
  readonly boardItems = this.openBoardItems;

  setFilter(filter: ClaimBoardFilter): void {
    // Public board paused — keep trusted-only.
    this.filter.set(filter === 'public' ? 'private' : filter);
  }

  /**
   * Trusted circle: submit an offer so the rider can choose among angels.
   */
  async respondICanDrive(
    item: ClaimBoardItem,
    offerMessage?: string,
  ): Promise<void> {
    const angelId = this.resolveAngelId();
    if (!angelId || item.claimedByCurrentUser || item.offerPendingByCurrentUser) {
      return;
    }

    const ride = this.appointments.getRideRequestById(item.rideRequestId);
    if (!this.appointments.isOpenForAngelOffers(ride)) {
      throw new Error('This ride is already claimed.');
    }
    if (ride?.riderId === angelId) {
      throw new Error('You cannot claim or offer on your own ride.');
    }

    await this.offers.submitOffer(item.rideRequestId, angelId, offerMessage);
    if (ride && !isSupabaseConfigured()) {
      this.notifications.notify({
        userId: ride.riderId,
        type: 'public_offer_received',
        title: 'New Ride Offer',
        body: `${this.auth.getUserById(angelId)?.displayName ?? 'A Ride Angel'} offered to drive for ${item.title}.`,
        relatedAppointmentId: item.appointmentId,
        relatedRideRequestId: item.rideRequestId,
      });
    }
  }

  private resolveAngelId(): string | null {
    const user = this.auth.getCurrentUserOrNull();
    if (!user) {
      return null;
    }
    if (
      this.auth.activePersona() === 'angel' ||
      this.authorization.hasPersonalCapability('act_as_ride_angel', user)
    ) {
      return user.id;
    }
    return null;
  }
}
