import { Injectable, computed, inject, signal } from '@angular/core';
import { AppNotification, NotificationType } from '../models';
import { NOTIFICATION_REPOSITORY } from '../repositories/tokens';
import { isSupabaseConfigured } from '../supabase/supabase-client';
import { AppBadgeService } from './app-badge.service';
import { AuthService } from './auth.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { newUuid } from '../utils/uuid';

/**
 * In-app notifications.
 * Live: persists via Supabase `notifications` (writes from RPCs; reads here).
 * Mock: local signal store.
 * App icon badge mirrors unread count for the current user.
 * Honors `channel_in_app` preference (client filter; rows remain in the DB).
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly notificationsRepo = inject(NOTIFICATION_REPOSITORY);
  private readonly badge = inject(AppBadgeService);
  private readonly notifPrefs = inject(NotificationPreferencesService);
  private readonly items = signal<AppNotification[]>([]);

  readonly forCurrentUser = computed(() => {
    const userId = this.auth.getCurrentUserOrNull()?.id;
    if (!userId) {
      return [];
    }
    // Depend on prefs so inbox clears when channel_in_app is turned off.
    void this.notifPrefs.preferences();
    if (!this.notifPrefs.isChannelEnabled('in_app')) {
      return [];
    }
    return this.listForUser(userId);
  });

  readonly unreadForCurrentUser = computed(() =>
    this.forCurrentUser().filter((n) => !n.read).length,
  );

  replaceAll(notifications: AppNotification[]): void {
    this.items.set(notifications);
    void this.syncBadge();
  }

  async refreshForCurrentUser(): Promise<void> {
    const userId = this.auth.getCurrentUserOrNull()?.id;
    if (!userId || !isSupabaseConfigured()) {
      await this.badge.clear();
      return;
    }
    const rows = await this.notificationsRepo.listForRecipient(userId);
    this.items.set(rows);
    await this.syncBadge();
  }

  listForUser(userId: string): AppNotification[] {
    return this.items()
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  unreadCount(userId: string): number {
    if (!this.notifPrefs.isChannelEnabled('in_app')) {
      return 0;
    }
    return this.listForUser(userId).filter((n) => !n.read).length;
  }

  notify(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    relatedAppointmentId?: string;
    relatedRideRequestId?: string;
  }): AppNotification {
    const notification: AppNotification = {
      id: newUuid(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      read: false,
      createdAt: new Date().toISOString(),
      relatedAppointmentId: input.relatedAppointmentId,
      relatedRideRequestId: input.relatedRideRequestId,
    };
    this.items.update((list) => [notification, ...list]);
    void this.syncBadge();
    return notification;
  }

  async markRead(id: string): Promise<void> {
    this.items.update((list) =>
      list.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    if (isSupabaseConfigured()) {
      await this.notificationsRepo.markRead(id);
    }
    await this.syncBadge();
  }

  async markAllReadForCurrentUser(): Promise<void> {
    const userId = this.auth.getCurrentUserOrNull()?.id;
    if (!userId) {
      return;
    }
    this.items.update((list) =>
      list.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
    );
    if (isSupabaseConfigured()) {
      await this.notificationsRepo.markAllRead(userId);
    }
    await this.syncBadge();
  }

  async delete(id: string): Promise<void> {
    this.items.update((list) => list.filter((n) => n.id !== id));
    if (isSupabaseConfigured()) {
      await this.notificationsRepo.delete(id);
    }
    await this.syncBadge();
  }

  async clearReadForCurrentUser(): Promise<void> {
    const userId = this.auth.getCurrentUserOrNull()?.id;
    if (!userId) {
      return;
    }
    this.items.update((list) =>
      list.filter((n) => n.userId !== userId || !n.read),
    );
    if (isSupabaseConfigured()) {
      await this.notificationsRepo.deleteRead(userId);
    }
    await this.syncBadge();
  }

  private async syncBadge(): Promise<void> {
    const userId = this.auth.getCurrentUserOrNull()?.id;
    if (!userId) {
      await this.badge.clear();
      return;
    }
    await this.badge.setCount(this.unreadCount(userId));
  }
}
