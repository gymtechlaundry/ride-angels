import {
  AppNotification,
  Appointment,
  NotificationType,
  RideAngelConnection,
  RideAssignment,
  RideOffer,
  RideRequest,
  User,
} from '../models';

/** Profile persistence — ownership by authUserId only. */
export interface UserProfileRepositoryPort {
  getByAuthUserId(authUserId: string): Promise<User | null>;
  createForAuthUser(input: {
    authUserId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }): Promise<User>;
  update(authUserId: string, patch: Partial<User>): Promise<User>;
}

export interface AppointmentRepositoryPort {
  listVisible(): Promise<Appointment[]>;
  getById(id: string): Promise<Appointment | null>;
  createWithRide(input: {
    appointment: Appointment;
    ride: RideRequest;
  }): Promise<{ appointment: Appointment; ride: RideRequest }>;
  updateWithRide(input: {
    appointment: Appointment;
    ride: RideRequest;
    changeSummary?: string;
  }): Promise<{ needsReconfirm: boolean }>;
  cancel(appointmentId: string, reason?: string): Promise<void>;
}

export interface RideRequestRepositoryPort {
  listVisible(): Promise<RideRequest[]>;
  getById(id: string): Promise<RideRequest | null>;
  updateVisibilityStatus(
    id: string,
    patch: Partial<{ visibility: string; status: string }>,
  ): Promise<void>;
  setVisibility(
    id: string,
    isPublic: boolean,
  ): Promise<{ visibility: string; status: string }>;
}

export interface RideOfferRepositoryPort {
  listVisible(): Promise<RideOffer[]>;
  submitOffer(input: {
    rideRequestId: string;
    message?: string;
  }): Promise<{ offerId: string; rideRequestId: string }>;
  acceptOffer(input: {
    rideRequestId: string;
    offerId: string;
  }): Promise<{ assignmentId: string }>;
  declineOffer(offerId: string): Promise<void>;
  withdrawOffer(offerId: string, reason: string): Promise<void>;
}

export interface RideAssignmentRepositoryPort {
  listVisible(): Promise<RideAssignment[]>;
  claimPrivateRide(rideRequestId: string): Promise<{ assignmentId: string }>;
  confirmAfterChange(rideRequestId: string): Promise<void>;
  declineAfterChange(rideRequestId: string): Promise<void>;
  cancelByAngel(rideRequestId: string, reason: string): Promise<void>;
}

export interface RideAngelConnectionRepositoryPort {
  listForCurrentUser(): Promise<RideAngelConnection[]>;
  findProfileForInvite(identifier: string): Promise<User | null>;
  insert(
    connection: RideAngelConnection,
    names: { riderDisplayName: string; angelDisplayName: string },
  ): Promise<RideAngelConnection>;
  updateStatus(
    id: string,
    patch: Partial<{
      status: string;
      accepted_at: string | null;
      relationship_label?: string;
      invited_at?: string;
    }>,
  ): Promise<void>;
  removeConnection(id: string): Promise<void>;
  acceptInvite(connectionId: string): Promise<void>;
}

export interface NotificationRepositoryPort {
  listForRecipient(recipientProfileId: string): Promise<AppNotification[]>;
  create(input: {
    recipientProfileId: string;
    type: NotificationType;
    title: string;
    body: string;
    relatedAppointmentId?: string;
    relatedRideRequestId?: string;
  }): Promise<AppNotification>;
  markRead(id: string): Promise<void>;
  markAllRead(recipientProfileId: string): Promise<void>;
  delete(id: string): Promise<void>;
  deleteRead(recipientProfileId: string): Promise<void>;
}

export interface ProfileDirectoryPort {
  loadByIds(ids: string[]): Promise<User[]>;
}
