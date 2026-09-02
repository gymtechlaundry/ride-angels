import { Injectable, computed, inject, signal } from '@angular/core';
import { Appointment, RideAssignment, RideCardView, RideRequest } from '../models';
import {
  MOCK_APPOINTMENTS,
  MOCK_ASSIGNMENTS,
  MOCK_RIDE_REQUESTS,
  buildRideCards,
  buildUpcomingDrivesForAngel,
  formatTimeLabel,
  formatWhenLong,
} from '../mock/mock-data';
import {
  APPOINTMENT_REPOSITORY,
  RIDE_ASSIGNMENT_REPOSITORY,
  RIDE_REQUEST_REPOSITORY,
} from '../repositories/tokens';
import { isSupabaseConfigured } from '../supabase/supabase-client';
import { isPastAppointmentListWindow, isPastLocalDateTime } from '../utils/date-time';
import { AuthService } from './auth.service';
import { CalendarSyncService } from './calendar-sync.service';
import { RideDomainRepository } from './ride-domain.repository';
import { newUuid } from '../utils/uuid';

export interface CreateAppointmentInput {
  title: string;
  date: string;
  time: string;
  pickupLabel: string;
  pickupLine1: string;
  destinationLabel: string;
  destinationLine1: string;
  returnNeeded: boolean;
  returnPickupTime?: string;
  publicBoard: boolean;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly auth = inject(AuthService);
  private readonly appointmentsRepo = inject(APPOINTMENT_REPOSITORY);
  private readonly rideRequestsRepo = inject(RIDE_REQUEST_REPOSITORY);
  private readonly assignmentsRepo = inject(RIDE_ASSIGNMENT_REPOSITORY);
  /** Legacy facade still used for insertAssignment during mock/local assign paths. */
  private readonly domain = inject(RideDomainRepository);
  private readonly calendarSync = inject(CalendarSyncService);

  private readonly appointments = signal<Appointment[]>(
    isSupabaseConfigured() ? [] : [...MOCK_APPOINTMENTS],
  );
  private readonly rideRequests = signal<RideRequest[]>(
    isSupabaseConfigured() ? [] : [...MOCK_RIDE_REQUESTS],
  );
  private readonly assignments = signal<RideAssignment[]>(
    isSupabaseConfigured() ? [] : [...MOCK_ASSIGNMENTS],
  );

  readonly allAppointments = computed(() => this.appointments());
  readonly allRideRequests = computed(() => this.rideRequests());
  readonly allAssignments = computed(() => this.assignments());

  readonly scheduledRides = computed(() => {
    const rider = this.auth.getCurrentUserOrNull();
    if (!rider) {
      return [];
    }
    const appts = this.appointments().filter((a) => a.riderId === rider.id);
    const rides = this.rideRequests().filter((r) => r.riderId === rider.id);
    return buildRideCards(appts, rides, this.assignments(), this.auth.listUsers());
  });

  /** Confirmed trips the current user is driving (angel persona). */
  readonly upcomingDrives = computed(() => {
    const angel = this.auth.getCurrentUserOrNull();
    if (!angel) {
      return [];
    }
    return buildUpcomingDrivesForAngel(
      this.appointments(),
      this.rideRequests(),
      this.assignments(),
      this.auth.listUsers(),
      angel.id,
    );
  });

  /** Rider rides + angel drives for calendar marking. */
  readonly calendarRides = computed(() => {
    const persona = this.auth.activePersona();
    if (persona === 'angel') {
      return this.upcomingDrives();
    }
    return this.scheduledRides();
  });

  replaceAll(
    appointments: Appointment[],
    rides: RideRequest[],
    assignments: RideAssignment[],
  ): void {
    this.appointments.set(appointments);
    this.rideRequests.set(rides);
    this.assignments.set(assignments);
  }

  getAppointmentsForRider(riderId = this.auth.getCurrentUserOrNull()?.id): Appointment[] {
    if (!riderId) {
      return [];
    }
    return this.appointments().filter(
      (a) => a.riderId === riderId && a.status !== 'cancelled',
    );
  }

  getAppointmentById(id: string): Appointment | undefined {
    return this.appointments().find((a) => a.id === id);
  }

  getRideRequestForAppointment(appointmentId: string): RideRequest | undefined {
    return this.rideRequests().find((r) => r.appointmentId === appointmentId);
  }

