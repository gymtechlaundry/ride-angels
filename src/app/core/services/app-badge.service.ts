import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';

/**
 * Syncs the home-screen app icon badge with in-app unread notifications.
 * No-op on web.
 */
@Injectable({ providedIn: 'root' })
export class AppBadgeService {
  async setCount(count: number): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const next = Math.max(0, Math.floor(count));
    try {
      if (next <= 0) {
        await Badge.clear();
      } else {
        await Badge.set({ count: next });
      }
    } catch (err) {
      console.warn('[badge] set failed', err);
    }
  }

  async clear(): Promise<void> {
    await this.setCount(0);
  }
}
