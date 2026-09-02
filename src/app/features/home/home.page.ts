import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import {
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { RideCardView } from '../../core/models';
import { AppointmentService } from '../../core/services/appointment.service';
import { AuthService } from '../../core/services/auth.service';
import { DomainSyncService } from '../../core/services/domain-sync.service';
import { NotificationService } from '../../core/services/notification.service';
import { RideAngelService } from '../../core/services/ride-angel.service';
import { OfferListItem, RideOfferService } from '../../core/services/ride-offer.service';
import { groupRidesByDay, toDateKey } from '../../core/utils/date-time';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { ProfileAvatarComponent } from '../../shared/components/profile-avatar/profile-avatar.component';
import { RideCardComponent } from '../../shared/components/ride-card/ride-card.component';

const CONTACT_NUDGE_DISMISSED_KEY = 'ra.contactNudgeDismissed';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    IonHeader,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    BrandLogoComponent,
    ProfileAvatarComponent,
    RideCardComponent,
  ],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements ViewWillEnter {
  private readonly auth = inject(AuthService);
  private readonly appointments = inject(AppointmentService);
  private readonly offers = inject(RideOfferService);
  private readonly angels = inject(RideAngelService);
  private readonly notifications = inject(NotificationService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly router = inject(Router);

  readonly user = computed(() => this.auth.getCurrentUserOrNull());
  readonly persona = this.auth.activePersona;
  readonly rides = this.appointments.scheduledRides;
  readonly upcomingDrives = this.appointments.upcomingDrives;
  readonly pendingOffers = this.offers.pendingOffersForCurrentRider;
  readonly pendingInvites = this.angels.pendingIncoming;
  readonly unread = this.notifications.unreadForCurrentUser;
  readonly contactNudgeDismissed = signal(false);

  readonly missingPhone = computed(() => {
    void this.auth.currentUser();
    return this.auth
      .getLinkedSignInMethods()
      .some((m) => m.channel === 'phone' && m.status === 'not_added');
  });

  readonly missingEmail = computed(() => {
    void this.auth.currentUser();
    return this.auth
      .getLinkedSignInMethods()
      .some((m) => m.channel === 'email' && m.status === 'not_added');
  });

  readonly showContactNudge = computed(
    () =>
      !this.contactNudgeDismissed() &&
      (this.missingPhone() || this.missingEmail()),
  );

  readonly contactNudgeTitle = computed(() => {
    if (this.missingPhone() && !this.missingEmail()) {
      return 'Add a phone so family can find you';
    }
    if (this.missingEmail() && !this.missingPhone()) {
      return 'Add an email for backup sign-in';
    }
    return 'Add another way to sign in';
  });

  readonly contactNudgeBody = computed(() => {
    if (this.missingPhone() && !this.missingEmail()) {
      return 'Helps people invite you and Call / Text for rides — same account.';
    }
    if (this.missingEmail() && !this.missingPhone()) {
      return 'Useful if you change phones — same Ride Angels account.';
    }
    return 'Phone and email both help family reach the same account.';
  });

  readonly todayLabel = computed(() => {
    // Recompute when rides refresh so midnight rollover picks up after sync.
    void this.rides();
    void this.upcomingDrives();
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return { weekday, monthDay, dateKey: toDateKey(now) };
  });

  readonly rideDayGroups = computed(() => groupRidesByDay(this.rides()));
  readonly driveDayGroups = computed(() =>
    groupRidesByDay(this.upcomingDrives()),
  );

  ionViewWillEnter(): void {
    void this.domainSync.refreshForCurrentUser();
    void this.loadContactNudgeDismissed();
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.domainSync.refreshForCurrentUser({ force: true });
    } finally {
      event.target.complete();
    }
  }

  openContactNudge(): void {
    const channel = this.missingPhone()
      ? 'phone'
      : this.missingEmail()
        ? 'email'
        : null;
    void this.router.navigate(['/account/security'], {
      queryParams: channel
        ? { prompt: 'recovery', change: channel }
        : { prompt: 'recovery' },
    });
  }

  async dismissContactNudge(): Promise<void> {
    this.contactNudgeDismissed.set(true);
    await Preferences.set({ key: CONTACT_NUDGE_DISMISSED_KEY, value: '1' });
  }

  openRide(ride: RideCardView): void {
    void this.router.navigate(['/tabs/home/appointment', ride.appointmentId]);
  }

  addAppointment(): void {
    void this.router.navigate(['/tabs/home/add-appointment']);
  }

  openNotifications(): void {
    void this.router.navigate(['/tabs/home/notifications']);
  }

  openProfile(): void {
    void this.router.navigate(['/tabs/profile']);
  }

  openOffers(): void {
    const first = this.pendingOffers()[0];
    if (first) {
      void this.router.navigate(['/tabs/home/appointment', first.appointmentId]);
    }
  }

  openInvites(): void {
    void this.router.navigate(['/tabs/ride-angels']);
  }

  openOpenRequests(): void {
    void this.router.navigate(['/tabs/calendar']);
  }

  openOffer(item: OfferListItem): void {
    void this.router.navigate(['/tabs/home/appointment', item.appointmentId]);
  }

  private async loadContactNudgeDismissed(): Promise<void> {
    const { value } = await Preferences.get({
      key: CONTACT_NUDGE_DISMISSED_KEY,
    });
    this.contactNudgeDismissed.set(value === '1');
  }
}
