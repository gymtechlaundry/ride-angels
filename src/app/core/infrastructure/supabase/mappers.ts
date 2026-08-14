import { AppNotification, NotificationType, User } from '../../models';

export function mapNotificationRow(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row['id']),
    userId: String(row['recipient_profile_id']),
    type: String(row['type']) as NotificationType,
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

export function mapProfileRow(row: Record<string, unknown>): User {
  const roles = ((row['roles'] as string[]) ?? []).filter(
    (r): r is User['roles'][number] =>
      r === 'rider' || r === 'rideAngel' || r === 'both',
  );
  const rawDefault = row['default_persona'];
  const defaultPersona =
    rawDefault === 'angel' ? 'angel' : rawDefault === 'rider' ? 'rider' : undefined;
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
    defaultPersona,
    isAppCreator: !!row['is_app_creator'],
    createdAt: row['created_at'] ? String(row['created_at']) : undefined,
    updatedAt: row['updated_at'] ? String(row['updated_at']) : undefined,
  };
}

export function mapDomainError(message: string): Error {
  const lower = message.toLowerCase();
  if (lower.includes('not_authenticated')) {
    return new Error('You need to sign in first.');
  }
  if (
    lower.includes('account_not_found') ||
    lower.includes('delete_own_account')
  ) {
    return new Error(
      'Could not delete your account. Email support@hyperionappstudio.com.',
    );
  }
  if (lower.includes('ride_already_assigned')) {
    return new Error('This ride was already claimed by someone else.');
  }
  if (lower.includes('not_trusted_angel')) {
    return new Error('You can only claim private rides for riders in your trusted circle.');
  }
  if (lower.includes('cannot_claim_own') || lower.includes('cannot_offer_own')) {
    return new Error('You cannot claim or offer on your own ride.');
  }
  if (lower.includes('offer_not_pending') || lower.includes('offer_already')) {
    return new Error('That offer is no longer available.');
  }
  if (lower.includes('not_ride_owner')) {
    return new Error('Only the rider can accept offers for this ride.');
  }
  if (lower.includes('ride_not_found') || lower.includes('offer_not_found')) {
    return new Error('That ride is no longer available.');
  }
  if (lower.includes('ride_not_claimable') || lower.includes('not_private')) {
    return new Error('This ride cannot be claimed right now.');
  }
  if (lower.includes('not_public') || lower.includes('not_open_for_offers')) {
    return new Error('This ride is not open for public offers.');
  }
  if (lower.includes('ride_not_editable') || lower.includes('ride_not_cancellable')) {
    return new Error('This ride can no longer be changed.');
  }
  if (lower.includes('assignment_not_found')) {
    return new Error('This trip is not currently assigned to you.');
  }
  if (lower.includes('cancellation_reason_required')) {
    return new Error('Please share a reason for the cancellation.');
  }
  if (lower.includes('withdrawal_reason_required')) {
    return new Error('Please share a reason for removing your offer.');
  }
  if (lower.includes('reconfirm_not_pending')) {
    return new Error('This trip no longer needs confirmation.');
  }
  if (lower.includes('not_assigned_angel')) {
    return new Error('Only the assigned Ride Angel can respond to this change.');
  }
  if (lower.includes('not_appointment_owner')) {
    return new Error('Only the rider can change this appointment.');
  }
  if (lower.includes('appointment_already_cancelled')) {
    return new Error('This appointment was already cancelled.');
  }
  return new Error(message);
}