  getRideRequestById(id: string): RideRequest | undefined {
    return this.rideRequests().find((r) => r.id === id);
  }

  /** Active assignment only (confirmed or awaiting reconfirm). */
  isActiveAssignment(assignment: RideAssignment | undefined): boolean {
    if (!assignment) {
      return false;
    }
    const status = assignment.confirmationStatus ?? 'confirmed';
    return status === 'confirmed' || status === 'pending_reconfirm';
  }

  getAssignmentForRide(rideRequestId: string): RideAssignment | undefined {
    return this.assignments().find(
      (a) => a.rideRequestId === rideRequestId && this.isActiveAssignment(a),
    );
  }

  /**
   * Whether angels may still offer / claim this ride.
   * Uses ride status so Offer buttons hide for everyone once claimed,
   * even when assignment rows are not visible to other angels (RLS).
   */
  isOpenForAngelOffers(ride: RideRequest | null | undefined): boolean {
    if (!ride) {
      return false;
    }
    switch (ride.status) {
      case 'cancelled':
      case 'ride_cancelled':
      case 'completed':
      case 'ride_confirmed':
      case 'upcoming':
      case 'in_progress':
      case 'draft':
        return false;
      default:
        break;
    }
    const appointment = this.getAppointmentById(ride.appointmentId);
    if (
      appointment &&
      isPastLocalDateTime(appointment.date, appointment.time)
    ) {
      return false;
    }
    return !this.getAssignmentForRide(ride.id);
  }

  /**
   * Whether an appointment should appear on Home / Calendar / circle lists.
   * Visible through return pickup (or start + 2h); completed/cancelled stay out.
   * Rows remain in the DB for a future history feature.
   */
  isActiveListItem(
    appointment: Appointment | null | undefined,
    ride?: RideRequest | null,
  ): boolean {
    if (!appointment || appointment.status === 'cancelled') {
      return false;
    }
    const resolved =
      ride ?? this.getRideRequestForAppointment(appointment.id);
    if (
      isPastAppointmentListWindow(
        appointment.date,
        appointment.time,
        resolved?.returnPickupTime,
      )
    ) {
      return false;
    }
    if (!resolved) {
      return true;
    }
    return (
      resolved.status !== 'cancelled' &&
      resolved.status !== 'ride_cancelled' &&
      resolved.status !== 'completed'
    );
  }

  getAppointmentsOnDate(
    date: string,
    riderId = this.auth.getCurrentUserOrNull()?.id,
  ): RideCardView[] {
    if (!riderId) {
      return [];
    }
    return this.scheduledRides().filter(
      (r) =>
        r.date === date &&
        this.appointments().find((a) => a.id === r.appointmentId)?.riderId ===
          riderId,
    );
  }

  getDatesWithAppointments(
    riderId = this.auth.getCurrentUserOrNull()?.id,
  ): Set<string> {
    if (!riderId) {
      return new Set();
    }
    if (this.auth.activePersona() === 'angel') {
      return new Set(this.upcomingDrives().map((r) => r.date));
    }
    return new Set(
      this.appointments()
        .filter((a) => a.riderId === riderId && a.status !== 'cancelled')
        .map((a) => a.date),
    );
  }

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const now = new Date().toISOString();
    const rider = this.auth.getCurrentUser();
    const appointmentId = newUuid();
    const rideId = newUuid();

    const appointment: Appointment = {
      id: appointmentId,
      riderId: rider.id,
      createdByUserId: rider.id,
      title: input.title,
      date: input.date,
      time: input.time,
      notes: input.notes,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    const ride: RideRequest = {
      id: rideId,
      appointmentId: appointment.id,
      riderId: rider.id,
      createdByUserId: rider.id,
      source: 'rider',
      pickup: {
        id: `addr-pickup-${rideId}`,
        label: input.pickupLabel,
        line1: input.pickupLine1,
      },
      destination: {
        id: `addr-dest-${rideId}`,
        label: input.destinationLabel,
        line1: input.destinationLine1,
      },
      returnNeeded: input.returnNeeded,
      returnPickupTime: input.returnPickupTime,
      returnDestination: input.returnNeeded
        ? {
            id: `addr-return-${rideId}`,
            label: input.pickupLabel,
            line1: input.pickupLine1,
          }
        : undefined,
      visibility: input.publicBoard ? 'public' : 'private',
      status: input.publicBoard ? 'public_requested' : 'private_requested',
      riderDisplayName: rider.displayName,
      createdAt: now,
      updatedAt: now,
    };

    if (isSupabaseConfigured()) {
      const saved = await this.appointmentsRepo.createWithRide({
        appointment,
        ride,
      });
      this.appointments.update((list) => [...list, saved.appointment]);
      this.rideRequests.update((list) => [...list, saved.ride]);
      this.queueCalendarSync(saved.ride.id);
      return saved.appointment;
    }

    this.appointments.update((list) => [...list, appointment]);
    this.rideRequests.update((list) => [...list, ride]);
    this.queueCalendarSync(ride.id);
    return appointment;
  }

