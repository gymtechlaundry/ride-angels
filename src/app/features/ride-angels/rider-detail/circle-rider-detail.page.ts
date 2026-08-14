import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AlertController,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import { map } from 'rxjs';
import { ClaimBoardItem, RideStatusLabel } from '../../../core/models';
import {
  formatWhenLong,
  toStatusLabel,
} from '../../../core/mock/mock-data';
import { AppointmentService } from '../../../core/services/appointment.service';
import { AuthService } from '../../../core/services/auth.service';
import { ClaimBoardService } from '../../../core/services/claim-board.service';
import { DomainSyncService } from '../../../core/services/domain-sync.service';
import { RideAngelService } from '../../../core/services/ride-angel.service';
import { RideOfferService } from '../../../core/services/ride-offer.service';
import { promptOfferNote, promptWithdrawOfferReason } from '../../../core/utils/offer-prompt';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';
import { ProfileAvatarComponent } from '../../../shared/components/profile-avatar/profile-avatar.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';

export interface RiderAppointmentRow {
  appointmentId: string;
  rideRequestId: string;
  title: string;
  whenLabel: string;
  routeLabel: string;
  statusLabel: RideStatusLabel;
  visibility: 'private' | 'public';
  claimed: boolean;
  claimedByName?: string;
  canClaim: boolean;
  offerPending: boolean;
  boardItem?: ClaimBoardItem;
}

