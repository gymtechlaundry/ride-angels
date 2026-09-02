import { Injectable, inject, signal } from '@angular/core';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../supabase/supabase-client';
import { AuthService } from './auth.service';
import { NotificationType } from '../models';

export interface NotificationPrefItem {
  type: NotificationType;
  label: string;
  description: string;
}

/** Only types that are actually inserted by the app or SQL today. */
export const NOTIFICATION_PREF_GROUPS: Array<{
  title: string;
  items: NotificationPrefItem[];
}> = [
  {
    title: 'Trusted circle',
    items: [
      {
        type: 'angel_invited',
        label: 'Circle invites',
        description: 'When someone invites you to their trusted circle',
      },
      {
        type: 'angel_accepted',
        label: 'Circle accepted',
        description: 'When someone accepts your circle invite',
      },
      {
        type: 'circle_removed',
        label: 'Circle removed',
        description: 'When a trusted circle connection is removed',
      },
    ],
  },
  {
    title: 'Rides & offers',
    items: [
      {
        type: 'private_ride_confirmed',
        label: 'Private ride claimed',
        description: 'When a Ride Angel claims your private ride',
      },
      {
        type: 'public_offer_received',
        label: 'Ride offers',
        description: 'When a Ride Angel offers to drive for your request',
      },
      {
        type: 'offer_accepted',
        label: 'Offer accepted',
        description: 'When a rider accepts your offer',
      },
      {
        type: 'angel_on_my_way',
        label: 'On the way',
        description: 'When your Ride Angel is heading to pick you up',
      },
      {
        type: 'offer_declined',
        label: 'Offer declined',
        description: 'When a rider declines your offer',
      },
      {
        type: 'offer_withdrawn',
        label: 'Offer withdrawn',
        description: 'When a Ride Angel removes a pending offer',
      },
    ],
  },
  {
    title: 'Appointments',
    items: [
      {
        type: 'appointment_changed',
        label: 'Appointments & ride requests',
        description: 'New or changed appointments and ride requests',
      },
    ],
  },
  {
    title: 'Reminders',
    items: [
      {
        type: 'appointment_reminder',
        label: 'Day-before reminders',
        description:
          'Drive tomorrow, or when a circle ride still needs a Ride Angel',
      },
      {
        type: 'pickup_reminder',
        label: 'Hour-before pickup',
        description: 'When you are driving and pickup is about an hour away',
      },
    ],
  },
  {
    title: 'Cancellations',
    items: [
      {
        type: 'angel_cancelled',
        label: 'Angel cancelled',
        description: 'When a Ride Angel cancels an assignment',
      },
      {
        type: 'rider_cancelled',
        label: 'Rider cancelled',
        description: 'When a rider cancels an appointment or ride',
      },
      {
        type: 'ride_cancelled',
        label: 'Ride cancelled',
        description: 'When a ride request is cancelled',
      },
    ],
  },
  {
    title: 'Discussion board',
    items: [
      {
        type: 'discussion_posted',
        label: 'New discussions',
        description: 'When someone starts a new post on Feedback & ideas',
      },
      {
        type: 'discussion_reply',
        label: 'Discussion replies',
        description: 'When someone replies on a thread you posted or joined',
      },
    ],
  },
  {
    title: 'Partner apps',
    items: [
      {
        type: 'partner_link_code',
        label: 'Partner link codes',
        description: 'Codes to link ColorPing or other partner apps',
      },
    ],
  },
];

/** Flat list for callers that still expect a single array. */
export const NOTIFICATION_PREF_TYPES: NotificationPrefItem[] =
  NOTIFICATION_PREF_GROUPS.reduce<NotificationPrefItem[]>(
    (acc, group) => acc.concat(group.items),
    [],
  );

export type NotificationChannelId = 'in_app' | 'sms';

const CHANNEL_PREF_KEYS: Record<NotificationChannelId, string> = {
  in_app: 'channel_in_app',
  sms: 'channel_sms',
};

