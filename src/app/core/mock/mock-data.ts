import {
  Address,
  Appointment,
  AssignmentConfirmationStatus,
  ClaimBoardItem,
  RideAngelConnection,
  RideAssignment,
  RideCardView,
  RideOffer,
  RideRequest,
  RideStatus,
  RideStatusLabel,
  User,
} from '../models';
import { isPastAppointmentListWindow, isPastLocalDateTime } from '../utils/date-time';

/** Offline-demo avatars — large PNGs are not packaged in Cap builds. */
export const ASSET = {
  eleanor: '',
  auntSarah: '',
  david: '',
  emily: '',
  angelSarah: '',
  angelDavid: '',
  angelEmily: '',
} as const;

export const CURRENT_RIDER_ID = 'user-eleanor';
export const CURRENT_ANGEL_ID = 'user-sarah';

const home: Address = {
  id: 'addr-home',
  label: 'Home',
  line1: '123 Elderberry Ln',
};

const hopeClinic: Address = {
  id: 'addr-hope',
  label: 'Hope Clinic',
  line1: 'Hope Clinic',
};

const kroger: Address = {
  id: 'addr-kroger',
  label: 'Kroger on Main',
  line1: '456 Main St',
};

const henderson: Address = {
  id: 'addr-henderson',
  label: 'Henderson Dental',
  line1: 'Henderson Dental',
};

const stJude: Address = {
  id: 'addr-stjude',
  label: 'St. Jude Hospital',
  line1: 'St. Jude Hospital',
};

const pineSt: Address = {
  id: 'addr-pine',
  label: '12 Pine St',
  line1: '12 Pine St',
};

export const MOCK_USERS: User[] = [
  {
    id: CURRENT_RIDER_ID,
    authUserId: CURRENT_RIDER_ID,
    firstName: 'Eleanor',
    lastName: 'Vance',
    displayName: 'Eleanor Vance',
    email: 'eleanor@rideangels.app',
    phone: '(555) 010-1000',
    avatarUrl: ASSET.eleanor,
    roles: ['rider'],
    homeAddress: home,
  },
  {
    id: 'user-sarah',
    authUserId: 'user-sarah',
    firstName: 'Sarah',
    lastName: 'Vance',
    displayName: 'Aunt Sarah',
    email: 'sarah@rideangels.app',
    phone: '(555) 019-2834',
    avatarUrl: ASSET.angelSarah,
    roles: ['rideAngel'],
  },
  {
    id: 'user-david',
    authUserId: 'user-david',
    firstName: 'David',
    lastName: 'Peterson',
    displayName: 'David Peterson',
    email: 'david@rideangels.app',
    phone: '(555) 014-9831',
    avatarUrl: ASSET.angelDavid,
    roles: ['rideAngel'],
  },
  {
    id: 'user-emily',
    authUserId: 'user-emily',
    firstName: 'Emily',
    lastName: 'Nguyen',
    displayName: 'Nurse Emily',
    email: 'emily@rideangels.app',
    phone: '(555) 012-4422',
    avatarUrl: ASSET.angelEmily,
    roles: ['rideAngel', 'rider'],
  },
  {
    id: 'user-henry',
    authUserId: 'user-henry',
    firstName: 'Henry',
    lastName: 'Smith',
    displayName: 'Henry Smith',
    email: 'henry@rideangels.app',
    phone: '(555) 011-2200',
    roles: ['rider'],
    homeAddress: pineSt,
  },
  {
    id: 'user-jordan',
    authUserId: 'user-jordan',
    firstName: 'Jordan',
    lastName: 'Lee',
    displayName: 'Jordan Lee',
    email: 'jordan@rideangels.app',
    phone: '(555) 016-7788',
    avatarUrl: ASSET.david,
    roles: ['rideAngel'],
  },
];

/** Demo password for seeded accounts — simulator/testing only */
export const DEMO_PASSWORD = 'rideangels';

