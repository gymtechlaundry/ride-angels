import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  CalendarPermissionScope,
  CapacitorCalendar,
} from '@capgo/capacitor-calendar';
import {
  CalendarConnectResult,
  CalendarProvider,
  CalendarWriteResult,
} from './calendar-provider';
import { buildCalendarEventContent } from './calendar-event-builder';
import {
  ExternalCalendarInfo,
  RideCalendarEventPayload,
} from '../models/calendar';

/**
 * On-device calendar via @capgo/capacitor-calendar.
 * Provider id stays `apple` for DB compatibility (calendar_preferences check).
 * - iOS: EventKit (Apple Calendar / iCloud / TimeTree when linked)
 * - Android: CalendarContract (Google Calendar, Samsung, etc. on device)
 */
@Injectable({ providedIn: 'root' })
export class AppleCalendarProvider implements CalendarProvider {
  readonly id = 'apple' as const;

  isAvailable(): boolean {
    if (!Capacitor.isNativePlatform()) {
      return false;
    }
    const platform = Capacitor.getPlatform();
    return platform === 'ios' || platform === 'android';
  }

  async connect(): Promise<CalendarConnectResult> {
    if (!this.isAvailable()) {
      return {
        ok: false,
        status: 'unavailable',
        message: 'Device calendar sync is only available in the iOS or Android app.',
      };
    }
    try {
      const { result } = await CapacitorCalendar.requestFullCalendarAccess();
      if (result === 'granted') {
        return { ok: true, status: 'connected' };
      }
      if (result === 'denied' || (result as string) === 'restricted') {
        return {
          ok: false,
          status: 'permission_denied',
          message: this.permissionDeniedMessage(),
        };
      }
      return {
        ok: false,
        status: 'error',
        message: `Calendar permission: ${result}`,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'error',
        message:
          err instanceof Error ? err.message : 'Could not connect device calendar.',
      };
    }
  }

  private permissionDeniedMessage(): string {
    return Capacitor.getPlatform() === 'android'
      ? 'Calendar access was denied. Enable it in Android Settings → Apps → Ride Angels → Permissions → Calendar.'
      : 'Calendar access was denied. Enable it in iOS Settings → Ride Angels → Calendars.';
  }

  async disconnect(): Promise<void> {
    // EventKit has no OAuth disconnect; preferences clear is handled by sync service.
  }

  async testConnection(): Promise<CalendarConnectResult> {
    if (!this.isAvailable()) {
      return { ok: false, status: 'unavailable' };
    }
    try {
      const { result } = await CapacitorCalendar.checkPermission({
        scope: CalendarPermissionScope.WRITE_CALENDAR,
      });
      if (result === 'granted') {
        return { ok: true, status: 'connected' };
      }
      if (result === 'denied' || (result as string) === 'restricted') {
        return { ok: false, status: 'permission_denied' };
      }
      return { ok: false, status: 'cancelled' };
    } catch {
      return { ok: false, status: 'error' };
    }
  }

  async refreshConnection(): Promise<CalendarConnectResult> {
    return this.testConnection();
  }

  async listCalendars(): Promise<ExternalCalendarInfo[]> {
    if (!this.isAvailable()) {
      return [];
    }
    const [{ result }, defaultCal] = await Promise.all([
      CapacitorCalendar.listCalendars(),
      CapacitorCalendar.getDefaultCalendar().catch(() => ({ result: null })),
    ]);
    const defaultId = defaultCal.result?.id
      ? String(defaultCal.result.id)
      : null;

    return (result ?? [])
      .filter((cal) => {
        // iOS: skip read-only calendars. Android leaves this null — keep those.
        if (cal.allowsContentModifications === false) return false;
        if (cal.isImmutable === true) return false;
        return true;
      })
      .map((cal) => {
        const title = String(cal.title || cal.internalTitle || '').trim();
        const source =
          cal.source && 'title' in cal.source && cal.source.title
            ? String(cal.source.title)
            : cal.accountName
              ? String(cal.accountName)
              : '';
        let name = title || 'Untitled calendar';
        // Disambiguate the common iOS default title "Calendar"
        if (source && (!title || title.toLowerCase() === 'calendar')) {
          name = source;
        } else if (source && title && !title.includes(source)) {
          name = `${title} (${source})`;
        }
        const id = String(cal.id);
        return {
          id,
          name,
          isPrimary: defaultId != null && id === defaultId,
          allowsModifications: cal.allowsContentModifications !== false,
        };
      });
  }

  async createRideEvent(
    calendarId: string | null,
    payload: RideCalendarEventPayload,
  ): Promise<CalendarWriteResult> {
    const content = buildCalendarEventContent(payload);
    try {
      const created = await CapacitorCalendar.createEvent({
        title: content.title,
        location: content.location,
        description: content.notes,
        startDate: content.startMs,
        endDate: content.endMs,
        calendarId: calendarId || undefined,
        url: payload.deepLink,
        alerts: [-60],
      });
      const eventId = created.id;
      if (!eventId) {
        return { ok: false, message: 'Device calendar did not return an event id.' };
      }
      return {
        ok: true,
        externalEventId: eventId,
        externalCalendarId: calendarId ?? undefined,
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Failed to create calendar event.',
      };
    }
  }

  async updateRideEvent(
    calendarId: string | null,
    externalEventId: string,
    payload: RideCalendarEventPayload,
  ): Promise<CalendarWriteResult> {
    const content = buildCalendarEventContent(payload);
    try {
      await CapacitorCalendar.modifyEvent({
        id: externalEventId,
        title: content.title,
        location: content.location,
        description: content.notes,
        startDate: content.startMs,
        endDate: content.endMs,
        calendarId: calendarId || undefined,
        url: payload.deepLink,
      });
      return {
        ok: true,
        externalEventId,
        externalCalendarId: calendarId ?? undefined,
      };
    } catch {
      const created = await this.createRideEvent(calendarId, payload);
      return { ...created, recreated: created.ok };
    }
  }

  async deleteRideEvent(
    _calendarId: string | null,
    externalEventId: string,
  ): Promise<CalendarWriteResult> {
    try {
      await CapacitorCalendar.deleteEvent({ id: externalEventId });
      return { ok: true, externalEventId };
    } catch {
      return { ok: true, externalEventId, message: 'Event already removed.' };
    }
  }
}
