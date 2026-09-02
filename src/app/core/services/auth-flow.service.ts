import { Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  AuthChannel,
  AuthIntent,
  PendingAuthChallenge,
} from '../models/auth';

const STORAGE_KEY = 'ra.pendingAuthChallenge';
/** Align with typical OTP lifetime so a revived WebView doesn't keep a stale challenge forever. */
const MAX_AGE_MS = 15 * 60 * 1000;

interface StoredAuthChallenge extends PendingAuthChallenge {
  startedAt: number;
}

/**
 * Holds in-progress OTP challenge state across auth screens.
 * Persisted so iOS/iPad can leave for Messages/Mail and still verify
 * after the WebView is discarded under memory pressure (App Review 2.1).
 * Cleared after successful verification or cancel.
 */
@Injectable({ providedIn: 'root' })
export class AuthFlowService {
  private readonly challenge = signal<PendingAuthChallenge | null>(null);
  private hydratePromise: Promise<void> | null = null;

  readonly pending = this.challenge.asReadonly();

  /** Restore from device storage if the in-memory signal was wiped. */
  async hydrate(): Promise<void> {
    if (this.challenge()) {
      return;
    }
    if (!this.hydratePromise) {
      this.hydratePromise = this.readStored().finally(() => {
        this.hydratePromise = null;
      });
    }
    await this.hydratePromise;
  }

  async start(
    intent: AuthIntent,
    channel: AuthChannel,
    identifier: string,
  ): Promise<void> {
    const next: StoredAuthChallenge = {
      intent,
      channel,
      identifier,
      startedAt: Date.now(),
    };
    this.challenge.set({ intent, channel, identifier });
    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(next),
    });
  }

  async clear(): Promise<void> {
    this.challenge.set(null);
    await Preferences.remove({ key: STORAGE_KEY });
  }

  async requirePending(): Promise<PendingAuthChallenge> {
    await this.hydrate();
    const pending = this.challenge();
    if (!pending) {
      throw new Error('No verification in progress.');
    }
    return pending;
  }

  private async readStored(): Promise<void> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (!value) {
      return;
    }
    try {
      const parsed = JSON.parse(value) as Partial<StoredAuthChallenge>;
      const intent = parsed.intent;
      const channel = parsed.channel;
      const identifier = parsed.identifier;
      const startedAt = Number(parsed.startedAt);
      const validIntent =
        intent === 'register' ||
        intent === 'sign_in' ||
        intent === 'add_identity';
      const validChannel = channel === 'phone' || channel === 'email';
      if (
        !validIntent ||
        !validChannel ||
        typeof identifier !== 'string' ||
        !identifier.trim() ||
        !Number.isFinite(startedAt)
      ) {
        await Preferences.remove({ key: STORAGE_KEY });
        return;
      }
      if (Date.now() - startedAt > MAX_AGE_MS) {
        await Preferences.remove({ key: STORAGE_KEY });
        return;
      }
      this.challenge.set({ intent, channel, identifier: identifier.trim() });
    } catch {
      await Preferences.remove({ key: STORAGE_KEY });
    }
  }
}
