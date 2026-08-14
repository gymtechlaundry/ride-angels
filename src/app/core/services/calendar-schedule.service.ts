import { Injectable, computed, inject } from '@angular/core';
import {
  ClaimBoardItem,
  RideCardView,
} from '../models';
import {
  formatDateLabel,
  formatTimeLabel,
} from '../mock/mock-data';
import { AppointmentService } from './appointment.service';
import { AuthService } from './auth.service';
import { ClaimBoardService } from './claim-board.service';
import { RideOfferService } from './ride-offer.service';
import { CalendarDayEvent, CalendarDayMark } from '../../shared/components/calendar-month/calendar-month.component';

/**
 * Builds the calendar tab's ride set (rider scheduled rides, or angel open +
 * awaiting + claimed) and day-chip markers for the month grid.
 */
@Injectable({ providedIn: 'root' })
export class CalendarScheduleService {
  private readonly appointments = inject(AppointmentService);
  private readonly offers = inject(RideOfferService);
  private readonly board = inject(ClaimBoardService);
  private readonly auth = inject(AuthService);

  /** Rider rides, or angel claimed + awaiting + unclaimed open requests. */
  readonly calendarRides = computed(() => {
    if (this.auth.activePersona() === 'angel') {
      const unclaimed = this.board
        .allOpenBoardItems()
        .filter((item) => !item.offerPendingByCurrentUser)
        .map((item) => this.boardItemToCard(item));
      return this.mergeAngelCalendarRides(
        unclaimed,
        this.offers.pendingOfferCardsForCurrentAngel(),
        this.appointments.upcomingDrives(),
      );
    }
    return this.appointments.calendarRides();
  });

  /** TimeTree-style chips: every ride on a day, color-coded by status. */
  readonly dayEvents = computed(() => {
    const byDate: Record<string, CalendarDayEvent[]> = {};
    const rides = [...this.calendarRides()].sort((a, b) =>
      a.time.localeCompare(b.time),
    );
    for (const ride of rides) {
      const mark = this.markForRide(ride);
      const list = byDate[ride.date] ?? (byDate[ride.date] = []);
      list.push({
        id: ride.rideRequestId,
        title: ride.title,
        mark,
      });
    }
    return byDate;
  });

  ridesForDate(date: string): RideCardView[] {
    return this.calendarRides()
      .filter((r) => r.date === date)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  markForRide(ride: RideCardView): CalendarDayMark {
    if (ride.statusLabel === 'Unclaimed') {
      return 'unclaimed';
    }
    if (
      ride.statusLabel === 'Needs confirm' ||
      ride.statusLabel === 'Awaiting confirm'
    ) {
      return 'needs_confirm';
    }
    return 'claimed';
  }

  private boardItemToCard(item: ClaimBoardItem): RideCardView {
    const [fromLabel, toLabel] = item.routeLabel.includes(' to ')
      ? item.routeLabel.split(' to ').map((part) => part.trim())
      : [item.routeLabel, item.routeLabel];
    return {
      appointmentId: item.appointmentId,
      rideRequestId: item.rideRequestId,
      title: item.title,
      timeLabel: formatTimeLabel(item.time),
      dateLabel: formatDateLabel(item.date),
      fromLabel,
      toLabel,
      statusLabel: 'Unclaimed',
      date: item.date,
      time: item.time,
      viewAs: 'angel',
      riderName: item.riderName,
      visibility: item.visibility,
    };
  }

  /** Later sources win so claimed/awaiting override open unclaimed. */
  private mergeAngelCalendarRides(
    ...sources: RideCardView[][]
  ): RideCardView[] {
    const byRide = new Map<string, RideCardView>();
    for (const source of sources) {
      for (const ride of source) {
        byRide.set(ride.rideRequestId, ride);
      }
    }
    return Array.from(byRide.values()).sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    );
  }
}