export const MOCK_CONNECTIONS: RideAngelConnection[] = [
  {
    id: 'conn-1',
    riderId: CURRENT_RIDER_ID,
    angelId: 'user-sarah',
    status: 'accepted',
    relationshipLabel: 'Sister-in-Law',
    invitedAt: '2026-09-01T12:00:00.000Z',
    acceptedAt: '2026-09-01T14:00:00.000Z',
  },
  {
    id: 'conn-2',
    riderId: CURRENT_RIDER_ID,
    angelId: 'user-david',
    status: 'accepted',
    relationshipLabel: 'Neighbor',
    invitedAt: '2026-09-05T12:00:00.000Z',
    acceptedAt: '2026-09-05T16:00:00.000Z',
  },
  {
    id: 'conn-3',
    riderId: CURRENT_RIDER_ID,
    angelId: 'user-emily',
    status: 'accepted',
    relationshipLabel: 'Friend',
    invitedAt: '2026-09-10T12:00:00.000Z',
    acceptedAt: '2026-09-10T13:00:00.000Z',
  },
  /** Demo pending invite — visible when signed in as Aunt Sarah */
  {
    id: 'conn-pending-henry',
    riderId: 'user-henry',
    angelId: CURRENT_ANGEL_ID,
    status: 'pending',
    relationshipLabel: 'Neighbor',
    invitedAt: '2026-10-08T15:00:00.000Z',
  },
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: 'appt-pt',
    riderId: CURRENT_RIDER_ID,
    createdByUserId: CURRENT_RIDER_ID,
    title: 'Physical Therapy',
    date: '2026-10-14',
    time: '14:00',
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
  },
  {
    id: 'appt-grocery',
    riderId: CURRENT_RIDER_ID,
    createdByUserId: CURRENT_RIDER_ID,
    title: 'Weekly Grocery Run',
    date: '2026-10-16',
    time: '10:30',
    createdAt: '2026-10-02T12:00:00.000Z',
    updatedAt: '2026-10-02T12:00:00.000Z',
  },
  {
    id: 'appt-dentist',
    riderId: CURRENT_RIDER_ID,
    createdByUserId: CURRENT_RIDER_ID,
    title: 'Dr. Henderson (Dentist)',
    date: '2026-10-21',
    time: '09:15',
    createdAt: '2026-10-03T12:00:00.000Z',
    updatedAt: '2026-10-03T12:00:00.000Z',
  },
  {
    id: 'appt-cardio',
    riderId: 'user-henry',
    createdByUserId: 'user-henry',
    title: 'Cardiology Checkup',
    date: '2026-10-17',
    time: '13:15',
    createdAt: '2026-10-04T12:00:00.000Z',
    updatedAt: '2026-10-04T12:00:00.000Z',
  },
];

export const MOCK_RIDE_REQUESTS: RideRequest[] = [
  {
    id: 'ride-pt',
    appointmentId: 'appt-pt',
    riderId: CURRENT_RIDER_ID,
    createdByUserId: CURRENT_RIDER_ID,
    source: 'rider',
    pickup: home,
    destination: hopeClinic,
    returnNeeded: false,
    visibility: 'private',
    status: 'ride_confirmed',
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-10T12:00:00.000Z',
  },
  {
    id: 'ride-grocery',
    appointmentId: 'appt-grocery',
    riderId: CURRENT_RIDER_ID,
    createdByUserId: CURRENT_RIDER_ID,
    source: 'rider',
    pickup: { ...home, label: 'Home (123 Elderberry Ln)' },
    destination: { ...kroger, label: 'Kroger Pharmacy (456 Main St)' },
    returnNeeded: true,
    returnPickupTime: '12:00',
    returnDestination: home,
    visibility: 'private',
    status: 'private_requested',
    createdAt: '2026-10-02T12:00:00.000Z',
    updatedAt: '2026-10-02T12:00:00.000Z',
  },
  {
    id: 'ride-dentist',
    appointmentId: 'appt-dentist',
    riderId: CURRENT_RIDER_ID,
    createdByUserId: CURRENT_RIDER_ID,
    source: 'rider',
    pickup: home,
    destination: henderson,
    returnNeeded: false,
    visibility: 'public',
    status: 'offers_received',
    createdAt: '2026-10-03T12:00:00.000Z',
    updatedAt: '2026-10-08T12:00:00.000Z',
  },
  {
    id: 'ride-cardio',
    appointmentId: 'appt-cardio',
    riderId: 'user-henry',
    createdByUserId: 'user-henry',
    source: 'rider',
    pickup: pineSt,
    destination: stJude,
    returnNeeded: false,
    visibility: 'public',
    status: 'public_requested',
    createdAt: '2026-10-04T12:00:00.000Z',
    updatedAt: '2026-10-04T12:00:00.000Z',
  },
];

export const MOCK_ASSIGNMENTS: RideAssignment[] = [
  {
    id: 'assign-pt',
    rideRequestId: 'ride-pt',
    angelId: 'user-sarah',
    source: 'private_claim',
    assignedAt: '2026-10-10T12:00:00.000Z',
    assignedByUserId: 'user-sarah',
  },
];