  async updateAppointment(
    appointmentId: string,
    input: CreateAppointmentInput,
  ): Promise<{ needsReconfirm: boolean }> {
    const existing = this.getAppointmentById(appointmentId);
    const ride = this.getRideRequestForAppointment(appointmentId);
    if (!existing || !ride) {
      throw new Error('Appointment not found.');
    }
    if (existing.status === 'cancelled') {
      throw new Error('This appointment was already cancelled.');
    }

    const now = new Date().toISOString();
    const updatedAppointment: Appointment = {
      ...existing,
      title: input.title,
      date: input.date,
      time: input.time,
      notes: input.notes,
      updatedAt: now,
    };
    const updatedRide: RideRequest = {
      ...ride,
      pickup: {
        ...ride.pickup,
        label: input.pickupLabel,
        line1: input.pickupLine1,
      },
      destination: {
        ...ride.destination,
        label: input.destinationLabel,
        line1: input.destinationLine1,
      },
      returnNeeded: input.returnNeeded,
      returnPickupTime: input.returnPickupTime,
      returnDestination: input.returnNeeded
        ? {
            id: ride.returnDestination?.id ?? `addr-return-${ride.id}`,
            label: input.pickupLabel,
            line1: input.pickupLine1,
          }
        : undefined,
      visibility: input.publicBoard ? 'public' : 'private',
      updatedAt: now,
    };

    const changeSummary = this.buildChangeSummary(existing, ride, input);
    const wasClaimed = !!this.getAssignmentForRide(ride.id);

    if (isSupabaseConfigured()) {
      const result = await this.appointmentsRepo.updateWithRide({
        appointment: updatedAppointment,
        ride: updatedRide,
        changeSummary,
      });
      const [appts, rides, assignments] = await Promise.all([
        this.appointmentsRepo.listVisible(),
        this.rideRequestsRepo.listVisible(),
        this.assignmentsRepo.listVisible(),
      ]);
      this.replaceAll(appts, rides, assignments);
      this.queueCalendarSync(ride.id);
      return result;
    }

    this.appointments.update((list) =>
      list.map((a) => (a.id === appointmentId ? updatedAppointment : a)),
    );

    if (wasClaimed) {
      this.assignments.update((list) =>
        list.map((a) =>
          a.rideRequestId === ride.id && this.isActiveAssignment(a)
            ? {
                ...a,
                confirmationStatus: 'pending_reconfirm',
                pendingChangeSummary: changeSummary,
              }
            : a,
        ),
      );
      this.rideRequests.update((list) =>
        list.map((r) => (r.id === ride.id ? updatedRide : r)),
      );
      this.queueCalendarSync(ride.id);
      return { needsReconfirm: true };
    }

    const openStatus: RideRequest['status'] = input.publicBoard
      ? ride.status === 'offers_received'
        ? 'offers_received'
        : 'public_requested'
      : 'private_requested';
    this.rideRequests.update((list) =>
      list.map((r) =>
        r.id === ride.id
          ? { ...updatedRide, status: openStatus, visibility: input.publicBoard ? 'public' : 'private' }
          : r,
      ),
    );
    this.queueCalendarSync(ride.id);
    return { needsReconfirm: false };
  }

