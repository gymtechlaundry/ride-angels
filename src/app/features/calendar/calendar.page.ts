import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import {
  RideCardView,
} from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CalendarScheduleService } from '../../core/services/calendar-schedule.service';
import { ClaimBoardService } from '../../core/services/claim-board.service';
import { DomainSyncService } from '../../core/services/domain-sync.service';
import { AppointmentService } from '../../core/services/appointment.service';
import { toDateKey } from '../../core/utils/date-time';
import { CalendarMonthComponent } from '../../shared/components/calendar-month/calendar-month.component';
import { ClaimBoardCardComponent } from '../../shared/components/claim-board-card/claim-board-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { RideCardComponent } from '../../shared/components/ride-card/ride-card.component';

export type ScheduleViewMode = 'calendar' | 'list';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    IonHeader,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
    CalendarMonthComponent,
    ClaimBoardCardComponent,
    RideCardComponent,
  ],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
})
export class CalendarPage implements OnInit, ViewWillEnter {
  private readonly appointments = inject(AppointmentService);
  private readonly board = inject(ClaimBoardService);
  private readonly schedule = inject(CalendarScheduleService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly selectedDate = signal(toDateKey(new Date()));
  readonly viewMode = signal<ScheduleViewMode>('calendar');
  readonly persona = this.auth.activePersona;
  readonly openRequests = this.board.openBoardItems;
  readonly dayEvents = this.schedule.dayEvents;

  /** Full chronological list for rider list mode. */
  readonly riderListRides = computed(() =>
    [...this.appointments.scheduledRides()].sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    ),
  );

  readonly title = computed(() =>
    this.viewMode() === 'list'
      ? this.persona() === 'angel'
        ? 'Open requests'
        : 'Ride list'
      : 'Calendar',
  );

  readonly subtitle = computed(() => {
    if (this.viewMode() === 'list') {
      return this.persona() === 'angel'
        ? 'Angel mode · open requests from your circle'
        : 'Rider mode · all of your upcoming rides';
    }
    return this.persona() === 'angel'
      ? 'Angel mode · tap a day for drives and open requests'
      : 'Rider mode · tap a day for scheduled rides';
  });

  ngOnInit(): void {
    const view = this.route.snapshot.queryParamMap.get('view');
    if (view === 'list') {
      this.viewMode.set('list');
    }
  }

  ionViewWillEnter(): void {
    void this.domainSync.refreshForCurrentUser();
    const view = this.route.snapshot.queryParamMap.get('view');
    if (view === 'list' || view === 'calendar') {
      this.viewMode.set(view);
    }
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.domainSync.refreshForCurrentUser({ force: true });
    } finally {
      event.target.complete();
    }
  }

  setViewMode(mode: ScheduleViewMode): void {
    this.viewMode.set(mode);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: mode === 'list' ? { view: 'list' } : {},
      replaceUrl: true,
    });
  }

  onSelectDate(date: string): void {
    this.selectedDate.set(date);
    void this.router.navigate(['/tabs/calendar/day', date]);
  }

  openRide(appointmentId: string): void {
    void this.router.navigate(['/tabs/home/appointment', appointmentId]);
  }

  openRideCard(ride: RideCardView): void {
    void this.router.navigate(['/tabs/home/appointment', ride.appointmentId]);
  }
}
