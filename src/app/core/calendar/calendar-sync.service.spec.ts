import { TestBed } from '@angular/core/testing';
import { CalendarSyncService } from '../services/calendar-sync.service';
import { AuthService } from '../services/auth.service';
import { CALENDAR_REPOSITORY } from '../repositories/tokens';
import { AppleCalendarProvider } from './apple-calendar.provider';
import { GoogleCalendarProvider } from './google-calendar.provider';
import { Appointment, RideAssignment, RideRequest, User } from '../models';
import { CalendarPreferences } from '../models/calendar';
import { CalendarWriteResult } from './calendar-provider';

describe('CalendarSyncService', () => {
  const user: User = {
    id: 'user-1',
    authUserId: 'user-1',
    firstName: 'Alex',
    lastName: 'Rider',
    displayName: 'Alex Rider',
    roles: ['rider'],
    onboardingCompleted: true,
  };

  const appointment: Appointment = {
    id: 'appt-1',
    riderId: 'user-1',
    title: 'Clinic',
    date: '2026-09-01',
    time: '10:00',
    status: 'active',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const ride: RideRequest = {
    id: 'ride-1',
    appointmentId: 'appt-1',
    riderId: 'user-1',
    status: 'ride_confirmed',
    visibility: 'private',
    pickup: { id: 'a1', label: 'Home', line1: '1 Main' },
    destination: { id: 'a2', label: 'Clinic', line1: '2 Health' },
    returnNeeded: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };

  const assignment: RideAssignment = {
    id: 'asg-1',
    rideRequestId: 'ride-1',
    angelId: 'angel-1',
    source: 'private_claim',
    assignedAt: '2026-08-01T00:00:00.000Z',
    confirmationStatus: 'confirmed',
  };

  let createCalls: number;
  let updateCalls: number;
  let createImpl: () => Promise<CalendarWriteResult>;
  let activeEvent: { externalEventId: string } | null;

  const apple = {
    id: 'apple' as const,
    isAvailable: () => true,
    connect: async () => ({ ok: true, status: 'connected' as const }),
    disconnect: async () => undefined,
    testConnection: async () => ({ ok: true, status: 'connected' as const }),
    refreshConnection: async () => ({ ok: true, status: 'connected' as const }),
    listCalendars: async () => [{ id: 'cal-1', name: 'Personal', isPrimary: true }],
    createRideEvent: async () => {
      createCalls += 1;
      return createImpl();
    },
    updateRideEvent: async () => {
      updateCalls += 1;
      return { ok: true, externalEventId: 'evt-1', externalCalendarId: 'cal-1' };
    },
    deleteRideEvent: async () => ({ ok: true, externalEventId: 'evt-1' }),
  };

  const google = {
    id: 'google' as const,
    isAvailable: () => false,
    connect: async () => ({ ok: false, status: 'unavailable' as const }),
    disconnect: async () => undefined,
    testConnection: async () => ({ ok: false, status: 'unavailable' as const }),
    refreshConnection: async () => ({ ok: false, status: 'unavailable' as const }),
    listCalendars: async () => [],
    createRideEvent: async () => ({ ok: false, message: 'n/a' }),
    updateRideEvent: async () => ({ ok: false, message: 'n/a' }),
    deleteRideEvent: async () => ({ ok: false, message: 'n/a' }),
  };

  const prefs: CalendarPreferences = {
    profileId: 'user-1',
    syncEnabled: true,
    preferredProvider: 'apple',
    selectedCalendarId: 'cal-1',
    selectedCalendarName: 'Personal',
    connectionStatus: 'connected',
    googleAccountEmail: null,
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    createCalls = 0;
    updateCalls = 0;
    activeEvent = null;
    createImpl = async () => ({
      ok: true,
      externalEventId: 'evt-1',
      externalCalendarId: 'cal-1',
    });

    TestBed.configureTestingModule({
      providers: [
        CalendarSyncService,
        {
          provide: AuthService,
          useValue: {
            getCurrentUserOrNull: () => user,
          },
        },
        {
          provide: CALENDAR_REPOSITORY,
          useValue: {
            getPreferences: async () => prefs,
            upsertPreferences: async (patch: Partial<CalendarPreferences>) => ({
              ...prefs,
              ...patch,
            }),
            listEventsForProfile: async () => [],
            getActiveEvent: async () => activeEvent,
            upsertActiveEvent: async (input: { externalEventId?: string }) => {
              if (input.externalEventId) {
                activeEvent = { externalEventId: input.externalEventId };
              }
              return {
                id: 'row-1',
                rideRequestId: 'ride-1',
                profileId: 'user-1',
                provider: 'apple',
                externalEventId: input.externalEventId,
                syncStatus: 'synced',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
            },
            markEventDeleted: async () => undefined,
          },
        },
        { provide: AppleCalendarProvider, useValue: apple },
        { provide: GoogleCalendarProvider, useValue: google },
      ],
    });
  });

  it('skips sync when preferences are disabled', async () => {
    const service = TestBed.inject(CalendarSyncService);
    await service.savePreferences({ syncEnabled: false });
    await service.syncRideForCurrentUser({ ride, appointment, assignment });
    expect(createCalls).toBe(0);
    expect(service.statusForRide(ride.id)).toBe('disabled');
  });

  it('creates once then updates on second sync (idempotent)', async () => {
    const service = TestBed.inject(CalendarSyncService);
    await service.loadPreferences();
    await service.syncRideForCurrentUser({ ride, appointment, assignment });
    expect(createCalls).toBe(1);
    expect(service.statusForRide(ride.id)).toBe('synced');

    await service.syncRideForCurrentUser({ ride, appointment, assignment });
    expect(createCalls).toBe(1);
    expect(updateCalls).toBe(1);
  });

  it('syncs rider appointments before they are claimed', async () => {
    const service = TestBed.inject(CalendarSyncService);
    await service.loadPreferences();
    const openRide: RideRequest = {
      ...ride,
      status: 'private_requested',
    };
    await service.syncRideForCurrentUser({
      ride: openRide,
      appointment,
      assignment: null,
    });
    expect(createCalls).toBe(1);
    expect(service.statusForRide(openRide.id)).toBe('synced');
  });

  it('provider failure marks failed without throwing', async () => {
    createImpl = async () => ({ ok: false, message: 'EventKit denied' });
    const service = TestBed.inject(CalendarSyncService);
    await service.loadPreferences();
    await expectAsync(
      service.syncRideForCurrentUser({ ride, appointment, assignment }),
    ).toBeResolved();
    expect(service.statusForRide(ride.id)).toBe('failed');
  });
});