  async cancelAppointment(appointmentId: string, reason?: string): Promise<void> {
    const existing = this.getAppointmentById(appointmentId);
    const ride = this.getRideRequestForAppointment(appointmentId);
    if (!existing) {
      throw new Error('Appointment not found.');
    }
    if (existing.status === 'cancelled') {
      throw new Error('This appointment was already cancelled.');
    }

    const assignment = ride ? this.getAssignmentForRide(ride.id) : undefined;
    const trimmedReason = reason?.trim();
    if (assignment && !trimmedReason) {
      throw new Error(
        'Please share a reason so your Ride Angel knows why the trip was cancelled.',
      );
    }

    if (isSupabaseConfigured()) {
      await this.appointmentsRepo.cancel(appointmentId, trimmedReason);
      const [appts, rides, assignments] = await Promise.all([
        this.appointmentsRepo.listVisible(),
        this.rideRequestsRepo.listVisible(),
        this.assignmentsRepo.listVisible(),
      ]);
      this.replaceAll(appts, rides, assignments);
      if (ride) {
        this.queueCalendarSync(ride.id);
      }
      return;
    }

    const now = new Date().toISOString();
    this.appointments.update((list) =>
      list.map((a) =>
        a.id === appointmentId
          ? {
              ...a,
              status: 'cancelled',
              cancellationReason: trimmedReason,
              cancelledAt: now,
              updatedAt: now,
            }
          : a,
      ),
    );
    if (ride) {
      this.rideRequests.update((list) =>
        list.map((r) =>
          r.id === ride.id
            ? { ...r, status: 'cancelled', updatedAt: now }
            : r,
        ),
      );
      if (assignment) {
        this.assignments.update((list) =>
          list.map((a) =>
            a.id === assignment.id
              ? { ...a, confirmationStatus: 'cancelled', pendingChangeSummary: undefined }
              : a,
          ),
        );
      }
      this.queueCalendarSync(ride.id);
    }
  }

