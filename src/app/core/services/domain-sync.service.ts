import { Injectable, inject } from '@angular/core';
import {
  APPOINTMENT_REPOSITORY,
  PROFILE_DIRECTORY,
  RIDE_ANGEL_CONNECTION_REPOSITORY,
  RIDE_ASSIGNMENT_REPOSITORY,
  RIDE_OFFER_REPOSITORY,
  RIDE_REQUEST_REPOSITORY,
} from '../repositories/tokens';
import { isSupabaseConfigured } from '../supabase/supabase-client';
import { isAuthSessionFailure } from '../utils/auth-errors';
import { AppointmentService } from './appointment.service';
import { AuthService } from './auth.service';
import { CalendarSyncService } from './calendar-sync.service';
import { NotificationService } from './notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { RideAngelService } from './ride-angel.service';
import { RideOfferService } from './ride-offer.service';
import { RideRealtimeService } from './ride-realtime.service';

export type DomainRefreshOptions = {
  /** Bypass freshness TTL (pull-to-refresh, post-auth, mutations). */
  force?: boolean;
  /**
   * Reconcile device calendar events.
   * Defaults to true when `force` is set; false for soft / realtime refreshes.
   */
  reconcileCalendar?: boolean;
};

/**
 * Loads ride-domain data from Supabase after auth is ready.
 * Keeps Appointment / Offer / Connection services in sync for multi-account use.
 *
 * Soft tab enters reuse a recent sync (TTL). Pull-to-refresh and auth use `force`.
 * Realtime notification rows refresh inbox only; ride-table changes force a domain
 * reload without calendar reconcile unless assignments/requests change.
 */
@Injectable({ providedIn: 'root' })
export class DomainSyncService {
  private static readonly SOFT_TTL_MS = 45_000;

  private readonly auth = inject(AuthService);
  private readonly appointmentsRepo = inject(APPOINTMENT_REPOSITORY);
  private readonly rideRequestsRepo = inject(RIDE_REQUEST_REPOSITORY);
  private readonly assignmentsRepo = inject(RIDE_ASSIGNMENT_REPOSITORY);
  private readonly offersRepo = inject(RIDE_OFFER_REPOSITORY);
  private readonly connectionsRepo = inject(RIDE_ANGEL_CONNECTION_REPOSITORY);
  private readonly profileDirectory = inject(PROFILE_DIRECTORY);
  private readonly appointments = inject(AppointmentService);
  private readonly offers = inject(RideOfferService);
  private readonly angels = inject(RideAngelService);
  private readonly notifications = inject(NotificationService);
  private readonly notifPrefs = inject(NotificationPreferencesService);
  private readonly calendarSync = inject(CalendarSyncService);
  private readonly realtime = inject(RideRealtimeService);

  private inflight: Promise<void> | null = null;
  private lastCompletedAt = 0;
  private queuedForce: DomainRefreshOptions | null = null;

  async refreshForCurrentUser(
    options: DomainRefreshOptions = {},
  ): Promise<void> {
    if (!isSupabaseConfigured() || !this.auth.getCurrentUserOrNull()) {
      return;
    }

    const force = options.force === true;
    if (
      !force &&
      this.lastCompletedAt > 0 &&
      Date.now() - this.lastCompletedAt < DomainSyncService.SOFT_TTL_MS
    ) {
      this.ensureRealtime();
      return;
    }

    if (this.inflight) {
      if (force) {
        this.queuedForce = {
          ...options,
          force: true,
          reconcileCalendar: options.reconcileCalendar ?? true,
        };
      }
      return this.inflight;
    }

    this.inflight = this.runRefresh(options)
      .catch(async (err) => {
        if (isAuthSessionFailure(err)) {
          await this.auth.handleExpiredSession();
          return;
        }
        throw err;
      })
      .finally(() => {
        this.inflight = null;
        this.lastCompletedAt = Date.now();
        const queued = this.queuedForce;
        this.queuedForce = null;
        if (queued) {
          void this.refreshForCurrentUser(queued);
        }
      });

    return this.inflight;
  }

