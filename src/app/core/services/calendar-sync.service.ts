import { Injectable, computed, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CalendarPreferences,
  CalendarProviderId,
  ExternalCalendarInfo,
  RideCalendarEventPayload,
  RideCalendarEventRecord,
} from '../models/calendar';
import { Appointment, RideAssignment, RideRequest } from '../models';
import { CALENDAR_REPOSITORY } from '../repositories/tokens';
import { isSupabaseConfigured } from '../supabase/supabase-client';
import { AuthService } from '../services/auth.service';
import { AppleCalendarProvider } from '../calendar/apple-calendar.provider';
import { GoogleCalendarProvider } from '../calendar/google-calendar.provider';
import { CalendarProvider } from '../calendar/calendar-provider';

export type CalendarSyncUiStatus =
  | 'idle'
  | 'synced'
  | 'failed'
  | 'disabled'
  | 'not_applicable';

/**
 * Orchestrates calendar sync for the *current user only* (device-local providers).
 * Never throws into ride claim/update/cancel flows.
 */
@Injectable({ providedIn: 'root' })
export class CalendarSyncService {
  private readonly auth = inject(AuthService);
  private readonly calendarRepo = inject(CALENDAR_REPOSITORY);
  private readonly apple = inject(AppleCalendarProvider);
  private readonly google = inject(GoogleCalendarProvider);

  private readonly preferences = signal<CalendarPreferences | null>(null);
  private readonly events = signal<RideCalendarEventRecord[]>([]);
  private readonly lastStatusByRide = signal<Record<string, CalendarSyncUiStatus>>(
    {},
  );

  readonly prefs = this.preferences.asReadonly();
  readonly syncEnabled = computed(() => !!this.preferences()?.syncEnabled);
  readonly rideStatuses = this.lastStatusByRide.asReadonly();

  private get providers(): CalendarProvider[] {
    return [this.apple, this.google];
  }

  provider(id: CalendarProviderId): CalendarProvider {
    return id === 'apple' ? this.apple : this.google;
  }

  statusForRide(rideRequestId: string): CalendarSyncUiStatus {
    return this.lastStatusByRide()[rideRequestId] ?? 'idle';
  }

  async loadPreferences(): Promise<CalendarPreferences | null> {
    const user = this.auth.getCurrentUserOrNull();
    if (!user) {
      this.preferences.set(null);
      return null;
    }
    if (!isSupabaseConfigured()) {
      const local = this.preferences();
      return local;
    }
    try {
      const prefs = await this.calendarRepo.getPreferences(user.id);
      this.preferences.set(prefs);
      if (prefs) {
        const list = await this.calendarRepo.listEventsForProfile(user.id);
        this.events.set(list);
      }
      return prefs;
    } catch (err) {
      console.warn('[calendar] load preferences failed', err);
      return this.preferences();
    }
  }

