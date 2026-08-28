import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AppointmentService } from '../../../core/services/appointment.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  CalendarSyncService,
  CalendarSyncUiStatus,
} from '../../../core/services/calendar-sync.service';
import { ClaimBoardService } from '../../../core/services/claim-board.service';
import { DomainSyncService } from '../../../core/services/domain-sync.service';
import { RideOfferService } from '../../../core/services/ride-offer.service';
import { toStatusLabel, formatTimeLabel } from '../../../core/mock/mock-data';
import { promptOfferNote, promptWithdrawOfferReason } from '../../../core/utils/offer-prompt';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ProfileAvatarComponent } from '../../../shared/components/profile-avatar/profile-avatar.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-appointment-detail-page',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
    StatusBadgeComponent,
    ProfileAvatarComponent,
    PrimaryButtonComponent,
  ],
  templateUrl: './appointment-detail.page.html',
  styleUrl: './appointment-detail.page.scss',
})
export class AppointmentDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointments = inject(AppointmentService);
  private readonly offers = inject(RideOfferService);
  private readonly board = inject(ClaimBoardService);
  private readonly auth = inject(AuthService);
  private readonly calendarSync = inject(CalendarSyncService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);

  private readonly appointmentId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  readonly detail = computed(() => {
    const id = this.appointmentId();
    // Touch domain signals so visibility/status edits refresh this view
    this.appointments.allRideRequests();
    this.appointments.allAssignments();
    this.offers.allOffers();
    this.board.allOpenBoardItems();
    this.auth.activePersona();
    return id ? this.appointments.detailView(id) : undefined;
  });

  readonly pendingOffers = computed(() => {
    if (!this.isRider()) {
      return [];
    }
    const ride = this.detail()?.ride;
    if (!ride || ride.status === 'ride_confirmed') {
      return [];
    }
    return this.offers.getPendingOfferItemsForRide(ride.id);
  });

  readonly statusLabel = computed(() => {
    const d = this.detail();
    if (!d?.ride) {
      return 'Unclaimed';
    }
    return toStatusLabel(d.ride.status, d.assignment?.confirmationStatus);
  });

  readonly isRider = computed(() => {
    const user = this.auth.getCurrentUserOrNull();
    const appointment = this.detail()?.appointment;
    return !!user && !!appointment && appointment.riderId === user.id;
  });

  readonly isAssignedAngel = computed(() => {
    const user = this.auth.getCurrentUserOrNull();
    const assignment = this.detail()?.assignment;
    return !!user && !!assignment && assignment.angelId === user.id;
  });

  /** Open request the current angel can act on from this appointment. */
  readonly claimableItem = computed(() => {
    if (this.isRider() || this.isAssignedAngel()) {
      return undefined;
    }
    if (this.auth.activePersona() !== 'angel') {
      return undefined;
    }
    const detail = this.detail();
    const ride = detail?.ride;
    if (!ride || !this.appointments.isOpenForAngelOffers(ride)) {
      return undefined;
    }
    const appointmentId = detail?.appointment.id;
    if (!appointmentId) {
      return undefined;
    }
    return this.board
      .allOpenBoardItems()
      .find((item) => item.appointmentId === appointmentId);
  });

  readonly canOfferToDrive = computed(() => {
    const item = this.claimableItem();
    const ride = this.detail()?.ride;
    return (
      !!item &&
      !!ride &&
      this.appointments.isOpenForAngelOffers(ride) &&
      !item.claimedByCurrentUser &&
      !item.offerPendingByCurrentUser
    );
  });

  readonly offerPendingAsAngel = computed(
    () => !!this.claimableItem()?.offerPendingByCurrentUser,
  );

  readonly riderForAngel = computed(() => {
    if (this.isRider()) {
      return undefined;
    }
    const ride = this.detail()?.ride;
    if (!ride) {
      return undefined;
    }
    const user = this.auth.getUserById(ride.riderId);
    if (user) {
      return user;
    }
    if (!ride.riderDisplayName) {
      return undefined;
    }
    return {
      displayName: ride.riderDisplayName,
      avatarUrl: undefined as string | undefined,
    };
  });

  readonly needsReconfirm = computed(
    () =>
      this.isAssignedAngel() &&
      this.detail()?.assignment?.confirmationStatus === 'pending_reconfirm',
  );

  readonly canManageAsRider = computed(
    () =>
      this.isRider() &&
      this.auth.activePersona() !== 'angel' &&
      this.detail()?.appointment.status !== 'cancelled' &&
      this.detail()?.ride.status !== 'cancelled' &&
      this.detail()?.ride.status !== 'ride_cancelled',
  );

  readonly canCancelAsAngel = computed(
    () =>
      this.isAssignedAngel() &&
      this.detail()?.appointment.status !== 'cancelled' &&
      this.detail()?.ride.status !== 'cancelled' &&
      this.detail()?.ride.status !== 'ride_cancelled',
  );

  readonly returnLabel = computed(() => {
    const ride = this.detail()?.ride;
    if (!ride?.returnNeeded) {
      return 'No return trip requested';
    }
    const time = ride.returnPickupTime
      ? formatTimeLabel(ride.returnPickupTime)
      : 'TBD';
    return `Yes, pick up at approximately ${time}`;
  });

  readonly calendarStatus = computed((): CalendarSyncUiStatus => {
    const ride = this.detail()?.ride;
    if (!ride || (!this.isRider() && !this.isAssignedAngel())) {
      return 'not_applicable';
    }
    // Riders sync from create; angels only while assigned.
    if (!this.isRider() && !this.detail()?.assignment) {
      return 'idle';
    }
    return this.calendarSync.rideStatuses()[ride.id] ?? 'idle';
  });

  readonly showCalendarStatus = computed(() => {
    const status = this.calendarStatus();
    return status === 'synced' || status === 'failed';
  });

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.domainSync.refreshForCurrentUser({ force: true });
    } finally {
      event.target.complete();
    }
  }

  async retryCalendarSync(): Promise<void> {
    const d = this.detail();
    if (!d?.ride || !d.appointment) {
      return;
    }
    const rider = this.auth.getUserById(d.ride.riderId);
    await this.calendarSync.retryRide(d.ride.id, {
      ride: d.ride,
      appointment: d.appointment,
      assignment: d.assignment,
      riderName: rider?.displayName || d.ride.riderDisplayName,
      angelName: d.angel?.displayName,
    });
    const status = this.calendarSync.statusForRide(d.ride.id);
    if (status === 'synced') {
      await this.showToast('Added to your calendar.', 'primary');
    } else if (status === 'failed') {
      await this.showToast('Calendar sync failed. Try again later.', 'danger');
    } else if (status === 'disabled') {
      await this.showToast(
        'Turn on calendar sync in Profile to add this ride.',
        'danger',
      );
    }
  }

  callAngel(): void {
    if (this.isAssignedAngel()) {
      return;
    }
    const phone = this.detail()?.angel?.phone;
    if (phone) {
      window.location.href = `tel:${phone.replace(/\D/g, '')}`;
    }
  }

  editAppointment(): void {
    const id = this.appointmentId();
    if (!id) {
      return;
    }
    void this.router.navigate(['/tabs/home/appointment', id, 'edit']);
  }

  async offerToDrive(): Promise<void> {
    const item = this.claimableItem();
    if (!item || !this.canOfferToDrive()) {
      return;
    }
    try {
      const result = await promptOfferNote(this.alert, item);
      if (result === null) {
        return;
      }
      await this.board.respondICanDrive(item, result);
      await this.showToast(
        `Offer sent for ${item.title}. The rider will choose a driver.`,
        'primary',
      );
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Unable to send offer.',
        'danger',
      );
    }
  }

  async withdrawMyOffer(): Promise<void> {
    const item = this.claimableItem();
    const rideId = item?.rideRequestId ?? this.detail()?.ride.id;
    if (!rideId || !this.offerPendingAsAngel()) {
      return;
    }

    const offerId = this.offers.getPendingOfferIdForCurrentAngel(rideId);
    if (!offerId) {
      return;
    }

    const reason = await promptWithdrawOfferReason(this.alert, () => {
      void this.showToast(
        'Please add a short reason before continuing.',
        'danger',
      );
    });
    if (reason === null) {
      return;
    }

    try {
      await this.offers.withdrawOffer(offerId, reason);
      await this.showToast('Offer removed. The rider was notified.', 'primary');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Unable to remove offer.',
        'danger',
      );
    }
  }

  async cancelAppointment(): Promise<void> {
    const d = this.detail();
    if (!d || !this.canManageAsRider()) {
      return;
    }

    const claimed = !!d.assignment;
    if (claimed) {
      const reason = await this.promptReason({
        header: 'Cancel appointment?',
        message: `"${d.appointment.title}" is claimed. Share a short reason for your Ride Angel.`,
        placeholder: 'e.g. Appointment was rescheduled by the clinic.',
        confirmLabel: 'Cancel trip',
        cancelLabel: 'Keep appointment',
      });
      if (reason === null) {
        return;
      }
      try {
        await this.appointments.cancelAppointment(d.appointment.id, reason);
        await this.showToast(
          'Appointment cancelled. Your Ride Angel was notified.',
          'primary',
        );
        void this.router.navigate(['/tabs/home']);
      } catch (err) {
        await this.showToast(
          err instanceof Error ? err.message : 'Could not cancel appointment.',
          'danger',
        );
      }
      return;
    }

    const confirmed = await this.confirmSimpleCancel(d.appointment.title);
    if (!confirmed) {
      return;
    }
    try {
      await this.appointments.cancelAppointment(d.appointment.id);
      await this.showToast('Appointment cancelled.', 'primary');
      void this.router.navigate(['/tabs/home']);
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not cancel appointment.',
        'danger',
      );
    }
  }

  async confirmStillDriving(): Promise<void> {
    const ride = this.detail()?.ride;
    if (!ride) {
      return;
    }
    try {
      await this.appointments.confirmAssignmentAfterChange(ride.id);
      await this.showToast("Thanks — you're still confirmed for this trip.", 'primary');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not confirm changes.',
        'danger',
      );
    }
  }

  async cancelAsAngel(): Promise<void> {
    const d = this.detail();
    if (!d?.ride || !this.canCancelAsAngel()) {
      return;
    }

    const reason = await this.promptReason({
      header: "Can't drive this trip?",
      message:
        'Share a short reason for the rider. The appointment will go back to unclaimed.',
      placeholder: 'e.g. Something came up and I am no longer available.',
      confirmLabel: "I can't drive",
      cancelLabel: 'Keep claim',
    });
    if (reason === null) {
      return;
    }

    try {
      await this.appointments.cancelAssignmentByAngel(d.ride.id, reason);
      await this.showToast(
        'Trip released. The rider was notified and the request is open again.',
        'primary',
      );
      void this.router.navigate(['/tabs/home']);
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not cancel this trip.',
        'danger',
      );
    }
  }

  async acceptOffer(offerId: string, angelName: string): Promise<void> {
    await this.offers.acceptOffer(offerId);
    const toast = await this.toast.create({
      message: `${angelName} is now your Ride Angel for this trip.`,
      duration: 2200,
      position: 'top',
      color: 'primary',
    });
    await toast.present();
  }

  async declineOffer(offerId: string): Promise<void> {
    await this.offers.declineOffer(offerId);
    const toast = await this.toast.create({
      message: 'Offer declined.',
      duration: 1600,
      position: 'top',
    });
    await toast.present();
  }

  private async promptReason(input: {
    header: string;
    message: string;
    placeholder: string;
    confirmLabel: string;
    cancelLabel: string;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      void this.alert
        .create({
          header: input.header,
          message: input.message,
          inputs: [
            {
              name: 'reason',
              type: 'textarea',
              placeholder: input.placeholder,
              attributes: { maxlength: 280, rows: 3 },
            },
          ],
          buttons: [
            {
              text: input.cancelLabel,
              role: 'cancel',
              handler: () => {
                resolve(null);
              },
            },
            {
              text: input.confirmLabel,
              role: 'destructive',
              handler: (data: { reason?: string }) => {
                const reason = data.reason?.trim() ?? '';
                if (!reason) {
                  void this.showToast(
                    'Please add a short reason before continuing.',
                    'danger',
                  );
                  return false;
                }
                resolve(reason);
                return true;
              },
            },
          ],
        })
        .then((alert) => {
          void alert.present();
        });
    });
  }

  private async confirmSimpleCancel(title: string): Promise<boolean> {
    const alert = await this.alert.create({
      header: 'Cancel appointment?',
      message: `Remove "${title}"? This request hasn't been claimed yet.`,
      buttons: [
        { text: 'Keep', role: 'cancel' },
        { text: 'Cancel trip', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'destructive';
  }

  private async showToast(
    message: string,
    color: 'primary' | 'danger' = 'primary',
  ): Promise<void> {
    const toast = await this.toast.create({
      message,
      duration: 2400,
      position: 'top',
      color,
    });
    await toast.present();
  }
}
