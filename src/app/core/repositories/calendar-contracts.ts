import {
  CalendarPreferences,
  CalendarProviderId,
  RideCalendarEventRecord,
  CalendarEventSyncStatus,
  CalendarConnectionStatus,
} from '../models/calendar';

export interface CalendarPreferencesPatch {
  syncEnabled?: boolean;
  preferredProvider?: CalendarProviderId | null;
  selectedCalendarId?: string | null;
  selectedCalendarName?: string | null;
  connectionStatus?: CalendarConnectionStatus;
  googleAccountEmail?: string | null;
  lastError?: string | null;
}

export interface CalendarRepositoryPort {
  getPreferences(profileId: string): Promise<CalendarPreferences | null>;
  upsertPreferences(
    patch: CalendarPreferencesPatch,
  ): Promise<CalendarPreferences>;
  listEventsForProfile(profileId: string): Promise<RideCalendarEventRecord[]>;
  getActiveEvent(
    rideRequestId: string,
    profileId: string,
    provider: CalendarProviderId,
  ): Promise<RideCalendarEventRecord | null>;
  upsertActiveEvent(input: {
    rideRequestId: string;
    appointmentId?: string;
    profileId: string;
    provider: CalendarProviderId;
    externalCalendarId?: string;
    externalEventId?: string;
    syncStatus: CalendarEventSyncStatus;
    lastError?: string | null;
  }): Promise<RideCalendarEventRecord>;
  markEventDeleted(
    rideRequestId: string,
    profileId: string,
    provider: CalendarProviderId,
  ): Promise<void>;
}
