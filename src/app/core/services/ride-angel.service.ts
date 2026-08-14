import { Injectable, computed, inject, signal } from '@angular/core';
import { RideAngelConnection, User } from '../models';
import { MOCK_CONNECTIONS } from '../mock/mock-data';
import { RIDE_ANGEL_CONNECTION_REPOSITORY } from '../repositories/tokens';
import { isSupabaseConfigured } from '../supabase/supabase-client';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';
import { newUuid } from '../utils/uuid';

export interface AngelListItem {
  connectionId: string;
  angel: User;
  relationshipLabel: string;
  status: RideAngelConnection['status'];
}

export interface PendingInviteItem {
  connectionId: string;
  rider: User;
  angel: User;
  relationshipLabel: string;
  invitedAt: string;
  direction: 'outgoing' | 'incoming';
}

@Injectable({ providedIn: 'root' })
export class RideAngelService {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly connectionsRepo = inject(RIDE_ANGEL_CONNECTION_REPOSITORY);

  private readonly connections = signal<RideAngelConnection[]>(
    isSupabaseConfigured() ? [] : [...MOCK_CONNECTIONS],
  );

  readonly myAngels = computed(() => {
    const riderId = this.auth.getCurrentUserOrNull()?.id;
    if (!riderId) {
      return [];
    }
    return this.connections()
      .filter((c) => c.riderId === riderId && c.status === 'accepted')
      .map((c) => this.toAngelItem(c))
      .filter((x): x is AngelListItem => !!x);
  });

  readonly pendingOutgoing = computed(() => {
    const riderId = this.auth.getCurrentUserOrNull()?.id;
    if (!riderId) {
      return [];
    }
    return this.connections()
      .filter((c) => c.riderId === riderId && c.status === 'pending')
      .map((c) => this.toPendingItem(c, 'outgoing'))
      .filter((x): x is PendingInviteItem => !!x);
  });

  readonly pendingIncoming = computed(() => {
    const angelId = this.auth.getCurrentUserOrNull()?.id;
    if (!angelId) {
      return [];
    }
    return this.connections()
      .filter((c) => c.angelId === angelId && c.status === 'pending')
      .map((c) => this.toPendingItem(c, 'incoming'))
      .filter((x): x is PendingInviteItem => !!x);
  });

  readonly ridersIHelp = computed(() => {
    const angelId = this.auth.getCurrentUserOrNull()?.id;
    if (!angelId) {
      return [];
    }
    return this.connections()
      .filter((c) => c.angelId === angelId && c.status === 'accepted')
      .map((c) => {
        const rider = this.resolveUser(c.riderId, c.riderDisplayName, 'rider');
        if (!rider) {
          return null;
        }
        return {
          connectionId: c.id,
          rider,
          relationshipLabel: c.relationshipLabel,
        };
      })
      .filter(
        (x): x is { connectionId: string; rider: User; relationshipLabel: string } =>
          !!x,
      );
  });

  readonly allConnections = computed(() => this.connections());

  replaceAll(connections: RideAngelConnection[]): void {
    this.connections.set(connections);
  }

  getConnectionsForRider(
    riderId = this.auth.getCurrentUserOrNull()?.id,
  ): RideAngelConnection[] {
    if (!riderId) {
      return [];
    }
    return this.connections().filter((c) => c.riderId === riderId);
  }

  getAcceptedAngelIds(riderId: string): string[] {
    return this.connections()
      .filter((c) => c.riderId === riderId && c.status === 'accepted')
      .map((c) => c.angelId);
  }

  /** True when current user is an accepted angel for this rider. */
  isAcceptedAngelForRider(riderId: string): boolean {
    const angelId = this.auth.getCurrentUserOrNull()?.id;
    if (!angelId) {
      return false;
    }
    return this.connections().some(
      (c) =>
        c.angelId === angelId &&
        c.riderId === riderId &&
        c.status === 'accepted',
    );
  }

  async removeAngel(connectionId: string): Promise<void> {
    this.connections.update((list) =>
      list.map((c) =>
        c.id === connectionId ? { ...c, status: 'removed' as const } : c,
      ),
    );
    if (isSupabaseConfigured()) {
      await this.connectionsRepo.removeConnection(connectionId);
    }
  }