export const MOCK_OFFERS: RideOffer[] = [
  {
    id: 'offer-dentist-david',
    rideRequestId: 'ride-dentist',
    angelId: 'user-david',
    status: 'pending',
    message: 'I can pick you up a few minutes early and wait if needed.',
    createdAt: '2026-10-08T15:30:00.000Z',
  },
];

export function toStatusLabel(
  status: RideStatus,
  confirmationStatus?: AssignmentConfirmationStatus,
): RideStatusLabel {
  if (confirmationStatus === 'pending_reconfirm') {
    return 'Needs confirm';
  }
  switch (status) {
    case 'ride_confirmed':
    case 'upcoming':
    case 'in_progress':
      return 'Claimed';
    case 'completed':
      return 'Completed';
    case 'cancelled':
    case 'ride_cancelled':
      return 'Cancelled';
    case 'offers_received':
      return 'Needs confirm';
    default:
      return 'Unclaimed';
  }
}

export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatDateLabel(date: string, reference?: string): string {
  const d = new Date(`${date}T12:00:00`);
  const ref = reference
    ? new Date(`${reference}T12:00:00`)
    : new Date();
  // Compare calendar days in local time.
  const same =
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate();

  const monthDay = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  if (same) {
    return `Today, ${monthDay}`;
  }

  const tomorrow = new Date(ref);
  tomorrow.setDate(ref.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  if (isTomorrow) {
    return `Tomorrow, ${monthDay}`;
  }

  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday}, ${monthDay}`;
}

export function formatWhenLong(date: string, time: string): string {
  const d = new Date(`${date}T12:00:00`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${weekday}, ${monthDay} • ${formatTimeLabel(time)}`;
}

export function buildRideCards(
  appointments: Appointment[],
  rides: RideRequest[],
  assignments: RideAssignment[],
  users: User[],
): RideCardView[] {
  const cards: RideCardView[] = [];

  for (const appt of appointments) {
    if (appt.status === 'cancelled') {
      continue;
    }
    const ride = rides.find((r) => r.appointmentId === appt.id);
    if (
      isPastAppointmentListWindow(
        appt.date,
        appt.time,
        ride?.returnPickupTime,
      )
    ) {
      continue;
    }
    if (!ride) {
      continue;
    }
    if (
      ride.status === 'cancelled' ||
      ride.status === 'ride_cancelled' ||
      ride.status === 'completed'
    ) {
      continue;
    }
    const assignment = assignments.find(
      (a) =>
        a.rideRequestId === ride.id &&
        (!a.confirmationStatus ||
          a.confirmationStatus === 'confirmed' ||
          a.confirmationStatus === 'pending_reconfirm'),
    );
    const angel = assignment
      ? users.find((u) => u.id === assignment.angelId)
      : undefined;

    cards.push({
      appointmentId: appt.id,
      rideRequestId: ride.id,
      title: appt.title,
      timeLabel: formatTimeLabel(appt.time),
      dateLabel: formatDateLabel(appt.date),
      fromLabel: ride.pickup.label.split('(')[0].trim() || ride.pickup.label,
      toLabel: ride.destination.label.split('(')[0].trim() || ride.destination.label,
      statusLabel: toStatusLabel(ride.status, assignment?.confirmationStatus),
      claimedByName: angel?.displayName,
      claimedByAvatarUrl: angel?.avatarUrl,
      date: appt.date,
      time: appt.time,
      viewAs: 'rider',
      visibility: ride.visibility === 'public' ? 'public' : 'private',
    });
  }

  return cards.sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  );
}

