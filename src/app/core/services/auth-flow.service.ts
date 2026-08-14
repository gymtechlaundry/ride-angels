import { Injectable, signal } from '@angular/core';
import {
  AuthChannel,
  AuthIntent,
  PendingAuthChallenge,
} from '../models/auth';

/**
 * Holds in-progress OTP challenge state across auth screens.
 * Cleared after successful verification or cancel.
 */
@Injectable({ providedIn: 'root' })
export class AuthFlowService {
  private readonly challenge = signal<PendingAuthChallenge | null>(null);

  readonly pending = this.challenge.asReadonly();

  start(intent: AuthIntent, channel: AuthChannel, identifier: string): void {
    this.challenge.set({ intent, channel, identifier });
  }

  clear(): void {
    this.challenge.set(null);
  }

  requirePending(): PendingAuthChallenge {
    const pending = this.challenge();
    if (!pending) {
      throw new Error('No verification in progress.');
    }
    return pending;
  }
}