/** Defaults when a channel key is missing from prefs. */
const CHANNEL_DEFAULTS: Record<NotificationChannelId, boolean> = {
  in_app: true,
  sms: false,
};

@Injectable({ providedIn: 'root' })
export class NotificationPreferencesService {
  private readonly auth = inject(AuthService);
  readonly preferences = signal<Record<string, boolean>>({});
  readonly loaded = signal(false);

  isEnabled(type: string): boolean {
    const map = this.preferences();
    if (!(type in map)) return true;
    return map[type] !== false;
  }

  isChannelEnabled(channel: NotificationChannelId): boolean {
    const key = CHANNEL_PREF_KEYS[channel];
    const map = this.preferences();
    if (!(key in map)) return CHANNEL_DEFAULTS[channel];
    return map[key] !== false;
  }

  async load(): Promise<void> {
    const user = this.auth.getCurrentUserOrNull();
    if (!user?.id || !isSupabaseConfigured()) {
      this.preferences.set({});
      this.loaded.set(true);
      return;
    }

    const { data, error } = await getSupabaseClient()
      .from('notification_preferences')
      .select('preferences')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (error) {
      console.warn('[notif-prefs] load failed', error.message);
      this.preferences.set({});
      this.loaded.set(true);
      return;
    }

    const raw = (data?.preferences ?? {}) as Record<string, unknown>;
    const next: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(raw)) {
      next[k] = v !== false && v !== 'false' && v !== 0;
    }
    this.preferences.set(next);
    this.loaded.set(true);
  }

  async setType(type: string, enabled: boolean): Promise<void> {
    await this.persistPreferences({
      ...this.preferences(),
      [type]: enabled,
    });
  }

  async setChannel(
    channel: NotificationChannelId,
    enabled: boolean,
  ): Promise<void> {
    if (channel === 'sms') {
      throw new Error('SMS notifications are not available yet.');
    }
    const key = CHANNEL_PREF_KEYS[channel];
    await this.persistPreferences({
      ...this.preferences(),
      [key]: enabled,
    });
  }

  private async persistPreferences(
    next: Record<string, boolean>,
  ): Promise<void> {
    const user = this.auth.getCurrentUserOrNull();
    if (!user?.id) throw new Error('Not signed in');

    this.preferences.set(next);

    if (!isSupabaseConfigured()) return;

    const { error } = await getSupabaseClient().rpc(
      'upsert_my_notification_preferences',
      { p_preferences: next },
    );
    if (error) throw new Error(error.message);
  }
}

export interface PartnerLinkRow {
  partnerId: string;
  partnerName: string;
  status: string;
  verifiedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class PartnerLinksService {
  private readonly auth = inject(AuthService);
  readonly links = signal<PartnerLinkRow[]>([]);

  colorPingLinked(): boolean {
    return this.links().some(
      (l) => l.partnerId === 'colorping' && l.status === 'verified',
    );
  }

  async load(): Promise<void> {
    const user = this.auth.getCurrentUserOrNull();
    if (!user?.id || !isSupabaseConfigured()) {
      this.links.set([]);
      return;
    }

    const { data, error } = await getSupabaseClient().rpc(
      'get_my_partner_links',
    );
    if (error) {
      console.warn('[partner-links] load failed', error.message);
      this.links.set([]);
      return;
    }

    const rows = (data ?? []) as Array<{
      partner_id: string;
      partner_name: string;
      status: string;
      verified_at: string | null;
    }>;

    this.links.set(
      rows.map((r) => ({
        partnerId: r.partner_id,
        partnerName: r.partner_name,
        status: r.status,
        verifiedAt: r.verified_at,
      })),
    );
  }

  async unlink(partnerId: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Backend is not configured.');
    }

    const { error } = await getSupabaseClient().rpc('unlink_my_partner', {
      p_partner_id: partnerId,
    });
    if (error) {
      throw new Error(error.message);
    }
    this.links.update((rows) => rows.filter((r) => r.partnerId !== partnerId));
  }
}
