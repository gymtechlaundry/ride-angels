import { Provider } from '@angular/core';
import { UserProfileRepository } from '../services/user-profile.repository';
import {
  APPOINTMENT_REPOSITORY,
  CALENDAR_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  PROFILE_DIRECTORY,
  RIDE_ANGEL_CONNECTION_REPOSITORY,
  RIDE_ASSIGNMENT_REPOSITORY,
  RIDE_OFFER_REPOSITORY,
  RIDE_REQUEST_REPOSITORY,
  USER_PROFILE_REPOSITORY,
} from './tokens';
import {
  SupabaseAppointmentRepository,
  SupabaseCalendarRepository,
  SupabaseNotificationRepository,
  SupabaseProfileDirectory,
  SupabaseRideAngelConnectionRepository,
  SupabaseRideAssignmentRepository,
  SupabaseRideOfferRepository,
  SupabaseRideRequestRepository,
} from './supabase-adapters';

/**
 * Binds repository ports → Supabase adapters.
 * Future: swap useClass to Api*Repository implementations without touching UI.
 */
export function provideRideRepositories(): Provider[] {
  return [
    { provide: USER_PROFILE_REPOSITORY, useExisting: UserProfileRepository },
    {
      provide: APPOINTMENT_REPOSITORY,
      useExisting: SupabaseAppointmentRepository,
    },
    {
      provide: RIDE_REQUEST_REPOSITORY,
      useExisting: SupabaseRideRequestRepository,
    },
    {
      provide: RIDE_OFFER_REPOSITORY,
      useExisting: SupabaseRideOfferRepository,
    },
    {
      provide: RIDE_ASSIGNMENT_REPOSITORY,
      useExisting: SupabaseRideAssignmentRepository,
    },
    {
      provide: RIDE_ANGEL_CONNECTION_REPOSITORY,
      useExisting: SupabaseRideAngelConnectionRepository,
    },
    {
      provide: NOTIFICATION_REPOSITORY,
      useExisting: SupabaseNotificationRepository,
    },
    { provide: PROFILE_DIRECTORY, useExisting: SupabaseProfileDirectory },
    { provide: CALENDAR_REPOSITORY, useExisting: SupabaseCalendarRepository },
  ];
}