/** Confirmed trips the angel is driving — chronological, not discovery. */
export function buildUpcomingDrivesForAngel(
  appointments: Appointment[],
  rides: RideRequest[],
  assignments: RideAssignment[],
  users: User[],
  angelId: string,
): RideCardView[] {
  const cards: RideCardView[] = [];

  for (const assignment of assignments) {
    if (assignment.angelId !== angelId) {
      continue;
    }
    if (
      assignment.confirmationStatus === 'released' ||
      assignment.confirmationStatus === 'cancelled'
    ) {
      continue;
    }
    const ride = rides.find((r) => r.id === assignment.rideRequestId);
    if (!ride) {
      continue;
    }
    if (ride.status === 'cancelled' || ride.status === 'ride_cancelled' || ride.status === 'completed') {
      continue;
    }
    const appt = appointments.find((a) => a.id === ride.appointmentId);
    if (!appt || appt.status === 'cancelled') {
      continue;
    }
    if (
      isPastAppointmentListWindow(
        appt.date,
        appt.time,
        ride.returnPickupTime,
      )
    ) {
      continue;
    }
    const rider = users.find((u) => u.id === ride.riderId);

    cards.push({
      appointmentId: appt.id,
      rideRequestId: ride.id,
      title: appt.title,
      timeLabel: formatTimeLabel(appt.time),
      dateLabel: formatDateLabel(appt.date),
      fromLabel: ride.pickup.label.split('(')[0].trim() || ride.pickup.label,
      toLabel: ride.destination.label.split('(')[0].trim() || ride.destination.label,
      statusLabel: toStatusLabel(ride.status, assignment.confirmationStatus),
      date: appt.date,
      time: appt.time,
      viewAs: 'angel',
      riderName:
        rider?.displayName || ride.riderDisplayName || 'Rider',
      visibility: ride.visibility === 'public' ? 'public' : 'private',
    });
  }

  return cards.sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  );
}

export function buildClaimBoard(
  appointments: Appointment[],
  rides: RideRequest[],
  assignments: RideAssignment[],
  users: User[],
  connections: RideAngelConnection[],
  angelId: string,
  options?: { includeClaimedByMe?: boolean },
): ClaimBoardItem[] {
  const includeClaimedByMe = options?.includeClaimedByMe ?? false;
  const privateRiderIds = new Set(
    connections
      .filter((c) => c.angelId === angelId && c.status === 'accepted')
      .map((c) => c.riderId),
  );

  const items: ClaimBoardItem[] = [];

  for (const ride of rides) {
    // Never show your own ride on the claim board.
    if (ride.riderId === angelId) {
      continue;
    }
    if (
      ride.status === 'cancelled' ||
      ride.status === 'ride_cancelled' ||
      ride.status === 'completed' ||
      ride.status === 'ride_confirmed' ||
      ride.status === 'upcoming' ||
      ride.status === 'in_progress'
    ) {
      // Confirmed / in-progress rides belong in Upcoming drives, not open board —
      // unless we explicitly keep claimed-by-me cards (legacy).
      const assignment = assignments.find((a) => a.rideRequestId === ride.id);
      if (assignment?.angelId === angelId && includeClaimedByMe) {
        // fall through
      } else {
        continue;
      }
    }

    const assignment = assignments.find((a) => a.rideRequestId === ride.id);
    const claimedByMe = assignment?.angelId === angelId;

    if (claimedByMe && !includeClaimedByMe) {
      continue;
    }

    // Discovery: public board or trusted private circle.
    if (claimedByMe && includeClaimedByMe) {
      // keep
    } else if (ride.visibility === 'public') {
      // eligible for community discovery
    } else if (ride.visibility === 'private') {
      if (!privateRiderIds.has(ride.riderId)) {
        continue;
      }
    } else {
      continue;
    }

    // Skip already assigned rides for other angels.
    if (assignment && assignment.angelId !== angelId) {
      continue;
    }

    // Skip open rides that already have any assignment when not claimed by me.
    if (assignment && !claimedByMe) {
      continue;
    }

    const appt = appointments.find((a) => a.id === ride.appointmentId);
    if (!appt || appt.status === 'cancelled') {
      continue;
    }
    if (isPastLocalDateTime(appt.date, appt.time)) {
      continue;
    }
    const rider = users.find((u) => u.id === ride.riderId);
    const riderName =
      rider?.displayName || ride.riderDisplayName || 'Community rider';
    const relationship =
      connections.find(
        (c) => c.riderId === ride.riderId && c.angelId === angelId,
      )?.relationshipLabel ??
      (ride.visibility === 'public' ? 'Community rider' : 'Trusted rider');

    items.push({
      appointmentId: appt.id,
      rideRequestId: ride.id,
      riderName,
      riderRelationship: relationship,
      title: appt.title,
      whenLabel: `${formatDateLabel(appt.date)} at ${formatTimeLabel(appt.time)}`,
      routeLabel: `${ride.pickup.label.split('(')[0].trim()} to ${ride.destination.label.split('(')[0].trim()}`,
      visibility: ride.visibility === 'public' ? 'public' : 'private',
      claimedByCurrentUser: claimedByMe,
      date: appt.date,
      time: appt.time,
    });
  }

  return items.sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  );
}
