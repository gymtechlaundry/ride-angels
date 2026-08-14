import { Injectable } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { environment } from '../../../environments/environment';
import {
  CalendarConnectResult,
  CalendarProvider,
  CalendarWriteResult,
} from './calendar-provider';
import { buildCalendarEventContent } from './calendar-event-builder';
import {
  ExternalCalendarInfo,
  RideCalendarEventPayload,
} from '../models/calendar';

interface GoogleTokenBundle {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  email?: string;
}

const TOKEN_KEY = 'ra.google.calendar.tokens';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
].join(' ');

/**
 * Google Calendar via OAuth PKCE + Calendar REST API.
 * Tokens stay on-device (Preferences / Keychain). No client secret in the app.
 */
@Injectable({ providedIn: 'root' })
export class GoogleCalendarProvider implements CalendarProvider {
  readonly id = 'google' as const;
  private pendingVerifier: string | null = null;
  private authResolver:
    | ((result: CalendarConnectResult) => void)
    | null = null;

  isAvailable(): boolean {
    // V1 ships Apple Calendar only; keep this class for a later release.
    const cfg = environment.googleCalendar;
    return !!(cfg?.enabled && (cfg.iosClientId || cfg.webClientId));
  }

  async connect(): Promise<CalendarConnectResult> {
    if (!this.isAvailable()) {
      return {
        ok: false,
        status: 'unavailable',
        message: 'Google Calendar sync is not available in this version.',
      };
    }

    const existing = await this.loadTokens();
    if (existing?.accessToken && existing.expiresAt > Date.now() + 60_000) {
      return {
        ok: true,
        status: 'connected',
        accountEmail: existing.email,
      };
    }
    if (existing?.refreshToken) {
      const refreshed = await this.refreshAccessToken(existing.refreshToken);
      if (refreshed.ok) {
        return refreshed;
      }
    }

    return this.beginPkceLogin();
  }

  async disconnect(): Promise<void> {
    await Preferences.remove({ key: TOKEN_KEY });
    this.pendingVerifier = null;
  }

  async testConnection(): Promise<CalendarConnectResult> {
    const tokens = await this.ensureAccessToken();
    if (!tokens) {
      return { ok: false, status: 'expired' };
    }
    try {
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1',
        { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      );
      if (res.status === 401) {
        return { ok: false, status: 'expired' };
      }
      if (!res.ok) {
        return { ok: false, status: 'error', message: `Google API ${res.status}` };
      }
      return {
        ok: true,
        status: 'connected',
        accountEmail: tokens.email,
      };
    } catch (err) {
      return {
        ok: false,
        status: 'error',
        message: err instanceof Error ? err.message : 'Google Calendar unreachable.',
      };
    }
  }

  async refreshConnection(): Promise<CalendarConnectResult> {
    const tokens = await this.loadTokens();
    if (!tokens?.refreshToken) {
      return this.connect();
    }
    return this.refreshAccessToken(tokens.refreshToken);
  }