  /**
   * Invite by verified email (or E.164 phone) of an existing Ride Angels profile.
   */
  async inviteByEmail(payload: {
    email: string;
    relationshipLabel: string;
  }): Promise<RideAngelConnection> {
    const rider = this.auth.getCurrentUser();
    const email = payload.email.trim().toLowerCase();
    if (!email) {
      throw new Error('Enter an email address.');
    }

    let angel =
      this.auth.listUsers().find((u) => u.email?.toLowerCase() === email) ??
      null;

    if (!angel && isSupabaseConfigured()) {
      angel = await this.connectionsRepo.findProfileForInvite(email);
      if (angel) {
        this.auth.rememberUser(angel);
      }
    }

    if (!angel) {
      throw new Error(
        'No Ride Angels account found for that email. They need to create an account and add that email first.',
      );
    }

    if (angel.id === rider.id) {
      throw new Error('You cannot invite yourself.');
    }

    const existing = this.connections().find(
      (c) => c.riderId === rider.id && c.angelId === angel!.id,
    );
    if (existing?.status === 'accepted') {
      throw new Error(`${angel.displayName} is already in your circle.`);
    }
    if (existing?.status === 'pending') {
      throw new Error(`An invite to ${angel.displayName} is already pending.`);
    }

    const relationshipLabel =
      payload.relationshipLabel.trim() || 'Trusted contact';
    const invitedAt = new Date().toISOString();

    // Revive removed/declined rows instead of inserting a duplicate pair.
    if (existing && (existing.status === 'removed' || existing.status === 'declined')) {
      const revived: RideAngelConnection = {
        ...existing,
        status: 'pending',
        relationshipLabel,
        invitedAt,
        acceptedAt: undefined,
        riderDisplayName: rider.displayName,
        angelDisplayName: angel.displayName,
      };
      this.connections.update((list) =>
        list.map((c) => (c.id === existing.id ? revived : c)),
      );
      if (isSupabaseConfigured()) {
        await this.connectionsRepo.updateStatus(existing.id, {
          status: 'pending',
          accepted_at: null,
          relationship_label: relationshipLabel,
          invited_at: invitedAt,
        });
      }
      this.notifications.notify({
        userId: angel.id,
        type: 'angel_invited',
        title: 'Ride Angel invite',
        body: `${rider.displayName} invited you to be their Ride Angel.`,
      });
      return revived;
    }

    const connection: RideAngelConnection = {
      id: newUuid(),
      riderId: rider.id,
      angelId: angel.id,
      status: 'pending',
      relationshipLabel,
      invitedAt,
      riderDisplayName: rider.displayName,
      angelDisplayName: angel.displayName,
    };

    if (isSupabaseConfigured()) {
      const saved = await this.connectionsRepo.insert(connection, {
        riderDisplayName: rider.displayName,
        angelDisplayName: angel.displayName,
      });
      this.connections.update((list) => [...list, saved]);
      this.notifications.notify({
        userId: angel.id,
        type: 'angel_invited',
        title: 'Ride Angel invite',
        body: `${rider.displayName} invited you to be their Ride Angel.`,
      });
      return saved;
    }

    this.connections.update((list) => [...list, connection]);
    this.notifications.notify({
      userId: angel.id,
      type: 'angel_invited',
      title: 'Ride Angel invite',
      body: `${rider.displayName} invited you to be their Ride Angel.`,
    });
    return connection;
  }

  async acceptInvite(connectionId: string): Promise<void> {
    const connection = this.connections().find((c) => c.id === connectionId);
    if (!connection || connection.status !== 'pending') {
      return;
    }

    const angel = this.auth.getCurrentUser();
    if (connection.angelId !== angel.id) {
      return;
    }

    const acceptedAt = new Date().toISOString();
    this.connections.update((list) =>
      list.map((c) =>
        c.id === connectionId
          ? { ...c, status: 'accepted' as const, acceptedAt }
          : c,
      ),
    );

    if (isSupabaseConfigured()) {
      await this.connectionsRepo.updateStatus(connectionId, {
        status: 'accepted',
        accepted_at: acceptedAt,
      });
    }

    this.notifications.notify({
      userId: connection.riderId,
      type: 'angel_accepted',
      title: 'Invite accepted',
      body: `${angel.displayName} accepted your Ride Angel invite.`,
    });
  }

  async declineInvite(connectionId: string): Promise<void> {
    const connection = this.connections().find((c) => c.id === connectionId);
    if (!connection || connection.status !== 'pending') {
      return;
    }

    const angel = this.auth.getCurrentUser();
    if (connection.angelId !== angel.id) {
      return;
    }

    this.connections.update((list) =>
      list.map((c) =>
        c.id === connectionId ? { ...c, status: 'declined' as const } : c,
      ),
    );

    if (isSupabaseConfigured()) {
      await this.connectionsRepo.updateStatus(connectionId, { status: 'declined' });
    }
  }

  private resolveUser(
    id: string,
    displayName: string | undefined,
    role: 'rider' | 'rideAngel',
  ): User | undefined {
    return (
      this.auth.getUserById(id) ??
      (displayName
        ? {
            id,
            authUserId: id,
            firstName: '',
            lastName: '',
            displayName,
            roles: [role],
          }
        : undefined)
    );
  }

  private toAngelItem(c: RideAngelConnection): AngelListItem | null {
    const angel = this.resolveUser(c.angelId, c.angelDisplayName, 'rideAngel');
    if (!angel) {
      return null;
    }
    return {
      connectionId: c.id,
      angel,
      relationshipLabel: c.relationshipLabel,
      status: c.status,
    };
  }

  private toPendingItem(
    c: RideAngelConnection,
    direction: 'outgoing' | 'incoming',
  ): PendingInviteItem | null {
    const rider = this.resolveUser(c.riderId, c.riderDisplayName, 'rider');
    const angel = this.resolveUser(c.angelId, c.angelDisplayName, 'rideAngel');
    if (!rider || !angel) {
      return null;
    }
    return {
      connectionId: c.id,
      rider,
      angel,
      relationshipLabel: c.relationshipLabel,
      invitedAt: c.invitedAt,
      direction,
    };
  }
}