  async confirmAssignmentAfterChange(rideRequestId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      await this.assignmentsRepo.confirmAfterChange(rideRequestId);
      const [rides, assignments] = await Promise.all([
        this.rideRequestsRepo.listVisible(),
        this.assignmentsRepo.listVisible(),
      ]);
      this.rideRequests.set(rides);
      this.assignments.set(assignments);
      this.queueCalendarSync(rideRequestId);
      return;
    }
    this.assignments.update((list) =>
      list.map((a) =>
        a.rideRequestId === rideRequestId && a.confirmationStatus === 'pending_reconfirm'
          ? {
              ...a,
              confirmationStatus: 'confirmed',
              pendingChangeSummary: undefined,
            }
          : a,
      ),
    );
    this.queueCalendarSync(rideRequestId);
  }

  async declineAssignmentAfterChange(rideRequestId: string): Promise<void> {
    const ride = this.getRideRequestById(rideRequestId);
    if (isSupabaseConfigured()) {
      await this.assignmentsRepo.declineAfterChange(rideRequestId);
      const [rides, assignments] = await Promise.all([
        this.rideRequestsRepo.listVisible(),
        this.assignmentsRepo.listVisible(),
      ]);
      this.rideRequests.set(rides);
      this.assignments.set(assignments);
      this.queueCalendarSync(rideRequestId);
      return;
    }
    this.assignments.update((list) =>
      list.map((a) =>
        a.rideRequestId === rideRequestId && a.confirmationStatus === 'pending_reconfirm'
          ? {
              ...a,
              confirmationStatus: 'released',
              pendingChangeSummary: undefined,
            }
          : a,
      ),
    );
    if (ride) {
      const openStatus: RideRequest['status'] =
        ride.visibility === 'public' ? 'public_requested' : 'private_requested';
      this.rideRequests.update((list) =>
        list.map((r) =>
          r.id === rideRequestId
            ? { ...r, status: openStatus, updatedAt: new Date().toISOString() }
            : r,
        ),
      );
    }
    this.queueCalendarSync(rideRequestId);
  }

  async cancelAssignmentByAngel(
    rideRequestId: string,
    reason: string,
  ): Promise<void> {
    const trimmed = reason.trim();
    if (!trimmed) {
      throw new Error('Please share a reason for the cancellation.');
    }

    const ride = this.getRideRequestById(rideRequestId);
    const assignment = this.getAssignmentForRide(rideRequestId);
    if (!assignment) {
      throw new Error('This trip is not currently assigned to you.');
    }

    if (isSupabaseConfigured()) {
      await this.assignmentsRepo.cancelByAngel(rideRequestId, trimmed);
      const [rides, assignments] = await Promise.all([
        this.rideRequestsRepo.listVisible(),
        this.assignmentsRepo.listVisible(),
      ]);
      this.rideRequests.set(rides);
      this.assignments.set(assignments);
      this.queueCalendarSync(rideRequestId);
      return;
    }

    this.assignments.update((list) =>
      list.map((a) =>
        a.id === assignment.id
          ? {
              ...a,
              confirmationStatus: 'released',
              pendingChangeSummary: undefined,
            }
          : a,
      ),
    );
    if (ride) {
      const openStatus: RideRequest['status'] =
        ride.visibility === 'public' ? 'public_requested' : 'private_requested';
      this.rideRequests.update((list) =>
        list.map((r) =>
          r.id === rideRequestId
            ? { ...r, status: openStatus, updatedAt: new Date().toISOString() }
            : r,
        ),
      );
    }
    this.queueCalendarSync(rideRequestId);
  }

  async markOnMyWay(rideRequestId: string): Promise<void> {
    const assignment = this.getAssignmentForRide(rideRequestId);
    if (!assignment) {
      throw new Error('This trip is not currently assigned to you.');
    }

    if (isSupabaseConfigured()) {
      await this.assignmentsRepo.markOnMyWay(rideRequestId);
      const assignments = await this.assignmentsRepo.listVisible();
      this.assignments.set(assignments);
      return;
    }

    const now = new Date().toISOString();
    this.assignments.update((list) =>
      list.map((a) =>
        a.id === assignment.id ? { ...a, onMyWayAt: now } : a,
      ),
    );
  }

  private buildChangeSummary(
    previous: Appointment,
    previousRide: RideRequest,
    input: CreateAppointmentInput,
  ): string {
    const parts: string[] = [];
    if (previous.date !== input.date || previous.time !== input.time) {
      parts.push(`When → ${formatWhenLong(input.date, input.time)}`);
    }
    if (previousRide.pickup.label !== input.pickupLabel) {
      parts.push(`Pickup → ${input.pickupLabel}`);
    }
    if (previousRide.destination.label !== input.destinationLabel) {
      parts.push(`Destination → ${input.destinationLabel}`);
    }
    if (previousRide.returnNeeded !== input.returnNeeded) {
      parts.push(input.returnNeeded ? 'Return trip added' : 'Return trip removed');
    } else if (
      input.returnNeeded &&
      previousRide.returnPickupTime !== input.returnPickupTime
    ) {
      parts.push(
        `Return pickup → ${formatTimeLabel(input.returnPickupTime ?? '')}`,
      );
    }
    if ((previousRide.visibility === 'public') !== input.publicBoard) {
      parts.push(
        input.publicBoard
          ? 'Now visible on community board'
          : 'Now private to trusted angels',
      );
    }
    return parts.length ? parts.join(' · ') : 'Trip details were updated.';
  }

  async setPublicVisibility(rideRequestId: string, isPublic: boolean): Promise<void> {
    const previous = this.getRideRequestById(rideRequestId);
    if (!previous) {
      throw new Error('Ride not found.');
    }

    const hasAssignment = !!this.getAssignmentForRide(rideRequestId);
    const optimisticStatus = hasAssignment
      ? previous.status
      : isPublic
        ? previous.status === 'offers_received'
          ? 'offers_received'
          : 'public_requested'
        : 'private_requested';

    this.rideRequests.update((list) =>
      list.map((ride) => {
        if (ride.id !== rideRequestId) {
          return ride;
        }
        return {
          ...ride,
          visibility: isPublic ? 'public' : 'private',
          status: optimisticStatus,
          updatedAt: new Date().toISOString(),
        };
      }),
    );

    if (!isSupabaseConfigured()) {
      if (!isPublic) {
        // Mirror server behavior for mock: pending public offers close when privatized.
      }
      return;
    }

    try {
      const saved = await this.rideRequestsRepo.setVisibility(
        rideRequestId,
        isPublic,
      );
      this.rideRequests.update((list) =>
        list.map((ride) => {
          if (ride.id !== rideRequestId) {
            return ride;
          }
          return {
            ...ride,
            visibility: saved.visibility === 'public' ? 'public' : 'private',
            status: saved.status as RideRequest['status'],
            updatedAt: new Date().toISOString(),
          };
        }),
      );
    } catch (err) {
      this.rideRequests.update((list) =>
        list.map((ride) => (ride.id === rideRequestId ? previous : ride)),
      );
      throw err;
    }
  }

  async confirmPrivateClaim(rideRequestId: string, angelId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      await this.assignmentsRepo.claimPrivateRide(rideRequestId);
      const [rides, assignments] = await Promise.all([
        this.rideRequestsRepo.listVisible(),
        this.assignmentsRepo.listVisible(),
      ]);
      this.rideRequests.set(rides);
      this.assignments.set(assignments);
      this.queueCalendarSync(rideRequestId);
      return;
    }
    await this.assignRide(rideRequestId, angelId, 'private_claim');
  }

  async assignRide(
    rideRequestId: string,
    angelId: string,
    source: RideAssignment['source'],
  ): Promise<void> {
    const existing = this.getAssignmentForRide(rideRequestId);
    if (existing) {
      return;
    }

    const assignment: RideAssignment = {
      id: newUuid(),
      rideRequestId,
      angelId,
      source,
      assignedAt: new Date().toISOString(),
      assignedByUserId: angelId,
      confirmationStatus: 'confirmed',
    };

    if (isSupabaseConfigured()) {
      // Prefer claimPrivateRide / acceptOffer RPCs for live assignment.
      // Direct insert remains for rare admin-style paths and migration safety.
      const saved = await this.domain.insertAssignment(assignment);
      this.assignments.update((list) => [...list, saved]);
      await this.rideRequestsRepo.updateVisibilityStatus(rideRequestId, {
        status: 'ride_confirmed',
      });
    } else {
      this.assignments.update((list) => [...list, assignment]);
    }

    this.rideRequests.update((list) =>
      list.map((ride) =>
        ride.id === rideRequestId
          ? {
              ...ride,
              status: 'ride_confirmed',
              updatedAt: new Date().toISOString(),
            }
          : ride,
      ),
    );
    this.queueCalendarSync(rideRequestId);
  }

  async submitPublicOffer(rideRequestId: string): Promise<void> {
    const openForOffers = new Set([
      'public_requested',
      'private_requested',
      'ride_needed',
      'offers_received',
    ]);
    this.rideRequests.update((list) =>
      list.map((ride) =>
        ride.id === rideRequestId && openForOffers.has(ride.status)
          ? {
              ...ride,
              status: 'offers_received',
              updatedAt: new Date().toISOString(),
            }
          : ride,
      ),
    );
    if (isSupabaseConfigured()) {
      const ride = this.getRideRequestById(rideRequestId);
      if (ride && openForOffers.has(ride.status)) {
        await this.rideRequestsRepo.updateVisibilityStatus(rideRequestId, {
          status: 'offers_received',
        });
      }
    }
  }

  detailView(appointmentId: string) {
    const appointment = this.getAppointmentById(appointmentId);
    const ride = this.getRideRequestForAppointment(appointmentId);
    if (!appointment || !ride) {
      return undefined;
    }
    const assignment = this.getAssignmentForRide(ride.id);
    const angel = assignment
      ? this.auth.getUserById(assignment.angelId)
      : undefined;

    return {
      appointment,
      ride,
      assignment,
      angel,
      whenLabel: formatWhenLong(appointment.date, appointment.time),
      timeLabel: formatTimeLabel(appointment.time),
    };
  }

  /** Fire-and-forget calendar sync for a ride the current user is party to. */
  queueCalendarSync(rideRequestId: string): void {
    try {
      const ride = this.getRideRequestById(rideRequestId);
      const appointment = ride
        ? this.getAppointmentById(ride.appointmentId)
        : undefined;
      if (!ride || !appointment) {
        return;
      }
      const assignment = this.getAssignmentForRide(rideRequestId);
      const rider = this.auth.getUserById(ride.riderId);
      const angel = assignment
        ? this.auth.getUserById(assignment.angelId)
        : undefined;
      void this.calendarSync.syncRideForCurrentUser({
        ride,
        appointment,
        assignment,
        riderName: rider?.displayName || ride.riderDisplayName,
        angelName: angel?.displayName,
      });
    } catch (err) {
      console.warn('[calendar] queue sync failed', err);
    }
  }
}