@Component({
  selector: 'app-circle-rider-detail-page',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
    ProfileAvatarComponent,
    StatusBadgeComponent,
    PrimaryButtonComponent,
  ],
  templateUrl: './circle-rider-detail.page.html',
  styleUrl: './circle-rider-detail.page.scss',
})
export class CircleRiderDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointments = inject(AppointmentService);
  private readonly offers = inject(RideOfferService);
  private readonly angels = inject(RideAngelService);
  private readonly board = inject(ClaimBoardService);
  private readonly auth = inject(AuthService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  private readonly riderId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('riderId') ?? '')),
    { initialValue: '' },
  );

  readonly rider = computed(() => {
    const id = this.riderId();
    return id ? this.auth.getUserById(id) : undefined;
  });

  readonly relationshipLabel = computed(() => {
    const riderId = this.riderId();
    const angelId = this.auth.getCurrentUserOrNull()?.id;
    if (!riderId || !angelId) {
      return '';
    }
    return (
      this.angels
        .allConnections()
        .find(
          (c) =>
            c.riderId === riderId &&
            c.angelId === angelId &&
            c.status === 'accepted',
        )?.relationshipLabel ?? ''
    );
  });

  readonly allowed = computed(() => {
    const id = this.riderId();
    return !!id && this.angels.isAcceptedAngelForRider(id);
  });

  readonly rows = computed((): RiderAppointmentRow[] => {
    const riderId = this.riderId();
    const angelId = this.auth.getCurrentUserOrNull()?.id;
    if (!riderId || !angelId || !this.allowed()) {
      return [];
    }
    // Touch domain signals for reactivity
    this.appointments.allRideRequests();
    this.appointments.allAssignments();
    this.offers.allOffers();

    const rider = this.auth.getUserById(riderId);
    const relationship = this.relationshipLabel() || 'Trusted contact';
    const pendingOfferRideIds = new Set(
      this.offers
        .allOffers()
        .filter((o) => o.angelId === angelId && o.status === 'pending')
        .map((o) => o.rideRequestId),
    );

    return this.appointments
      .getAppointmentsForRider(riderId)
      .filter((a) => a.status !== 'cancelled')
      .map((appointment): RiderAppointmentRow | null => {
        const ride = this.appointments.getRideRequestForAppointment(
          appointment.id,
        );
        if (
          !ride ||
          !this.appointments.isActiveListItem(appointment, ride) ||
          (ride.visibility !== 'private' && ride.visibility !== 'public')
        ) {
          return null;
        }
        const visibility = ride.visibility;
        const assignment = this.appointments.getAssignmentForRide(ride.id);
        const claimed =
          !!assignment || !this.appointments.isOpenForAngelOffers(ride);
        const claimedBy =
          assignment && this.auth.getUserById(assignment.angelId);
        const offerPending = pendingOfferRideIds.has(ride.id);
        const canClaim =
          this.appointments.isOpenForAngelOffers(ride) &&
          !offerPending &&
          ride.riderId !== angelId;

        const boardItem: ClaimBoardItem | undefined = canClaim
          ? {
              appointmentId: appointment.id,
              rideRequestId: ride.id,
              riderName: rider?.displayName || ride.riderDisplayName || 'Rider',
              riderRelationship: relationship,
              title: appointment.title,
              whenLabel: formatWhenLong(appointment.date, appointment.time),
              routeLabel: `${ride.pickup.label} → ${ride.destination.label}`,
              visibility,
              claimedByCurrentUser: false,
              offerPendingByCurrentUser: offerPending,
              date: appointment.date,
              time: appointment.time,
            }
          : undefined;

        return {
          appointmentId: appointment.id,
          rideRequestId: ride.id,
          title: appointment.title,
          whenLabel: formatWhenLong(appointment.date, appointment.time),
          routeLabel: `${ride.pickup.label} → ${ride.destination.label}`,
          statusLabel: toStatusLabel(
            ride.status,
            assignment?.confirmationStatus,
          ),
          visibility,
          claimed,
          claimedByName: claimedBy?.displayName,
          canClaim,
          offerPending,
          boardItem,
        };
      })
      .filter((row): row is RiderAppointmentRow => row !== null)
      .sort((a, b) => {
        const left = this.appointments.getAppointmentById(a.appointmentId);
        const right = this.appointments.getAppointmentById(b.appointmentId);
        if (!left || !right) {
          return 0;
        }
        return `${left.date}T${left.time}`.localeCompare(
          `${right.date}T${right.time}`,
        );
      });
  });

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.domainSync.refreshForCurrentUser();
    } finally {
      event.target.complete();
    }
  }

  openAppointment(appointmentId: string): void {
    void this.router.navigate(['/tabs/home/appointment', appointmentId]);
  }

  async claim(row: RiderAppointmentRow): Promise<void> {
    if (!row.boardItem || !row.canClaim) {
      return;
    }
    try {
      const result = await promptOfferNote(this.alert, row.boardItem);
      if (result === null) {
        return;
      }
      await this.board.respondICanDrive(row.boardItem, result);
      const toast = await this.toast.create({
        message: `Offer sent for ${row.title}. The rider will choose a driver.`,
        duration: 2200,
        position: 'top',
        color: 'primary',
      });
      await toast.present();
    } catch (err) {
      const toast = await this.toast.create({
        message: err instanceof Error ? err.message : 'Unable to send offer.',
        duration: 2400,
        position: 'top',
        color: 'danger',
      });
      await toast.present();
    }
  }

  async withdrawOffer(row: RiderAppointmentRow): Promise<void> {
    if (!row.offerPending) {
      return;
    }
    const offerId = this.offers.getPendingOfferIdForCurrentAngel(row.rideRequestId);
    if (!offerId) {
      return;
    }

    const reason = await promptWithdrawOfferReason(this.alert, () => {
      void this.toast
        .create({
          message: 'Please add a short reason before continuing.',
          duration: 2000,
          position: 'top',
          color: 'danger',
        })
        .then((t) => t.present());
    });
    if (reason === null) {
      return;
    }

    try {
      await this.offers.withdrawOffer(offerId, reason);
      const toast = await this.toast.create({
        message: 'Offer removed. The rider was notified.',
        duration: 2000,
        position: 'top',
        color: 'primary',
      });
      await toast.present();
    } catch (err) {
      const toast = await this.toast.create({
        message: err instanceof Error ? err.message : 'Unable to remove offer.',
        duration: 2400,
        position: 'top',
        color: 'danger',
      });
      await toast.present();
    }
  }
}
