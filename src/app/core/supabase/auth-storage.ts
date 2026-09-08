import { Preferences } from '@capacitor/preferences';
import type { SupportedStorage } from '@supabase/supabase-js';

/**
 * Persist the Supabase session in Capacitor Preferences (iOS UserDefaults /
 * Android SharedPreferences) instead of WKWebView localStorage.
 *
 * Native WebViews often wipe localStorage when the app is killed or the
 * process is reclaimed, which forced users to OTP again. Preferences survive
 * that. localStorage is still read once so an existing store binary can upgrade
 * without an extra sign-in.
 */
export interface AuthKeyValueStore {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

export function createCapacitorAuthStorage(
  backend: AuthKeyValueStore = Preferences,
): SupportedStorage {
  const memory = new Map<string, string>();

  return {
    async getItem(key: string): Promise<string | null> {
      const cached = memory.get(key);
      if (cached !== undefined) {
        return cached;
      }

      const { value } = await backend.get({ key });
      if (value != null) {
        memory.set(key, value);
        return value;
      }

      const legacy = readLegacyLocalStorage(key);
      if (legacy != null) {
        memory.set(key, legacy);
        await backend.set({ key, value: legacy });
        return legacy;
      }

      return null;
    },

    async setItem(key: string, value: string): Promise<void> {
      memory.set(key, value);
      await backend.set({ key, value });
    },

    async removeItem(key: string): Promise<void> {
      memory.delete(key);
      await backend.remove({ key });
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // Private mode / missing localStorage.
      }
    },
  };
}

export const capacitorAuthStorage = createCapacitorAuthStorage();

function readLegacyLocalStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
