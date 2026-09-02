import { Injectable, computed, inject, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabase-client';
import { normalizeEmail, toE164 } from '../utils/phone';
import { AuthService } from './auth.service';
import { DomainSyncService } from './domain-sync.service';
import { RideAngelService } from './ride-angel.service';

const PENDING_TOKEN_KEY = 'ra.pendingCircleInviteToken';
export const CIRCLE_INVITE_URL_PREFIX =
  'https://hyperionappstudio.com/rideangels/invite/';

export type CreateCircleInviteResult =
  | {
      kind: 'existing_user';
      connectionId: string;
      angelId: string;
      angelDisplayName: string;
    }
  | {
      kind: 'email_invite';
      inviteId: string;
      token: string;
      email: string;
      inviteUrl: string;
      riderDisplayName: string;
      emailSent: boolean;
    }
  | {
      kind: 'phone_invite';
      inviteId: string;
      token: string;
      phone: string;
      inviteUrl: string;
      riderDisplayName: string;
    };

export type OutboundCircleInvite = {
  id: string;
  email: string;
  phone: string;
  relationshipLabel: string;
  status: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  createdAt: string;
};

/**
 * Tokenized family circle invites (email via Resend + phone share link / deep link claim).
 */
@Injectable({ providedIn: 'root' })
export class CircleInviteService {
  private readonly auth = inject(AuthService);
  private readonly angels = inject(RideAngelService);
  private readonly domainSync = inject(DomainSyncService);

  private readonly outbound = signal<OutboundCircleInvite[]>([]);
  readonly pendingOutbound = computed(() => this.outbound());

  async refreshOutbound(): Promise<void> {
    if (!isSupabaseConfigured() || !this.auth.getCurrentUserOrNull()) {
      this.outbound.set([]);
      return;
    }
    const { data, error } = await getSupabaseClient().rpc(
      'list_my_outbound_circle_invites',
    );
    if (error) {
      console.warn('[circle-invite] list outbound', error.message);
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    this.outbound.set(
      rows.map((row: Record<string, unknown>) => ({
        id: String(row['id']),
        email: String(row['email'] ?? ''),
        phone: String(row['phone'] ?? ''),
        relationshipLabel: String(row['relationship_label'] ?? 'Trusted contact'),
        status: String(row['status'] ?? 'pending'),
        token: String(row['token'] ?? ''),
        inviteUrl: String(
          row['invite_url'] ??
            `${CIRCLE_INVITE_URL_PREFIX}${String(row['token'] ?? '')}`,
        ),
        expiresAt: String(row['expires_at'] ?? ''),
        createdAt: String(row['created_at'] ?? ''),
      })),
    );
  }

  async createInvite(payload: {
    identifier: string;
    relationshipLabel: string;
  }): Promise<CreateCircleInviteResult> {
    const raw = payload.identifier.trim();
    if (!raw) {
      throw new Error('Enter an email or phone number.');
    }

    let identifier: string;
    let channel: 'email' | 'phone';
    if (raw.includes('@')) {
      identifier = normalizeEmail(raw);
      channel = 'email';
    } else {
      identifier = toE164(raw);
      channel = 'phone';
    }

    const relationshipLabel =
      payload.relationshipLabel.trim() || 'Trusted contact';

    if (!isSupabaseConfigured()) {
      if (channel === 'phone') {
        throw new Error('Phone invites need a connected backend.');
      }
      const connection = await this.angels.inviteByEmail({
        email: identifier,
        relationshipLabel,
      });
      return {
        kind: 'existing_user',
        connectionId: connection.id,
        angelId: connection.angelId,
        angelDisplayName:
          this.auth.getUserById(connection.angelId)?.displayName ?? identifier,
      };
    }

    const { data, error } = await getSupabaseClient().rpc('create_circle_invite', {
      p_identifier: identifier,
      p_relationship_label: relationshipLabel,
    });
    if (error) {
      throw new Error(mapInviteError(error.message));
    }
    const result = data as Record<string, unknown>;
    const kind = String(result['kind'] ?? '');

    if (kind === 'existing_user') {
      await this.domainSync.refreshForCurrentUser({ force: true });
      return {
        kind: 'existing_user',
        connectionId: String(result['connection_id']),
        angelId: String(result['angel_id']),
        angelDisplayName: String(
          result['angel_display_name'] ?? 'Ride Angel',
        ),
      };
    }

    if (kind === 'phone_invite') {
      await this.refreshOutbound();
      return {
        kind: 'phone_invite',
        inviteId: String(result['invite_id']),
        token: String(result['token']),
        phone: String(result['phone'] ?? identifier),
        inviteUrl: String(result['invite_url'] ?? ''),
        riderDisplayName: String(result['rider_display_name'] ?? 'You'),
      };
    }

    if (kind !== 'email_invite') {
      throw new Error('Could not create invite.');
    }

    const inviteId = String(result['invite_id']);
    const inviteUrl = String(result['invite_url'] ?? '');
    let emailSent = false;
    try {
      const { error: fnError } = await getSupabaseClient().functions.invoke(
        'send-circle-invite',
        { body: { inviteId } },
      );
      if (fnError) {
        console.warn('[circle-invite] Resend invoke', fnError.message);
      } else {
        emailSent = true;
      }
    } catch (err) {
      console.warn('[circle-invite] Resend failed', err);
    }

    await this.refreshOutbound();
    return {
      kind: 'email_invite',
      inviteId,
      token: String(result['token']),
      email: String(result['email'] ?? identifier),
      inviteUrl,
      riderDisplayName: String(result['rider_display_name'] ?? 'You'),
      emailSent,
    };
  }

  /** Persist token from a deep link until the user finishes auth/onboarding. */
  async stashTokenFromUrl(url: string): Promise<string | null> {
    const token = extractInviteToken(url);
    if (!token) {
      return null;
    }
    await Preferences.set({ key: PENDING_TOKEN_KEY, value: token });
    return token;
  }

  async peekStashedToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: PENDING_TOKEN_KEY });
    return value?.trim() || null;
  }

  async clearStashedToken(): Promise<void> {
    await Preferences.remove({ key: PENDING_TOKEN_KEY });
  }

  /**
   * Claim a token (or the stashed one). Returns rider display name when claimed.
   */
  async claimPendingInvite(token?: string): Promise<{
    claimed: boolean;
    riderDisplayName?: string;
  }> {
    if (!isSupabaseConfigured() || !this.auth.getCurrentUserOrNull()) {
      return { claimed: false };
    }
    const resolved =
      token?.trim() || (await this.peekStashedToken()) || '';
    if (!resolved) {
      return { claimed: false };
    }

    const { data, error } = await getSupabaseClient().rpc('claim_circle_invite', {
      p_token: resolved,
    });
    await this.clearStashedToken();
    if (error) {
      throw new Error(mapInviteError(error.message));
    }
    await this.domainSync.refreshForCurrentUser({ force: true });
    const result = data as Record<string, unknown>;
    const kind = String(result['kind'] ?? '');
    if (kind === 'claimed' || kind === 'already_accepted') {
      return {
        claimed: true,
        riderDisplayName: String(result['rider_display_name'] ?? 'a rider'),
      };
    }
    return { claimed: false };
  }

  async shareInviteUrl(inviteUrl: string, inviterName: string): Promise<void> {
    const text = `${inviterName} invited you to be a Ride Angel on Ride Angels. Join their trusted circle: ${inviteUrl}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({
        title: 'Ride Angels invite',
        text,
        url: inviteUrl,
      });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(inviteUrl);
      return;
    }
    throw new Error('Sharing is not available on this device.');
  }

  /** Open Messages with the invite link prefilled for a phone number. */
  shareInviteViaSms(phone: string, inviteUrl: string, inviterName: string): void {
    const text = `${inviterName} invited you to be a Ride Angel on Ride Angels. Join their trusted circle: ${inviteUrl}`;
    const href = `sms:${phone}?&body=${encodeURIComponent(text)}`;
    window.location.href = href;
  }
}

export function extractInviteToken(url: string): string | null {
  const raw = url.trim();
  if (!raw) {
    return null;
  }
  try {
    if (raw.startsWith('org.rideangels.app://')) {
      const path = raw.replace(/^org\.rideangels\.app:\/\//, '');
      const match = /^invite\/([A-Za-z0-9_-]+)/i.exec(path);
      return match?.[1] ?? null;
    }
    const parsed = new URL(raw);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const inviteIdx = parts.findIndex((p) => p.toLowerCase() === 'invite');
    if (inviteIdx >= 0 && parts[inviteIdx + 1]) {
      return parts[inviteIdx + 1];
    }
  } catch {
    const match = /invite\/([A-Za-z0-9_-]+)/i.exec(raw);
    return match?.[1] ?? null;
  }
  return null;
}

function mapInviteError(message: string): string {
  const key = message.toLowerCase();
  if (key.includes('already_in_circle')) {
    return 'That person is already in your circle.';
  }
  if (key.includes('invite_already_pending')) {
    return 'An invite to that person is already pending.';
  }
  if (key.includes('cannot_invite_self') || key.includes('cannot_claim_own')) {
    return 'You cannot use your own invite.';
  }
  if (key.includes('invalid_email')) {
    return 'Enter a valid email address.';
  }
  if (key.includes('invalid_phone') || key.includes('invalid_identifier')) {
    return 'Enter a valid email or phone number.';
  }
  if (key.includes('invite_expired')) {
    return 'This invite has expired. Ask them to send a new one.';
  }
  if (key.includes('invite_not_found') || key.includes('invalid_token')) {
    return 'This invite link is not valid.';
  }
  if (key.includes('invite_not_pending')) {
    return 'This invite was already used.';
  }
  return message || 'Could not complete the invite.';
}