  async savePreferences(patch: {
    syncEnabled?: boolean;
    preferredProvider?: CalendarProviderId | null;
    selectedCalendarId?: string | null;
    selectedCalendarName?: string | null;
    connectionStatus?: CalendarPreferences['connectionStatus'];
    googleAccountEmail?: string | null;
    lastError?: string | null;
  }): Promise<CalendarPreferences | null> {
    const user = this.auth.getCurrentUserOrNull();
    if (!user) {
      return null;
    }
    if (!isSupabaseConfigured()) {
      const next: CalendarPreferences = {
        profileId: user.id,
        syncEnabled: patch.syncEnabled ?? this.preferences()?.syncEnabled ?? false,
        preferredProvider:
          patch.preferredProvider !== undefined
            ? patch.preferredProvider
            : this.preferences()?.preferredProvider ?? null,
        selectedCalendarId:
          patch.selectedCalendarId !== undefined
            ? patch.selectedCalendarId
            : this.preferences()?.selectedCalendarId ?? null,
        selectedCalendarName:
          patch.selectedCalendarName !== undefined
            ? patch.selectedCalendarName
            : this.preferences()?.selectedCalendarName ?? null,
        connectionStatus:
          patch.connectionStatus ??
          this.preferences()?.connectionStatus ??
          'not_connected',
        googleAccountEmail:
          patch.googleAccountEmail !== undefined
            ? patch.googleAccountEmail
            : this.preferences()?.googleAccountEmail ?? null,
        lastError:
          patch.lastError !== undefined
            ? patch.lastError
            : this.preferences()?.lastError ?? null,
        createdAt: this.preferences()?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.preferences.set(next);
      return next;
    }
    const saved = await this.calendarRepo.upsertPreferences(patch);
    this.preferences.set(saved);
    return saved;
  }

  async connectProvider(id: CalendarProviderId): Promise<{
    ok: boolean;
    message?: string;
  }> {
    if (id === 'google') {
      return {
        ok: false,
        message: 'Google Calendar sync is not available in this version.',
      };
    }
    const provider = this.provider(id);
    if (!provider.isAvailable()) {
      return {
        ok: false,
        message:
          id === 'apple'
            ? 'Apple Calendar requires an iPhone or iPad.'
            : 'Google Calendar is not available in this version.',
      };
    }
    const result = await provider.connect();
    if (!result.ok) {
      await this.savePreferences({
        preferredProvider: id,
        syncEnabled: false,
        connectionStatus:
          result.status === 'permission_denied'
            ? 'permission_denied'
            : result.status === 'unavailable'
              ? 'not_connected'
              : 'error',
        lastError: result.message ?? null,
      });
      return { ok: false, message: result.message };
    }

    let calendars: ExternalCalendarInfo[] = [];
    try {
      calendars = await provider.listCalendars();
    } catch {
      calendars = [];
    }
    const selected =
      calendars.find((c) => c.isPrimary) ||
      calendars.find((c) => c.allowsModifications !== false) ||
      calendars[0];

    await this.savePreferences({
      preferredProvider: id,
      syncEnabled: true,
      connectionStatus: 'connected',
      selectedCalendarId: selected?.id ?? null,
      selectedCalendarName: selected?.name ?? null,
      googleAccountEmail: result.accountEmail ?? null,
      lastError: null,
    });
    return { ok: true };
  }

  async disconnect(): Promise<void> {
    const prefs = this.preferences();
    if (prefs?.preferredProvider) {
      await this.provider(prefs.preferredProvider).disconnect().catch(() => undefined);
    }
    await this.savePreferences({
      preferredProvider: null,
      syncEnabled: false,
      connectionStatus: 'not_connected',
      selectedCalendarId: null,
      selectedCalendarName: null,
      googleAccountEmail: null,
      lastError: null,
    });
  }

  async listCalendarsForPreferred(): Promise<ExternalCalendarInfo[]> {
    const prefs = this.preferences() ?? (await this.loadPreferences());
    if (!prefs?.preferredProvider) {
      return [];
    }
    return this.provider(prefs.preferredProvider).listCalendars();
  }

  async selectCalendar(calendar: ExternalCalendarInfo): Promise<void> {
    const prefs = this.preferences();
    await this.savePreferences({
      preferredProvider: prefs?.preferredProvider ?? 'apple',
      connectionStatus: 'connected',
      syncEnabled: true,
      selectedCalendarId: calendar.id,
      selectedCalendarName: calendar.name,
      lastError: null,
    });
  }

  /**
   * Reconcile current user's calendar for one ride.
   * Safe to call after create / claim / accept / update / cancel / refresh.
   * Riders sync appointments as soon as they are created; angels sync while assigned.
   */
  async syncRideForCurrentUser(input: {
    ride: RideRequest;
    appointment: Appointment;
    assignment?: RideAssignment | null;
    riderName?: string;
    angelName?: string;
  }): Promise<void> {
    try {
      const user = this.auth.getCurrentUserOrNull();
      if (!user) {
        return;
      }
      const prefs = this.preferences() ?? (await this.loadPreferences());
      const rideId = input.ride.id;

      const isRider = input.ride.riderId === user.id;
      const isAngel = input.assignment?.angelId === user.id;
      const claimed =
        !!input.assignment &&
        (input.assignment.confirmationStatus === 'confirmed' ||
          input.assignment.confirmationStatus === 'pending_reconfirm' ||
          !input.assignment.confirmationStatus);
      const cancelled =
        input.appointment.status === 'cancelled' ||
        input.ride.status === 'cancelled' ||
        input.ride.status === 'ride_cancelled';

      if (!isRider && !isAngel) {
        this.patchStatus(rideId, 'not_applicable');
        return;
      }

      // Angel released / not assigned anymore → delete local event.
      if (isAngel && (!claimed || cancelled)) {
        await this.deleteCurrentUserEvent(rideId, prefs);
        this.patchStatus(rideId, cancelled ? 'disabled' : 'idle');
        return;
      }

      // Rider cancelled → delete.
      if (isRider && cancelled) {
        await this.deleteCurrentUserEvent(rideId, prefs);
        this.patchStatus(rideId, 'disabled');
        return;
      }

      // Rider: sync from create onward (title/date/time/notes).
      // Angel: only while assigned (claimed / needs reconfirm).
      if (isAngel && !claimed) {
        this.patchStatus(rideId, 'idle');
        return;
      }

      // V1: Apple Calendar only — ignore Google preferences until re-enabled.
      if (
        !prefs?.syncEnabled ||
        !prefs.preferredProvider ||
        prefs.preferredProvider === 'google'
      ) {
        this.patchStatus(rideId, 'disabled');
        return;
      }
      if (prefs.connectionStatus !== 'connected') {
        this.patchStatus(rideId, 'failed');
        return;
      }

      const provider = this.provider(prefs.preferredProvider);
      if (!provider.isAvailable() && Capacitor.isNativePlatform()) {
        this.patchStatus(rideId, 'failed');
        return;
      }

      const payload = this.buildPayload(input);
      const existing =
        isSupabaseConfigured()
          ? await this.calendarRepo.getActiveEvent(
              rideId,
              user.id,
              prefs.preferredProvider,
            )
          : this.events().find(
              (e) =>
                e.rideRequestId === rideId &&
                e.profileId === user.id &&
                e.provider === prefs.preferredProvider &&
                (e.syncStatus === 'synced' ||
                  e.syncStatus === 'pending' ||
                  e.syncStatus === 'failed'),
            );

      let result;
      if (existing?.externalEventId) {
        result = await provider.updateRideEvent(
          prefs.selectedCalendarId,
          existing.externalEventId,
          payload,
        );
      } else {
        result = await provider.createRideEvent(
          prefs.selectedCalendarId,
          payload,
        );
      }

      if (!result.ok) {
        await this.persistEventRow({
          rideRequestId: rideId,
          appointmentId: input.appointment.id,
          profileId: user.id,
          provider: prefs.preferredProvider,
          externalCalendarId: prefs.selectedCalendarId ?? undefined,
          externalEventId: existing?.externalEventId,
          syncStatus: 'failed',
          lastError: result.message ?? 'Sync failed',
        });
        await this.savePreferences({
          connectionStatus: 'error',
          lastError: result.message ?? 'Sync failed',
        });
        this.patchStatus(rideId, 'failed');
        return;
      }

      await this.persistEventRow({
        rideRequestId: rideId,
        appointmentId: input.appointment.id,
        profileId: user.id,
        provider: prefs.preferredProvider,
        externalCalendarId:
          result.externalCalendarId ?? prefs.selectedCalendarId ?? undefined,
        externalEventId: result.externalEventId,
        syncStatus: 'synced',
        lastError: null,
      });
      this.patchStatus(rideId, 'synced');
    } catch (err) {
      console.warn('[calendar] syncRideForCurrentUser failed', err);
      this.patchStatus(input.ride.id, 'failed');
    }
  }

  /** After domain refresh: sync rider appointments + angel claimed rides. */
  async reconcileForCurrentUser(input: {
    appointments: Appointment[];
    rides: RideRequest[];
    assignments: RideAssignment[];
    users: { id: string; displayName: string }[];
  }): Promise<void> {
    const user = this.auth.getCurrentUserOrNull();
    if (!user) {
      return;
    }
    await this.loadPreferences();
    const prefs = this.preferences();
    if (!prefs?.syncEnabled) {
      return;
    }

    for (const ride of input.rides) {
      const assignment = input.assignments.find(
        (a) =>
          a.rideRequestId === ride.id &&
          (a.confirmationStatus === 'confirmed' ||
            a.confirmationStatus === 'pending_reconfirm' ||
            !a.confirmationStatus),
      );
      const isRider = ride.riderId === user.id;
      const isAngel = assignment?.angelId === user.id;
      if (!isRider && !isAngel) {
        continue;
      }
      const appointment = input.appointments.find(
        (a) => a.id === ride.appointmentId,
      );
      if (!appointment) {
        continue;
      }
      const rider = input.users.find((u) => u.id === ride.riderId);
      const angel = assignment
        ? input.users.find((u) => u.id === assignment.angelId)
        : undefined;
      await this.syncRideForCurrentUser({
        ride,
        appointment,
        assignment,
        riderName: rider?.displayName || ride.riderDisplayName,
        angelName: angel?.displayName,
      });
    }
  }

  async retryRide(rideRequestId: string, input: {
    ride: RideRequest;
    appointment: Appointment;
    assignment?: RideAssignment | null;
    riderName?: string;
    angelName?: string;
  }): Promise<void> {
    await this.syncRideForCurrentUser(input);
  }

  private async deleteCurrentUserEvent(
    rideRequestId: string,
    prefs: CalendarPreferences | null,
  ): Promise<void> {
    const user = this.auth.getCurrentUserOrNull();
    if (!user || !prefs?.preferredProvider) {
      return;
    }
    const existing = isSupabaseConfigured()
      ? await this.calendarRepo.getActiveEvent(
          rideRequestId,
          user.id,
          prefs.preferredProvider,
        )
      : this.events().find(
          (e) =>
            e.rideRequestId === rideRequestId &&
            e.provider === prefs.preferredProvider,
        );
    if (existing?.externalEventId) {
      await this.provider(prefs.preferredProvider)
        .deleteRideEvent(
          existing.externalCalendarId ?? prefs.selectedCalendarId,
          existing.externalEventId,
        )
        .catch(() => undefined);
    }
    if (isSupabaseConfigured()) {
      await this.calendarRepo
        .markEventDeleted(rideRequestId, user.id, prefs.preferredProvider)
        .catch(() => undefined);
    }
    this.events.update((list) =>
      list.filter(
        (e) =>
          !(
            e.rideRequestId === rideRequestId &&
            e.provider === prefs.preferredProvider
          ),
      ),
    );
  }

  private async persistEventRow(input: {
    rideRequestId: string;
    appointmentId?: string;
    profileId: string;
    provider: CalendarProviderId;
    externalCalendarId?: string;
    externalEventId?: string;
    syncStatus: RideCalendarEventRecord['syncStatus'];
    lastError?: string | null;
  }): Promise<void> {
    if (!isSupabaseConfigured()) {
      const row: RideCalendarEventRecord = {
        id: `local-${input.rideRequestId}-${input.provider}`,
        rideRequestId: input.rideRequestId,
        appointmentId: input.appointmentId,
        profileId: input.profileId,
        provider: input.provider,
        externalCalendarId: input.externalCalendarId,
        externalEventId: input.externalEventId,
        syncStatus: input.syncStatus,
        lastSyncedAt:
          input.syncStatus === 'synced' ? new Date().toISOString() : undefined,
        lastError: input.lastError ?? undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.events.update((list) => {
        const next = list.filter(
          (e) =>
            !(
              e.rideRequestId === input.rideRequestId &&
              e.provider === input.provider
            ),
        );
        return [row, ...next];
      });
      return;
    }
    const saved = await this.calendarRepo.upsertActiveEvent(input);
    this.events.update((list) => {
      const next = list.filter((e) => e.id !== saved.id);
      return [saved, ...next];
    });
  }

  private buildPayload(input: {
    ride: RideRequest;
    appointment: Appointment;
    riderName?: string;
    angelName?: string;
  }): RideCalendarEventPayload {
    return {
      rideRequestId: input.ride.id,
      appointmentId: input.appointment.id,
      title: input.appointment.title,
      destinationLabel: input.ride.destination.label,
      pickupLabel: input.ride.pickup.label,
      pickupLine1: input.ride.pickup.line1,
      destinationLine1: input.ride.destination.line1,
      date: input.appointment.date,
      startTime: input.appointment.time,
      endTime: input.ride.returnPickupTime,
      riderName: input.riderName,
      angelName: input.angelName,
      notes: input.appointment.notes,
      deepLink: `org.rideangels.app://appointment/${input.appointment.id}`,
    };
  }

  private patchStatus(rideRequestId: string, status: CalendarSyncUiStatus): void {
    this.lastStatusByRide.update((map) => ({ ...map, [rideRequestId]: status }));
  }
}
