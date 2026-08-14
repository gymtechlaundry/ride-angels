import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { User, UserRole } from '../models';
import { UserProfileRepositoryPort } from '../repositories/contracts';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../supabase/supabase-client';

const LOCAL_KEY = 'ra.profiles.byAuthUserId';

interface ProfileRow {
  id: string;
  auth_user_id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  roles: string[] | null;
  onboarding_completed: boolean;
  default_persona?: string | null;
  is_app_creator?: boolean | null;
  created_at: string;
  updated_at: string;
}

/**
 * Ride Angels profiles keyed ONLY by Supabase auth user id.
 * Live mode → public.profiles. Mock auth → Capacitor Preferences.
 * Never look up ownership by email/phone.
 */
@Injectable({ providedIn: 'root' })
export class UserProfileRepository implements UserProfileRepositoryPort {
  private localCache = new Map<string, User>();
  private localReady = false;

  async ensureReady(): Promise<void> {
    if (isSupabaseConfigured() || this.localReady) {
      return;
    }
    const { value } = await Preferences.get({ key: LOCAL_KEY });
    if (value) {
      const records = JSON.parse(value) as User[];
      this.localCache = new Map(records.map((u) => [u.authUserId, u]));
    }
    this.localReady = true;
  }

  async getByAuthUserId(authUserId: string): Promise<User | null> {
    if (!isSupabaseConfigured()) {
      await this.ensureReady();
      return this.localCache.get(authUserId) ?? null;
    }

    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) {
      throw this.mapDbError(error);
    }
    return data ? this.fromRow(data as ProfileRow) : null;
  }

  async createForAuthUser(input: {
    authUserId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }): Promise<User> {
    const existing = await this.getByAuthUserId(input.authUserId);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const firstName = input.firstName?.trim() || '';
    const lastName = input.lastName?.trim() || '';
    const displayName =
      [firstName, lastName].filter(Boolean).join(' ') || 'Ride Angels member';

    const profile: User = {
      id: input.authUserId,
      authUserId: input.authUserId,
      firstName,
      lastName,
      displayName,
      email: input.email,
      phone: input.phone,
      roles: [],
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now,
    };

    if (!isSupabaseConfigured()) {
      await this.ensureReady();
      this.localCache.set(input.authUserId, profile);
      await this.persistLocal();
      return profile;
    }

    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .insert(this.toRow(profile))
      .select('*')
      .single();

    if (error) {
      // Trigger or concurrent create won the race — load that row.
      if (error.code === '23505') {
        const raced = await this.getByAuthUserId(input.authUserId);
        if (raced) {
          return raced;
        }
      }
      throw this.mapDbError(error);
    }

    return this.fromRow(data as ProfileRow);
  }

  async deleteByAuthUserId(authUserId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      throw new Error('Use delete_own_account for live accounts.');
    }
    await this.ensureReady();
    this.localCache.delete(authUserId);
    await this.persistLocal();
  }

  async update(authUserId: string, patch: Partial<User>): Promise<User> {
    const current = await this.getByAuthUserId(authUserId);
    if (!current) {
      throw new Error('Profile not found.');
    }

    const updated: User = {
      ...current,
      ...patch,
      id: current.id,
      authUserId: current.authUserId,
      updatedAt: new Date().toISOString(),
    };
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      updated.displayName =
        [updated.firstName, updated.lastName].filter(Boolean).join(' ') ||
        updated.displayName;
    }

    if (!isSupabaseConfigured()) {
      await this.ensureReady();
      this.localCache.set(authUserId, updated);
      await this.persistLocal();
      return updated;
    }

    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update({
        first_name: updated.firstName,
        last_name: updated.lastName,
        display_name: updated.displayName,
        email: updated.email ?? null,
        phone: updated.phone ?? null,
        avatar_url: updated.avatarUrl ?? null,
        roles: updated.roles,
        onboarding_completed: !!updated.onboardingCompleted,
        default_persona: updated.defaultPersona ?? null,
      })
      .eq('auth_user_id', authUserId)
      .select('*')
      .single();

    if (error) {
      throw this.mapDbError(error);
    }
    return this.fromRow(data as ProfileRow);
  }

  async setRoles(authUserId: string, roles: UserRole[]): Promise<User> {
    return this.update(authUserId, { roles });
  }

  async markOnboardingComplete(authUserId: string): Promise<User> {
    return this.update(authUserId, { onboardingCompleted: true });
  }

  private toRow(profile: User): ProfileRow {
    return {
      id: profile.authUserId,
      auth_user_id: profile.authUserId,
      first_name: profile.firstName,
      last_name: profile.lastName,
      display_name: profile.displayName,
      email: profile.email ?? null,
      phone: profile.phone ?? null,
      avatar_url: profile.avatarUrl ?? null,
      roles: profile.roles,
      onboarding_completed: !!profile.onboardingCompleted,
      default_persona: profile.defaultPersona ?? null,
      is_app_creator: !!profile.isAppCreator,
      created_at: profile.createdAt ?? new Date().toISOString(),
      updated_at: profile.updatedAt ?? new Date().toISOString(),
    };
  }

  private fromRow(row: ProfileRow): User {
    const roles = (row.roles ?? []).filter(
      (r): r is UserRole =>
        r === 'rider' || r === 'rideAngel' || r === 'both',
    );
    const defaultPersona =
      row.default_persona === 'angel'
        ? 'angel'
        : row.default_persona === 'rider'
          ? 'rider'
          : undefined;
    return {
      id: row.id,
      authUserId: row.auth_user_id,
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      displayName: row.display_name || 'Ride Angels member',
      email: row.email ?? undefined,
      phone: row.phone ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      roles,
      onboardingCompleted: !!row.onboarding_completed,
      defaultPersona,
      isAppCreator: !!row.is_app_creator,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async persistLocal(): Promise<void> {
    await Preferences.set({
      key: LOCAL_KEY,
      value: JSON.stringify(Array.from(this.localCache.values())),
    });
  }

  private mapDbError(error: { message?: string; code?: string }): Error {
    const message = error.message ?? 'Profile storage error.';
    if (
      message.includes('Could not find the table') ||
      message.includes('schema cache') ||
      error.code === '42P01' ||
      error.code === 'PGRST205'
    ) {
      return new Error(
        'Profiles table is missing. Run supabase/migrations/20260811000000_profiles.sql in the Supabase SQL Editor.',
      );
    }
    return new Error(message);
  }
}
