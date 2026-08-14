import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { map } from 'rxjs';
import { RideCardView } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CalendarScheduleService } from '../../core/services/calendar-schedule.service';
import { DomainSyncService } from '../../core/services/domain-sync.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { RideCardComponent } from '../../shared/components/ride-card/ride-card.component';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

@Component({
  selector: 'app-calendar-day-page',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
    RideCardComponent,
  ],
  templateUrl: './calendar-day.page.html',
  styleUrl: './calendar-day.page.scss',
})
export class CalendarDayPage implements ViewWillEnter {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly schedule = inject(CalendarScheduleService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly auth = inject(AuthService);

  private readonly routeDate = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('date') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('date') ?? '' },
  );

  readonly dateKey = computed(() => {
    const raw = this.routeDate();
    return DATE_KEY.test(raw) ? raw : '';
  });

  readonly title = computed(() => {
    const key = this.dateKey();
    if (!key) {
      return 'Day';
    }
    const d = new Date(`${key}T12:00:00`);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  });

  readonly subtitle = computed(() =>
    this.auth.activePersona() === 'angel'
      ? 'Drives and open requests for this day'
      : 'Rides scheduled for this day',
  );

  readonly dayRides = computed(() => {
    const key = this.dateKey();
    return key ? this.schedule.ridesForDate(key) : [];
  });

  ionViewWillEnter(): void {
    const key = this.dateKey();
    if (!key) {
      void this.router.navigate(['/tabs/calendar'], { replaceUrl: true });
      return;
    }
    void this.domainSync.refreshForCurrentUser();
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.domainSync.refreshForCurrentUser();
    } finally {
      event.target.complete();
    }
  }

  openRideCard(ride: RideCardView): void {
    void this.router.navigate(['/tabs/home/appointment', ride.appointmentId]);
  }
}
