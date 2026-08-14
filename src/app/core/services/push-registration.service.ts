import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { AuthService } from './auth.service';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../supabase/supabase-client';

export type PushPlatform = 'ios' | 'android' | 'web';

export type PushDeviceStatus =
  | 'unavailable'
  | 'loading'
  | 'off'
  | 'on'
  | 'denied';

const OPT_IN_KEY = 'ra_push_opt_in';
const TOKEN_KEY = 'ra_push_device_token';

/**
 * Capacitor push registration + token persistence.
 * Delivery is server-side (APNs/FCM) after in-app notification inserts.
 */
@Injectable({ providedIn: 'root' })
export class PushRegistrationService {
  private readonly auth = inject(AuthService);
  private listenersAttached = false;
  private pendingToken: string | null = null;
  private lastError: string | null = null;

  readonly status = signal<PushDeviceStatus>('loading');
  readonly statusDetail = signal<string | null>(null);

  /** True when this device is opted in and OS permission is granted. */
  readonly isOn = () => this.status() === 'on';

  async refreshStatus(): Promise<PushDeviceStatus> {
    if (!Capacitor.isNativePlatform()) {
      this.status.set('unavailable');
      this.statusDetail.set('Push requires the iOS or Android app.');
      return 'unavailable';
    }

    try {
      const perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'denied') {
        this.status.set('denied');
        this.statusDetail.set(
          'Notifications are blocked in system settings.',
        );
        return 'denied';
      }

      let optedIn = await this.readOptIn();
      // First launch after this update: keep prior OS grant as On.
      if (optedIn === null && perm.receive === 'granted') {
        await this.writeOptIn(true);
        optedIn = true;
      }

      if (!optedIn) {
        this.status.set('off');
        this.statusDetail.set('Push is off on this device.');
        return 'off';
      }

      if (perm.receive !== 'granted') {
        this.status.set('off');
        this.statusDetail.set('Permission not granted yet.');
        return 'off';
      }

      this.status.set('on');
      this.statusDetail.set('Push is on for this device.');
      return 'on';
    } catch {
      this.status.set('off');
      this.statusDetail.set(null);
      return 'off';
    }
  }

  async enable(): Promise<{ ready: boolean; reason?: string }> {
    if (!Capacitor.isNativePlatform()) {
      return {
        ready: false,
        reason: 'Push requires the iOS or Android app build (not the browser).',
      };
    }

    const user = this.auth.getCurrentUserOrNull();
    if (!user?.id) {
      return {
        ready: false,
        reason: 'Sign in before enabling push notifications.',
      };
    }

    try {
      await this.ensureListeners();
      let perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
        perm = await PushNotifications.requestPermissions();
      }
      if (perm.receive !== 'granted') {
        await this.writeOptIn(false);
        this.status.set('denied');
        this.statusDetail.set(
          'Notification permission was not granted.',
        );
        return {
          ready: false,
          reason:
            Capacitor.getPlatform() === 'android'
              ? 'Notification permission was not granted. Enable it in Settings → Apps → Ride Angels → Notifications.'
              : 'Notification permission was not granted. Enable it in Settings → Ride Angels → Notifications.',
        };
      }

      await PushNotifications.register();
      await this.writeOptIn(true);

      if (this.pendingToken) {
        await this.persistToken(this.pendingToken);
      }

      this.status.set('on');
      this.statusDetail.set('Push is on for this device.');
      return {
        ready: true,
        reason: this.lastError
          ? `Registered, but last save warning: ${this.lastError}`
          : undefined,
      };
    } catch (err) {
      this.status.set('off');
      return {
        ready: false,
        reason:
          err instanceof Error
            ? err.message
            : 'Unable to register for push notifications.',
      };
    }
  }

  /** Prefer enable() — kept for older call sites. */
  async prepare(): Promise<{ ready: boolean; reason?: string }> {
    return this.enable();
  }

  async disable(): Promise<void> {
    await this.writeOptIn(false);
    await this.removeStoredToken();
    if (Capacitor.isNativePlatform()) {
      const next = await this.refreshStatus();
      if (next === 'denied') {
        return;
      }
    }
    this.status.set('off');
    this.statusDetail.set('Push is off on this device.');
  }

  async openSystemSettings(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const platform = Capacitor.getPlatform();
      if (platform === 'ios') {
        // Opens this app’s page in Settings (Notifications is there).
        window.location.href = 'app-settings:';
        return;
      }
      if (platform === 'android') {
        // App notification settings when supported; falls back to app details.
        window.location.href =
          'intent:#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;' +
          'S.android.provider.extra.APP_PACKAGE=org.rideangels.app;end';
      }
    } catch (err) {
      console.warn('[push] open settings failed', err);
    }
  }

  statusLabel(): string {
    switch (this.status()) {
      case 'on':
        return 'On';
      case 'denied':
        return 'Blocked in Settings';
      case 'unavailable':
        return 'Unavailable';
      case 'loading':
        return 'Checking…';
      default:
        return 'Off';
    }
  }

  private async readOptIn(): Promise<boolean | null> {
    const { value } = await Preferences.get({ key: OPT_IN_KEY });
    if (value === null || value === undefined) return null;
    return value === '1';
  }

  private async writeOptIn(on: boolean): Promise<void> {
    await Preferences.set({
      key: OPT_IN_KEY,
      value: on ? '1' : '0',
    });
  }

  private async removeStoredToken(): Promise<void> {
    const { value: token } = await Preferences.get({ key: TOKEN_KEY });
    const user = this.auth.getCurrentUserOrNull();
    if (token && user?.id && isSupabaseConfigured()) {
      await getSupabaseClient()
        .from('device_push_tokens')
        .delete()
        .eq('user_id', user.authUserId || user.id)
        .eq('token', token);
    }
    await Preferences.remove({ key: TOKEN_KEY });
    this.pendingToken = null;
  }

  private async ensureListeners(): Promise<void> {
    if (this.listenersAttached) return;
    this.listenersAttached = true;

    await PushNotifications.addListener('registration', (token) => {
      const value = (token.value ?? '').trim();
      this.pendingToken = value;
      void this.persistToken(value);
    });

    await PushNotifications.addListener('registrationError', (err) => {
      this.lastError = err.error;
      console.warn('[push] registration error', err.error);
    });
  }

  private async persistToken(token: string): Promise<void> {
    const user = this.auth.getCurrentUserOrNull();
    if (!token) return;
    await Preferences.set({ key: TOKEN_KEY, value: token });
    if (!user?.id) {
      this.pendingToken = token;
      return;
    }

    const platform = this.platform();
    if (!isSupabaseConfigured()) {
      this.pendingToken = null;
      return;
    }

    const { error } = await getSupabaseClient().from('device_push_tokens').upsert(
      {
        user_id: user.authUserId || user.id,
        token,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' },
    );
    if (error) {
      this.lastError = error.message;
      console.warn('[push] token upsert failed', error.message);
      return;
    }
    this.lastError = null;
    this.pendingToken = null;
  }

  private platform(): PushPlatform {
    const p = Capacitor.getPlatform();
    if (p === 'ios') return 'ios';
    if (p === 'android') return 'android';
    return 'web';
  }
}