  /** Drop in-memory ride/notification caches (sign-out / expired session). */
  clearLocal(): void {
    this.realtime.stop();
    this.lastCompletedAt = 0;
    this.queuedForce = null;
    this.appointments.replaceAll([], [], []);
    this.offers.replaceAll([]);
    this.angels.replaceAll([]);
    this.notifications.replaceAll([]);
  }

  stop(): void {
    this.realtime.stop();
  }

  private ensureRealtime(): void {
    this.realtime.startForCurrentUser((table) => {
      void this.onRealtimeTableChange(table);
    });
  }

  private async onRealtimeTableChange(table: string): Promise<void> {
    if (table === 'notifications') {
      try {
        await this.notifications.refreshForCurrentUser();
      } catch (err) {
        if (isAuthSessionFailure(err)) {
          await this.auth.handleExpiredSession();
        }
      }
      return;
    }

    const reconcileCalendar =
      table === 'ride_assignments' || table === 'ride_requests';
    await this.refreshForCurrentUser({
      force: true,
      reconcileCalendar,
    });
  }

  private async runRefresh(options: DomainRefreshOptions): Promise<void> {
    const force = options.force === true;
    const reconcileCalendar = options.reconcileCalendar ?? force;

    const [appts, rides, assignments, offers, connections] = await Promise.all([
      this.appointmentsRepo.listVisible(),
      this.rideRequestsRepo.listVisible(),
      this.assignmentsRepo.listVisible(),
      this.offersRepo.listVisible(),
      this.connectionsRepo.listForCurrentUser(),
    ]);

    this.appointments.replaceAll(appts, rides, assignments);
    this.offers.replaceAll(offers);
    this.angels.replaceAll(connections);
    await this.notifPrefs.load();
    await this.notifications.refreshForCurrentUser();
    this.ensureRealtime();

    const profileIds = new Set<string>();
    for (const a of appts) {
      profileIds.add(a.riderId);
    }
    for (const r of rides) {
      profileIds.add(r.riderId);
    }
    for (const o of offers) {
      profileIds.add(o.angelId);
    }
    for (const c of connections) {
      profileIds.add(c.riderId);
      profileIds.add(c.angelId);
    }
    for (const asg of assignments) {
      profileIds.add(asg.angelId);
    }

    const profiles = await this.profileDirectory.loadByIds([...profileIds]);
    for (const profile of profiles) {
      this.auth.rememberUser(profile);
    }

    // Seed directory stubs from denormalized names when profile RLS hides a row.
    for (const ride of rides) {
      if (ride.riderDisplayName && !this.auth.getUserById(ride.riderId)) {
        this.auth.rememberUser({
          id: ride.riderId,
          authUserId: ride.riderId,
          firstName: ride.riderDisplayName.split(' ')[0] ?? '',
          lastName: '',
          displayName: ride.riderDisplayName,
          roles: ['rider'],
          onboardingCompleted: true,
        });
      }
    }
    for (const offer of offers) {
      if (offer.angelDisplayName && !this.auth.getUserById(offer.angelId)) {
        this.auth.rememberUser({
          id: offer.angelId,
          authUserId: offer.angelId,
          firstName: offer.angelDisplayName.split(' ')[0] ?? '',
          lastName: '',
          displayName: offer.angelDisplayName,
          roles: ['rideAngel'],
          onboardingCompleted: true,
        });
      }
    }
    for (const c of connections) {
      if (c.riderDisplayName && !this.auth.getUserById(c.riderId)) {
        this.auth.rememberUser({
          id: c.riderId,
          authUserId: c.riderId,
          firstName: '',
          lastName: '',
          displayName: c.riderDisplayName,
          roles: ['rider'],
          onboardingCompleted: true,
        });
      }
      if (c.angelDisplayName && !this.auth.getUserById(c.angelId)) {
        this.auth.rememberUser({
          id: c.angelId,
          authUserId: c.angelId,
          firstName: '',
          lastName: '',
          displayName: c.angelDisplayName,
          roles: ['rideAngel'],
          onboardingCompleted: true,
        });
      }
    }

    if (reconcileCalendar) {
      void this.calendarSync.reconcileForCurrentUser({
        appointments: appts,
        rides,
        assignments,
        users: this.auth.listUsers().map((u) => ({
          id: u.id,
          displayName: u.displayName,
        })),
      });
    }
  }
}
