import {
  CalendarProviderId,
  ExternalCalendarInfo,
  RideCalendarEventPayload,
} from '../models/calendar';

export interface CalendarConnectResult {
  ok: boolean;
  status:
    | 'connected'
    | 'permission_denied'
    | 'cancelled'
    | 'error'
    | 'unavailable'
    | 'expired';
  accountEmail?: string;
  message?: string;
}

export interface CalendarWriteResult {
  ok: boolean;
  externalEventId?: string;
  externalCalendarId?: string;
  message?: string;
  /** True when the prior event was missing and a new one was created. */
  recreated?: boolean;
}

/**
 * Provider-agnostic calendar port.
 * Ride domain must depend on this interface, never Apple/Google SDKs.
 */
export interface CalendarProvider {
  readonly id: CalendarProviderId;

  /** Whether this provider can run on the current platform. */
  isAvailable(): boolean;

  connect(): Promise<CalendarConnectResult>;

  disconnect(): Promise<void>;

  testConnection(): Promise<CalendarConnectResult>;

  refreshConnection(): Promise<CalendarConnectResult>;

  listCalendars(): Promise<ExternalCalendarInfo[]>;

  createRideEvent(
    calendarId: string | null,
    payload: RideCalendarEventPayload,
  ): Promise<CalendarWriteResult>;

  updateRideEvent(
    calendarId: string | null,
    externalEventId: string,
    payload: RideCalendarEventPayload,
  ): Promise<CalendarWriteResult>;

  deleteRideEvent(
    calendarId: string | null,
    externalEventId: string,
  ): Promise<CalendarWriteResult>;
}

export const CALENDAR_PROVIDERS = new (class {
  // Injection token placeholder — real token lives in tokens.ts
})();
