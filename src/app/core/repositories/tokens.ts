import { InjectionToken } from '@angular/core';
import {
  AppointmentRepositoryPort,
  NotificationRepositoryPort,
  ProfileDirectoryPort,
  RideAngelConnectionRepositoryPort,
  RideAssignmentRepositoryPort,
  RideOfferRepositoryPort,
  RideRequestRepositoryPort,
  UserProfileRepositoryPort,
} from './contracts';
import { CalendarRepositoryPort } from './calendar-contracts';

export const USER_PROFILE_REPOSITORY = new InjectionToken<UserProfileRepositoryPort>(
  'USER_PROFILE_REPOSITORY',
);
export const APPOINTMENT_REPOSITORY = new InjectionToken<AppointmentRepositoryPort>(
  'APPOINTMENT_REPOSITORY',
);
export const RIDE_REQUEST_REPOSITORY = new InjectionToken<RideRequestRepositoryPort>(
  'RIDE_REQUEST_REPOSITORY',
);
export const RIDE_OFFER_REPOSITORY = new InjectionToken<RideOfferRepositoryPort>(
  'RIDE_OFFER_REPOSITORY',
);
export const RIDE_ASSIGNMENT_REPOSITORY =
  new InjectionToken<RideAssignmentRepositoryPort>('RIDE_ASSIGNMENT_REPOSITORY');
export const RIDE_ANGEL_CONNECTION_REPOSITORY =
  new InjectionToken<RideAngelConnectionRepositoryPort>(
    'RIDE_ANGEL_CONNECTION_REPOSITORY',
  );
export const NOTIFICATION_REPOSITORY = new InjectionToken<NotificationRepositoryPort>(
  'NOTIFICATION_REPOSITORY',
);
export const PROFILE_DIRECTORY = new InjectionToken<ProfileDirectoryPort>(
  'PROFILE_DIRECTORY',
);
export const CALENDAR_REPOSITORY = new InjectionToken<CalendarRepositoryPort>(
  'CALENDAR_REPOSITORY',
);
