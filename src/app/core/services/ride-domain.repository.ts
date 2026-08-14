import { Injectable } from '@angular/core';
import {
  Appointment,
  RideAngelConnection,
  RideAssignment,
  RideOffer,
  RideRequest,
  RideStatus,
  RideVisibility,
  User,
} from '../models';
import { mapDomainError } from '../infrastructure/supabase/mappers';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../supabase/supabase-client';

/** Maps Supabase ride-domain tables ↔ app models. */
@Injectable({ providedIn: 'root' })
export class RideDomainRepository {
  enabled(): boolean {
    return isSupabaseConfigured();
  }

  async findProfileForInvite(identifier: string): Promise<User | null> {
    const { data, error } = await getSupabaseClient().rpc(
      'find_profile_for_invite',
      { identifier: identifier.trim() },
    );
    if (error) {
      throw new Error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      authUserId: row.auth_user_id,
      firstName: '',
      lastName: '',
      displayName: row.display_name || 'Ride Angels member',
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      roles: [],
      onboardingCompleted: true,
    };
  }

  async loadAppointmentsVisible(): Promise<Appointment[]> {
    const { data, error } = await getSupabaseClient()
      .from('appointments')
      .select('*')
      .order('ride_date', { ascending: true });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => this.appointmentFromRow(row));
  }

  async loadRideRequestsVisible(): Promise<RideRequest[]> {
    const { data, error } = await getSupabaseClient()
      .from('ride_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => this.rideFromRow(row));
  }

  async loadAssignmentsVisible(): Promise<RideAssignment[]> {
    const { data, error } = await getSupabaseClient()
      .from('ride_assignments')
      .select('*');
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => this.assignmentFromRow(row));
  }

  async loadOffersVisible(): Promise<RideOffer[]> {
    const { data, error } = await getSupabaseClient()
      .from('ride_offers')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => this.offerFromRow(row));
  }

  async loadConnectionsForUser(): Promise<RideAngelConnection[]> {
    const { data, error } = await getSupabaseClient()
      .from('ride_angel_connections')
      .select('*')
      .order('invited_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => this.connectionFromRow(row));
  }

  async loadProfilesByIds(ids: string[]): Promise<User[]> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) {
      return [];
    }
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .in('id', unique);
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => this.profileFromRow(row));
  }

  async insertAppointmentWithRide(input: {
    appointment: Appointment;
    ride: RideRequest;
  }): Promise<{ appointment: Appointment; ride: RideRequest }> {
    const { data, error } = await getSupabaseClient().rpc(
      'create_appointment_with_ride',
      {
        payload: {
          id: input.appointment.id,
          ride_id: input.ride.id,
          title: input.appointment.title,
          ride_date: input.appointment.date,
          ride_time: input.appointment.time,
          notes: input.appointment.notes ?? '',
          pickup_label: input.ride.pickup.label,
          pickup_line1: input.ride.pickup.line1,
          destination_label: input.ride.destination.label,
          destination_line1: input.ride.destination.line1,
          return_needed: input.ride.returnNeeded,
          return_pickup_time: input.ride.returnPickupTime ?? '',
          visibility: input.ride.visibility === 'public' ? 'public' : 'private',
        },
      },
    );
    if (error) {
      throw this.mapRpcError(error.message);
    }

    const result = data as { appointment_id: string; ride_request_id: string };
    const { data: apptData, error: apptError } = await getSupabaseClient()
      .from('appointments')
      .select('*')
      .eq('id', result.appointment_id)
      .single();
    if (apptError) {
      throw new Error(apptError.message);
    }
    const { data: rideData, error: rideError } = await getSupabaseClient()
      .from('ride_requests')
      .select('*')
      .eq('id', result.ride_request_id)
      .single();
    if (rideError) {
      throw new Error(rideError.message);
    }

    return {
      appointment: this.appointmentFromRow(apptData),
      ride: this.rideFromRow(rideData),
    };
  }

  async claimPrivateRide(
    rideRequestId: string,
  ): Promise<{ assignmentId: string }> {
    const { data, error } = await getSupabaseClient().rpc('claim_private_ride', {
      p_ride_request_id: rideRequestId,
    });
    if (error) {
      throw this.mapRpcError(error.message);
    }
    const result = data as { assignment_id: string };
    return { assignmentId: result.assignment_id };
  }

  async submitRideOfferRpc(
    rideRequestId: string,
    message?: string,
  ): Promise<{ offerId: string }> {
    const { data, error } = await getSupabaseClient().rpc('submit_ride_offer', {
      p_ride_request_id: rideRequestId,
      p_message: message ?? null,
    });
    if (error) {
      throw this.mapRpcError(error.message);
    }
    const result = data as { offer_id: string };
    return { offerId: result.offer_id };
  }

  async acceptRideOfferRpc(
    rideRequestId: string,
    offerId: string,
  ): Promise<{ assignmentId: string }> {
    const { data, error } = await getSupabaseClient().rpc('accept_ride_offer', {
      p_ride_request_id: rideRequestId,
      p_ride_offer_id: offerId,
    });
    if (error) {
      throw this.mapRpcError(error.message);
    }
    const result = data as { assignment_id: string };
    return { assignmentId: result.assignment_id };
  }

  async listNotifications(recipientId: string): Promise<
    import('../models').AppNotification[]
  > {
    const { data, error } = await getSupabaseClient()
      .from('notifications')
      .select('*')
      .eq('recipient_profile_id', recipientId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) => this.notificationFromRow(row));
  }

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async markAllNotificationsRead(recipientId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_profile_id', recipientId)
      .is('read_at', null);
    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteNotification(id: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('notifications')
      .delete()
      .eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async deleteReadNotifications(recipientId: string): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('notifications')
      .delete()
      .eq('recipient_profile_id', recipientId)
      .not('read_at', 'is', null);
    if (error) {
      throw new Error(error.message);
    }
  }

  async cancelRideRequest(rideRequestId: string): Promise<void> {
    const { error } = await getSupabaseClient().rpc('cancel_ride_request', {
      p_ride_request_id: rideRequestId,
    });
    if (error) {
      throw this.mapRpcError(error.message);
    }
  }

  async cancelAppointment(
    appointmentId: string,
    reason?: string,
  ): Promise<void> {
    const { error } = await getSupabaseClient().rpc('cancel_appointment', {
      p_appointment_id: appointmentId,
      p_reason: reason ?? null,
    });
    if (error) {
      throw this.mapRpcError(error.message);
    }
  }

  async updateAppointmentDetails(input: {
    appointment: Appointment;
    ride: RideRequest;
    changeSummary?: string;
  }): Promise<{ needsReconfirm: boolean }> {
    const { data, error } = await getSupabaseClient().rpc(
      'update_appointment_details',
      {
        payload: {
          id: input.appointment.id,
          title: input.appointment.title,
          ride_date: input.appointment.date,
          ride_time: input.appointment.time,
          notes: input.appointment.notes ?? null,
          pickup_label: input.ride.pickup.label,
          pickup_line1: input.ride.pickup.line1,
          destination_label: input.ride.destination.label,
          destination_line1: input.ride.destination.line1,
          return_needed: input.ride.returnNeeded,
          return_pickup_time: input.ride.returnPickupTime ?? '',
          visibility: input.ride.visibility === 'public' ? 'public' : 'private',
          change_summary: input.changeSummary ?? null,
        },
      },
    );
    if (error) {
      throw this.mapRpcError(error.message);
    }
    const result = data as { needs_reconfirm?: boolean };
    return { needsReconfirm: !!result.needs_reconfirm };
  }

  async confirmAssignmentAfterChange(rideRequestId: string): Promise<void> {
    const { error } = await getSupabaseClient().rpc(
      'confirm_assignment_after_change',
      { p_ride_request_id: rideRequestId },
    );
    if (error) {
      throw this.mapRpcError(error.message);
    }
  }

  async declineAssignmentAfterChange(rideRequestId: string): Promise<void> {
    const { error } = await getSupabaseClient().rpc(
      'decline_assignment_after_change',
      { p_ride_request_id: rideRequestId },
    );
    if (error) {
      throw this.mapRpcError(error.message);
    }
  }

  async cancelAssignmentByAngel(
    rideRequestId: string,
    reason: string,
  ): Promise<void> {
    const { error } = await getSupabaseClient().rpc(
      'cancel_assignment_by_angel',
      {
        p_ride_request_id: rideRequestId,
        p_reason: reason,
      },
    );
    if (error) {
      throw this.mapRpcError(error.message);
    }
  }

  async withdrawRideOffer(offerId: string, reason: string): Promise<void> {
    const { error } = await getSupabaseClient().rpc('withdraw_ride_offer', {
      p_ride_offer_id: offerId,
      p_reason: reason,
    });
    if (error) {
      throw this.mapRpcError(error.message);
    }
  }

  private mapRpcError(message: string): Error {
    return mapDomainError(message);
  }

  private notificationFromRow(
    row: Record<string, unknown>,
  ): import('../models').AppNotification {
    return {
      id: String(row['id']),
      userId: String(row['recipient_profile_id']),
      type: String(row['type']) as import('../models').NotificationType,
      title: String(row['title']),
      body: String(row['body']),
      read: !!row['read_at'],
      createdAt: String(row['created_at']),
      relatedAppointmentId: row['related_appointment_id']
        ? String(row['related_appointment_id'])
        : undefined,
      relatedRideRequestId: row['related_ride_request_id']
        ? String(row['related_ride_request_id'])
        : undefined,
    };
  }

  async updateRideRequest(
    id: string,
    patch: Partial<{
      visibility: string;
      status: string;
    }>,
  ): Promise<void> {
    const { data, error } = await getSupabaseClient()
      .from('ride_requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      throw new Error('Unable to update this ride. Please try again.');
    }
  }

  async setRideRequestVisibility(
    rideRequestId: string,
    isPublic: boolean,
  ): Promise<{ visibility: string; status: string }> {
    const { data, error } = await getSupabaseClient().rpc(
      'set_ride_request_visibility',
      {
        p_ride_request_id: rideRequestId,
        p_is_public: isPublic,
      },
    );
    if (error) {
      throw this.mapRpcError(error.message);
    }
    const result = data as { visibility: string; status: string };
    return {
      visibility: result.visibility,
      status: result.status,
    };
  }

  async insertAssignment(assignment: RideAssignment): Promise<RideAssignment> {
    const { data, error } = await getSupabaseClient()
      .from('ride_assignments')
      .insert({
        id: assignment.id,
        ride_request_id: assignment.rideRequestId,
        angel_id: assignment.angelId,
        source: assignment.source,
        assigned_at: assignment.assignedAt,
        assigned_by_user_id: assignment.assignedByUserId ?? assignment.angelId,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return this.assignmentFromRow(data);
  }

  async insertOffer(offer: RideOffer, angelDisplayName: string): Promise<RideOffer> {
    const { data, error } = await getSupabaseClient()
      .from('ride_offers')
      .insert({
        id: offer.id,
        ride_request_id: offer.rideRequestId,
        angel_id: offer.angelId,
        status: offer.status,
        message: offer.message ?? null,
        angel_display_name: angelDisplayName,
        created_at: offer.createdAt,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return this.offerFromRow(data);
  }

  async updateOfferStatus(
    offerId: string,
    status: RideOffer['status'],
  ): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('ride_offers')
      .update({ status })
      .eq('id', offerId);
    if (error) {
      throw new Error(error.message);
    }
  }

  async updateOffersForRide(
    rideRequestId: string,
    updater: { acceptId: string },
  ): Promise<void> {
    const { data, error } = await getSupabaseClient()
      .from('ride_offers')
      .select('id')
      .eq('ride_request_id', rideRequestId)
      .eq('status', 'pending');
    if (error) {
      throw new Error(error.message);
    }
    for (const row of data ?? []) {
      const status = row.id === updater.acceptId ? 'accepted' : 'closed';
      await this.updateOfferStatus(row.id, status);
    }
  }

  async insertConnection(
    connection: RideAngelConnection,
    names: { riderDisplayName: string; angelDisplayName: string },
  ): Promise<RideAngelConnection> {
    const { data, error } = await getSupabaseClient()
      .from('ride_angel_connections')
      .insert({
        id: connection.id,
        rider_id: connection.riderId,
        angel_id: connection.angelId,
        status: connection.status,
        relationship_label: connection.relationshipLabel,
        rider_display_name: names.riderDisplayName,
        angel_display_name: names.angelDisplayName,
        invited_at: connection.invitedAt,
        accepted_at: connection.acceptedAt ?? null,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return this.connectionFromRow(data);
  }

  async updateConnection(
    id: string,
    patch: Partial<{
      status: string;
      accepted_at: string | null;
      relationship_label?: string;
      invited_at?: string;
    }>,
  ): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('ride_angel_connections')
      .update(patch)
      .eq('id', id);
    if (error) {
      throw new Error(error.message);
    }
  }

  async removeRideAngelConnection(connectionId: string): Promise<void> {
    const { error } = await getSupabaseClient().rpc('remove_ride_angel_connection', {
      p_connection_id: connectionId,
    });
    if (error) {
      throw this.mapRpcError(error.message);
    }
  }

  private appointmentFromRow(row: Record<string, unknown>): Appointment {
    return {
      id: String(row['id']),
      riderId: String(row['rider_id']),
      createdByUserId: row['created_by_user_id']
        ? String(row['created_by_user_id'])
        : undefined,
      title: String(row['title']),
      date: String(row['ride_date']),
      time: String(row['ride_time']).slice(0, 5),
      notes: row['notes'] ? String(row['notes']) : undefined,
      status: row['status'] === 'cancelled' ? 'cancelled' : 'active',
      cancellationReason: row['cancellation_reason']
        ? String(row['cancellation_reason'])
        : undefined,
      cancelledAt: row['cancelled_at'] ? String(row['cancelled_at']) : undefined,
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    };
  }

  private rideFromRow(row: Record<string, unknown>): RideRequest {
    const visibility = String(row['visibility']) as RideVisibility;
    return {
      id: String(row['id']),
      appointmentId: String(row['appointment_id']),
      riderId: String(row['rider_id']),
      createdByUserId: row['created_by_user_id']
        ? String(row['created_by_user_id'])
        : undefined,
      pickup: {
        id: `pickup-${row['id']}`,
        label: String(row['pickup_label']),
        line1: String(row['pickup_line1']),
      },
      destination: {
        id: `dest-${row['id']}`,
        label: String(row['destination_label']),
        line1: String(row['destination_line1']),
      },
      returnNeeded: !!row['return_needed'],
      returnPickupTime: row['return_pickup_time']
        ? String(row['return_pickup_time']).slice(0, 5)
        : undefined,
      visibility: visibility === 'public' ? 'public' : 'private',
      status: String(row['status']) as RideStatus,
      riderDisplayName: row['rider_display_name']
        ? String(row['rider_display_name'])
        : undefined,
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    };
  }

  private assignmentFromRow(row: Record<string, unknown>): RideAssignment {
    const confirmation = row['confirmation_status']
      ? String(row['confirmation_status'])
      : 'confirmed';
    return {
      id: String(row['id']),
      rideRequestId: String(row['ride_request_id']),
      angelId: String(row['angel_id']),
      source: row['source'] as RideAssignment['source'],
      assignedAt: String(row['assigned_at']),
      assignedByUserId: row['assigned_by_user_id']
        ? String(row['assigned_by_user_id'])
        : undefined,
      confirmationStatus: confirmation as RideAssignment['confirmationStatus'],
      pendingChangeSummary: row['pending_change_summary']
        ? String(row['pending_change_summary'])
        : undefined,
    };
  }

  private offerFromRow(row: Record<string, unknown>): RideOffer {
    return {
      id: String(row['id']),
      rideRequestId: String(row['ride_request_id']),
      angelId: String(row['angel_id']),
      status: row['status'] as RideOffer['status'],
      message: row['message'] ? String(row['message']) : undefined,
      createdAt: String(row['created_at']),
      angelDisplayName: row['angel_display_name']
        ? String(row['angel_display_name'])
        : undefined,
    };
  }

  private connectionFromRow(row: Record<string, unknown>): RideAngelConnection {
    return {
      id: String(row['id']),
      riderId: String(row['rider_id']),
      angelId: String(row['angel_id']),
      status: row['status'] as RideAngelConnection['status'],
      relationshipLabel: String(row['relationship_label']),
      invitedAt: String(row['invited_at']),
      acceptedAt: row['accepted_at'] ? String(row['accepted_at']) : undefined,
      riderDisplayName: row['rider_display_name']
        ? String(row['rider_display_name'])
        : undefined,
      angelDisplayName: row['angel_display_name']
        ? String(row['angel_display_name'])
        : undefined,
    };
  }

  private profileFromRow(row: Record<string, unknown>): User {
    const roles = ((row['roles'] as string[]) ?? []).filter(
      (r): r is User['roles'][number] =>
        r === 'rider' || r === 'rideAngel' || r === 'both',
    );
    return {
      id: String(row['id']),
      authUserId: String(row['auth_user_id']),
      firstName: String(row['first_name'] ?? ''),
      lastName: String(row['last_name'] ?? ''),
      displayName: String(row['display_name'] || 'Ride Angels member'),
      email: row['email'] ? String(row['email']) : undefined,
      phone: row['phone'] ? String(row['phone']) : undefined,
      avatarUrl: row['avatar_url'] ? String(row['avatar_url']) : undefined,
      roles,
      onboardingCompleted: !!row['onboarding_completed'],
      isAppCreator: !!row['is_app_creator'],
      defaultPersona:
        row['default_persona'] === 'angel'
          ? 'angel'
          : row['default_persona'] === 'rider'
            ? 'rider'
            : undefined,
      createdAt: row['created_at'] ? String(row['created_at']) : undefined,
      updatedAt: row['updated_at'] ? String(row['updated_at']) : undefined,
    };
  }

  async getCalendarPreferences(
    profileId: string,
  ): Promise<import('../models/calendar').CalendarPreferences | null> {
    const { data, error } = await getSupabaseClient()
      .from('calendar_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? this.calendarPreferencesFromRow(data) : null;
  }

  async upsertCalendarPreferences(
    patch: import('../repositories/calendar-contracts').CalendarPreferencesPatch,
  ): Promise<import('../models/calendar').CalendarPreferences> {
    // Only send keys that are present so SQL COALESCE / `payload ? key` keeps
    // other preference fields (selecting a calendar must not clear provider).
    const payload: Record<string, unknown> = {};
    if (patch.syncEnabled !== undefined) {
      payload['sync_enabled'] = patch.syncEnabled;
    }
    if (patch.preferredProvider !== undefined) {
      payload['preferred_provider'] = patch.preferredProvider;
    }
    if (patch.selectedCalendarId !== undefined) {
      payload['selected_calendar_id'] = patch.selectedCalendarId;
    }
    if (patch.selectedCalendarName !== undefined) {
      payload['selected_calendar_name'] = patch.selectedCalendarName;
    }
    if (patch.connectionStatus !== undefined) {
      payload['connection_status'] = patch.connectionStatus;
    }
    if (patch.googleAccountEmail !== undefined) {
      payload['google_account_email'] = patch.googleAccountEmail;
    }
    if (patch.lastError !== undefined) {
      payload['last_error'] = patch.lastError;
    }

    const { data, error } = await getSupabaseClient().rpc(
      'upsert_calendar_preferences',
      { payload },
    );
    if (error) {
      throw this.mapRpcError(error.message);
    }
    return this.calendarPreferencesFromRow(data as Record<string, unknown>);
  }

  async listCalendarEventsForProfile(
    profileId: string,
  ): Promise<import('../models/calendar').RideCalendarEventRecord[]> {
    const { data, error } = await getSupabaseClient()
      .from('ride_calendar_events')
      .select('*')
      .eq('profile_id', profileId)
      .order('updated_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    return (data ?? []).map((row) =>
      this.calendarEventFromRow(row as Record<string, unknown>),
    );
  }

  async getActiveCalendarEvent(
    rideRequestId: string,
    profileId: string,
    provider: import('../models/calendar').CalendarProviderId,
  ): Promise<import('../models/calendar').RideCalendarEventRecord | null> {
    const { data, error } = await getSupabaseClient()
      .from('ride_calendar_events')
      .select('*')
      .eq('ride_request_id', rideRequestId)
      .eq('profile_id', profileId)
      .eq('provider', provider)
      .in('sync_status', ['pending', 'synced', 'failed'])
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    return data ? this.calendarEventFromRow(data) : null;
  }

  async upsertActiveCalendarEvent(input: {
    rideRequestId: string;
    appointmentId?: string;
    profileId: string;
    provider: import('../models/calendar').CalendarProviderId;
    externalCalendarId?: string;
    externalEventId?: string;
    syncStatus: import('../models/calendar').CalendarEventSyncStatus;
    lastError?: string | null;
  }): Promise<import('../models/calendar').RideCalendarEventRecord> {
    const existing = await this.getActiveCalendarEvent(
      input.rideRequestId,
      input.profileId,
      input.provider,
    );
    const now = new Date().toISOString();
    if (existing) {
      const { data, error } = await getSupabaseClient()
        .from('ride_calendar_events')
        .update({
          appointment_id: input.appointmentId ?? null,
          external_calendar_id: input.externalCalendarId ?? null,
          external_event_id: input.externalEventId ?? null,
          sync_status: input.syncStatus,
          last_error: input.lastError ?? null,
          last_synced_at: input.syncStatus === 'synced' ? now : existing.lastSyncedAt,
          updated_at: now,
        })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) {
        throw new Error(error.message);
      }
      return this.calendarEventFromRow(data);
    }
    const { data, error } = await getSupabaseClient()
      .from('ride_calendar_events')
      .insert({
        ride_request_id: input.rideRequestId,
        appointment_id: input.appointmentId ?? null,
        profile_id: input.profileId,
        provider: input.provider,
        external_calendar_id: input.externalCalendarId ?? null,
        external_event_id: input.externalEventId ?? null,
        sync_status: input.syncStatus,
        last_error: input.lastError ?? null,
        last_synced_at: input.syncStatus === 'synced' ? now : null,
      })
      .select('*')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return this.calendarEventFromRow(data);
  }

  async markCalendarEventDeleted(
    rideRequestId: string,
    profileId: string,
    provider: import('../models/calendar').CalendarProviderId,
  ): Promise<void> {
    const { error } = await getSupabaseClient()
      .from('ride_calendar_events')
      .update({
        sync_status: 'deleted',
        external_event_id: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('ride_request_id', rideRequestId)
      .eq('profile_id', profileId)
      .eq('provider', provider)
      .in('sync_status', ['pending', 'synced', 'failed']);
    if (error) {
      throw new Error(error.message);
    }
  }

  private calendarPreferencesFromRow(
    row: Record<string, unknown>,
  ): import('../models/calendar').CalendarPreferences {
    const provider = row['preferred_provider']
      ? String(row['preferred_provider'])
      : null;
    return {
      profileId: String(row['profile_id']),
      syncEnabled: !!row['sync_enabled'],
      preferredProvider:
        provider === 'apple' || provider === 'google' ? provider : null,
      selectedCalendarId: row['selected_calendar_id']
        ? String(row['selected_calendar_id'])
        : null,
      selectedCalendarName: row['selected_calendar_name']
        ? String(row['selected_calendar_name'])
        : null,
      connectionStatus: String(
        row['connection_status'] ?? 'not_connected',
      ) as import('../models/calendar').CalendarConnectionStatus,
      googleAccountEmail: row['google_account_email']
        ? String(row['google_account_email'])
        : null,
      lastError: row['last_error'] ? String(row['last_error']) : null,
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    };
  }

  private calendarEventFromRow(
    row: Record<string, unknown>,
  ): import('../models/calendar').RideCalendarEventRecord {
    return {
      id: String(row['id']),
      rideRequestId: String(row['ride_request_id']),
      appointmentId: row['appointment_id']
        ? String(row['appointment_id'])
        : undefined,
      profileId: String(row['profile_id']),
      provider: String(row['provider']) as import('../models/calendar').CalendarProviderId,
      externalCalendarId: row['external_calendar_id']
        ? String(row['external_calendar_id'])
        : undefined,
      externalEventId: row['external_event_id']
        ? String(row['external_event_id'])
        : undefined,
      syncStatus: String(
        row['sync_status'],
      ) as import('../models/calendar').CalendarEventSyncStatus,
      lastSyncedAt: row['last_synced_at']
        ? String(row['last_synced_at'])
        : undefined,
      lastError: row['last_error'] ? String(row['last_error']) : undefined,
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    };
  }
}
