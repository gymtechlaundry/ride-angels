/** Calendar sync domain types — provider-agnostic. */

export type CalendarProviderId = 'apple' | 'google';

export type CalendarConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'permission_denied'
  | 'expired'
  | 'error';

export type CalendarEventSyncStatus =
  | 'pending'
  | 'synced'
  | 'failed'
  | 'deleted'
  | 'disabled';

export interface CalendarPreferences {
  profileId: string;
  syncEnabled: boolean;
  preferredProvider: CalendarProviderId | null;
  selectedCalendarId: string | null;
  selectedCalendarName: string | null;
  connectionStatus: CalendarConnectionStatus;
  googleAccountEmail: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalCalendarInfo {
  id: string;
  name: string;
  isPrimary?: boolean;
  allowsModifications?: boolean;
}

export interface RideCalendarEventRecord {
  id: string;
  rideRequestId: string;
  appointmentId?: string;
  profileId: string;
  provider: CalendarProviderId;
  externalCalendarId?: string;
  externalEventId?: string;
  syncStatus: CalendarEventSyncStatus;
  lastSyncedAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/** Payload used to create/update provider calendar events. */
export interface RideCalendarEventPayload {
  rideRequestId: string;
  appointmentId: string;
  title: string;
  destinationLabel: string;
  pickupLabel: string;
  pickupLine1?: string;
  destinationLine1?: string;
  /** ISO local date YYYY-MM-DD */
  date: string;
  /** HH:mm */
  startTime: string;
  /** HH:mm optional return / end hint */
  endTime?: string;
  riderName?: string;
  angelName?: string;
  notes?: string;
  deepLink: string;
}

export interface CalendarProviderCapabilities {
  id: CalendarProviderId;
  displayName: string;
  /** Device-native (Apple) vs cloud OAuth (Google). */
  kind: 'native' | 'oauth';
  availableOnNativeIos: boolean;
  availableOnWeb: boolean;
}