  async listCalendars(): Promise<ExternalCalendarInfo[]> {
    const tokens = await this.ensureAccessToken();
    if (!tokens) {
      return [];
    }
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer',
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
    );
    if (!res.ok) {
      throw new Error(`Could not list Google calendars (${res.status}).`);
    }
    const body = (await res.json()) as {
      items?: Array<{ id: string; summary?: string; primary?: boolean }>;
    };
    return (body.items ?? []).map((item) => ({
      id: item.id,
      name: item.summary || item.id,
      isPrimary: !!item.primary,
      allowsModifications: true,
    }));
  }

  async createRideEvent(
    calendarId: string | null,
    payload: RideCalendarEventPayload,
  ): Promise<CalendarWriteResult> {
    const tokens = await this.ensureAccessToken();
    if (!tokens) {
      return { ok: false, message: 'Google Calendar is not connected.' };
    }
    const content = buildCalendarEventContent(payload);
    const calId = encodeURIComponent(calendarId || 'primary');
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(this.toGoogleEventBody(content, payload)),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, message: `Google create failed (${res.status}): ${text}` };
      }
      const body = (await res.json()) as { id?: string };
      return {
        ok: true,
        externalEventId: body.id,
        externalCalendarId: calendarId || 'primary',
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error ? err.message : 'Failed to create Google Calendar event.',
      };
    }
  }

  async updateRideEvent(
    calendarId: string | null,
    externalEventId: string,
    payload: RideCalendarEventPayload,
  ): Promise<CalendarWriteResult> {
    const tokens = await this.ensureAccessToken();
    if (!tokens) {
      return { ok: false, message: 'Google Calendar is not connected.' };
    }
    const content = buildCalendarEventContent(payload);
    const calId = encodeURIComponent(calendarId || 'primary');
    const eventId = encodeURIComponent(externalEventId);
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(this.toGoogleEventBody(content, payload)),
        },
      );
      if (res.status === 404) {
        const created = await this.createRideEvent(calendarId, payload);
        return { ...created, recreated: created.ok };
      }
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, message: `Google update failed (${res.status}): ${text}` };
      }
      return {
        ok: true,
        externalEventId,
        externalCalendarId: calendarId || 'primary',
      };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error ? err.message : 'Failed to update Google Calendar event.',
      };
    }
  }

  async deleteRideEvent(
    calendarId: string | null,
    externalEventId: string,
  ): Promise<CalendarWriteResult> {
    const tokens = await this.ensureAccessToken();
    if (!tokens) {
      return { ok: true, message: 'Not connected; nothing to delete.' };
    }
    const calId = encodeURIComponent(calendarId || 'primary');
    const eventId = encodeURIComponent(externalEventId);
    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        },
      );
      if (res.status === 404 || res.status === 410 || res.ok) {
        return { ok: true, externalEventId };
      }
      return { ok: false, message: `Google delete failed (${res.status}).` };
    } catch {
      return { ok: true, externalEventId, message: 'Event already removed.' };
    }
  }

  private toGoogleEventBody(
    content: ReturnType<typeof buildCalendarEventContent>,
    payload: RideCalendarEventPayload,
  ) {
    return {
      summary: content.title,
      location: content.location,
      description: content.notes,
      start: {
        dateTime: new Date(content.startMs).toISOString(),
      },
      end: {
        dateTime: new Date(content.endMs).toISOString(),
      },
      source: {
        title: 'Ride Angels',
        url: payload.deepLink,
      },
    };
  }

  private async beginPkceLogin(): Promise<CalendarConnectResult> {
    const clientId = this.clientId();
    const redirectUri = this.redirectUri();
    const verifier = this.randomString(64);
    const challenge = await this.sha256Base64Url(verifier);
    this.pendingVerifier = verifier;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return new Promise((resolve) => {
      this.authResolver = resolve;
      const sub = App.addListener('appUrlOpen', (event) => {
        void this.handleRedirect(event.url).finally(() => {
          void sub.then((h) => h.remove());
        });
      });
      void Browser.open({ url: authUrl }).catch((err) => {
        this.authResolver = null;
        resolve({
          ok: false,
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not open browser.',
        });
      });
      // Safety timeout
      setTimeout(() => {
        if (this.authResolver === resolve) {
          this.authResolver = null;
          resolve({ ok: false, status: 'cancelled', message: 'Sign-in timed out.' });
        }
      }, 180_000);
    });
  }

  private async handleRedirect(url: string): Promise<void> {
    const redirect = this.redirectUri();
    if (!url.startsWith(redirect.split('?')[0])) {
      return;
    }
    await Browser.close().catch(() => undefined);
    const parsed = new URL(url.replace('org.rideangels.app://', 'https://callback/'));
    const code = parsed.searchParams.get('code');
    const error = parsed.searchParams.get('error');
    const resolve = this.authResolver;
    this.authResolver = null;
    if (!resolve) {
      return;
    }
    if (error || !code || !this.pendingVerifier) {
      resolve({
        ok: false,
        status: error === 'access_denied' ? 'cancelled' : 'error',
        message: error || 'Missing authorization code.',
      });
      return;
    }
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId(),
          code,
          code_verifier: this.pendingVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirect,
        }).toString(),
      });
      this.pendingVerifier = null;
      if (!tokenRes.ok) {
        resolve({
          ok: false,
          status: 'error',
          message: `Token exchange failed (${tokenRes.status}).`,
        });
        return;
      }
      const tokenBody = (await tokenRes.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };
      const email = await this.fetchEmail(tokenBody.access_token);
      await this.saveTokens({
        accessToken: tokenBody.access_token,
        refreshToken: tokenBody.refresh_token,
        expiresAt: Date.now() + tokenBody.expires_in * 1000,
        email,
      });
      resolve({ ok: true, status: 'connected', accountEmail: email });
    } catch (err) {
      resolve({
        ok: false,
        status: 'error',
        message: err instanceof Error ? err.message : 'OAuth failed.',
      });
    }
  }

  private async refreshAccessToken(
    refreshToken: string,
  ): Promise<CalendarConnectResult> {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId(),
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });
      if (!res.ok) {
        await this.disconnect();
        return { ok: false, status: 'expired', message: 'Google session expired.' };
      }
      const body = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };
      const prev = await this.loadTokens();
      await this.saveTokens({
        accessToken: body.access_token,
        refreshToken: prev?.refreshToken ?? refreshToken,
        expiresAt: Date.now() + body.expires_in * 1000,
        email: prev?.email,
      });
      return { ok: true, status: 'connected', accountEmail: prev?.email };
    } catch (err) {
      return {
        ok: false,
        status: 'error',
        message: err instanceof Error ? err.message : 'Token refresh failed.',
      };
    }
  }

  private async ensureAccessToken(): Promise<GoogleTokenBundle | null> {
    const tokens = await this.loadTokens();
    if (!tokens) {
      return null;
    }
    if (tokens.expiresAt > Date.now() + 60_000) {
      return tokens;
    }
    if (!tokens.refreshToken) {
      return null;
    }
    const refreshed = await this.refreshAccessToken(tokens.refreshToken);
    if (!refreshed.ok) {
      return null;
    }
    return this.loadTokens();
  }

  private async fetchEmail(accessToken: string): Promise<string | undefined> {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        return undefined;
      }
      const body = (await res.json()) as { email?: string };
      return body.email;
    } catch {
      return undefined;
    }
  }

  private clientId(): string {
    const cfg = environment.googleCalendar;
    if (Capacitor.getPlatform() === 'ios' && cfg?.iosClientId) {
      return cfg.iosClientId;
    }
    return cfg?.webClientId || cfg?.iosClientId || '';
  }

  private redirectUri(): string {
    return (
      environment.googleCalendar?.redirectUri ||
      'org.rideangels.app://google-calendar-oauth'
    );
  }

  private async loadTokens(): Promise<GoogleTokenBundle | null> {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as GoogleTokenBundle;
    } catch {
      return null;
    }
  }

  private async saveTokens(tokens: GoogleTokenBundle): Promise<void> {
    await Preferences.set({ key: TOKEN_KEY, value: JSON.stringify(tokens) });
  }

  private randomString(length: number): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
  }

  private async sha256Base64Url(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    let str = '';
    bytes.forEach((b) => {
      str += String.fromCharCode(b);
    });
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
