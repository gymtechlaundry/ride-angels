import { Injectable, computed, inject, Injector, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import {
  AuthError,
  LinkedSignInMethod,
  User,
  UserRole,
} from '../models';
import { AuthIntent } from '../models/auth';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../supabase/supabase-client';
import { isAuthSessionFailure, mapAuthError } from '../utils/auth-errors';
import { mapDomainError } from '../infrastructure/supabase/mappers';
import { formatPhoneDisplay, normalizeEmail, toE164 } from '../utils/phone';
import { userHasPersonalCapability } from '../utils/personal-capability';
import { AuthFlowService } from './auth-flow.service';
import { UserProfileRepository } from './user-profile.repository';
import { MOCK_USERS } from '../mock/mock-data';

const KEYS = {
  activePersona: 'ra.activePersona',
  mockOtpPrefix: 'ra.mockOtp.',
  mockAccounts: 'ra.mockAuthAccounts',
} as const;

export type AppPersona = 'rider' | 'angel' | 'both';

/** Matches Supabase auth.signOut scopes. Default app behavior is local (this device). */
export type SignOutScope = 'local' | 'global' | 'others';

interface MockAuthAccount {
  authUserId: string;
  phone?: string;
  email?: string;
}

/**
 * Application auth facade.
 * Components must not call Supabase directly.
 *
 * Distinguishes REGISTER / SIGN_IN / ADD_IDENTITY.
 * Sign-in never creates users (shouldCreateUser: false).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly profiles = inject(UserProfileRepository);
  private readonly flow = inject(AuthFlowService);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);

  /** True while an intentional sign-out is in progress (skips auto redirect). */
  private signingOut = false;
  /** Prevents re-entrant expired-session handling. */
  private handlingExpiredSession = false;

  private readonly session = signal<Session | null>(null);
  private readonly persona = signal<AppPersona>('rider');
  private readonly ready = signal(false);
  /**
   * Known profiles for in-app lookups (invites, cards).
   * Live Supabase: only real synced users.
   * Mock auth: seeded demo directory for local UI demos.
   */
  private readonly directory = signal<User[]>([]);

  readonly currentUser = signal<User | null>(null);
  readonly isReady = this.ready.asReadonly();
  readonly activePersona = this.persona.asReadonly();
  readonly isAuthenticated = computed(
    () => !!this.session() && !!this.currentUser(),
  );
  readonly hasCompletedOnboarding = computed(
    () => !!this.currentUser()?.onboardingCompleted,
  );
  readonly usingMockAuth = computed(() => !isSupabaseConfigured());

  async initialize(): Promise<void> {
    await this.profiles.ensureReady();
    const { value: persona } = await Preferences.get({ key: KEYS.activePersona });
    this.persona.set(persona === 'angel' ? 'angel' : 'rider');

    if (isSupabaseConfigured()) {
      this.directory.set([]);
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Validate against the server so revoked/zombie sessions don't paint an empty shell.
        const { error: userError } = await supabase.auth.getUser();
        if (userError) {
          await this.handleExpiredSession();
        } else {
          await this.applySession(data.session);
        }
      }
      supabase.auth.onAuthStateChange((event, session) => {
        // Avoid redundant profile writes on token refresh.
        if (event === 'TOKEN_REFRESHED' && session?.user.id === this.session()?.user.id) {
          this.session.set(session);
          return;
        }
        void this.applySession(session);
      });
    } else {
      this.directory.set([...MOCK_USERS]);
      const { value } = await Preferences.get({ key: 'ra.mockSessionAuthUserId' });
      if (value) {
        const profile = await this.profiles.getByAuthUserId(value);
        if (profile) {
          this.currentUser.set(profile);
          this.session.set(this.mockSession(value));
          this.upsertDirectory(profile);
          if (profile.onboardingCompleted) {
            await this.applyDefaultPersona(profile);
          }
        }
      }
    }

    this.ready.set(true);
  }

  getCurrentUser(): User {
    const user = this.currentUser();
    if (!user) {
      throw new AuthError('You need to sign in first.', 'not_authenticated');
    }
    return user;
  }

  getCurrentUserOrNull(): User | null {
    return this.currentUser();
  }

  getSession(): Session | null {
    return this.session();
  }

  // —— REGISTER (createUser allowed) ——

  async registerWithPhone(rawPhone: string): Promise<void> {
    const phone = toE164(rawPhone, environment.defaultCountryCallingCode);
    await this.beginOtpChallenge('register', 'phone', phone);
  }

  async registerWithEmail(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    await this.beginOtpChallenge('register', 'email', email);
  }

  // —— SIGN IN (createUser disabled) ——

  async signInWithPhone(rawPhone: string): Promise<void> {
    const phone = toE164(rawPhone, environment.defaultCountryCallingCode);
    await this.beginOtpChallenge('sign_in', 'phone', phone);
  }

  async signInWithEmail(rawEmail: string): Promise<void> {
    const email = normalizeEmail(rawEmail);
    await this.beginOtpChallenge('sign_in', 'email', email);
  }

  async verifyPendingOtp(token: string): Promise<User> {
    const pending = this.flow.requirePending();
    try {
      if (pending.intent === 'add_identity') {
        return await this.verifyIdentityAddition(pending.channel, pending.identifier, token);
      }
      return await this.verifySignInOrRegister(pending, token);
    } catch (err) {
      throw mapAuthError(err, 'verify');
    }
  }

  async resendPendingOtp(): Promise<void> {
    const pending = this.flow.requirePending();
    await this.sendOtp(pending);
  }

  // —— ADD IDENTITY (authenticated updateUser) ——

  async addEmailToCurrentUser(rawEmail: string): Promise<void> {
    this.requireAuth();
    const email = normalizeEmail(rawEmail);
    this.flow.start('add_identity', 'email', email);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await getSupabaseClient().auth.updateUser({ email });
        if (error) {
          throw error;
        }
      } else {
        await this.mockSendOtp(email, 'email');
      }
    } catch (err) {
      this.flow.clear();
      throw mapAuthError(err, 'add_identity');
    }
  }

  async addPhoneToCurrentUser(rawPhone: string): Promise<void> {
    this.requireAuth();
    const phone = toE164(rawPhone, environment.defaultCountryCallingCode);
    this.flow.start('add_identity', 'phone', phone);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await getSupabaseClient().auth.updateUser({ phone });
        if (error) {
          throw error;
        }
      } else {
        await this.mockSendOtp(phone, 'phone');
      }
    } catch (err) {
      this.flow.clear();
      throw mapAuthError(err, 'add_identity');
    }
  }

  getLinkedSignInMethods(): LinkedSignInMethod[] {
    if (isSupabaseConfigured()) {
      const authUser = this.session()?.user;
      if (!authUser) {
        return this.emptyMethods();
      }
      return this.methodsFromSupabaseUser(authUser);
    }

    const profile = this.currentUser();
    if (!profile) {
      return this.emptyMethods();
    }
    return [
      {
        channel: 'phone',
        value: profile.phone ? formatPhoneDisplay(profile.phone) : null,
        status: profile.phone ? 'verified' : 'not_added',
        isPrimary: !!profile.phone,
      },
      {
        channel: 'email',
        value: profile.email ?? null,
        status: profile.email ? 'verified' : 'not_added',
        isPrimary: !profile.phone && !!profile.email,
      },
    ];
  }

  /**
   * Signs out. Defaults to **this device only** so phone + iPad can stay signed in.
   * Pass `{ scope: 'global' }` to revoke every session (lost phone / security).
   */
  async signOut(options?: { scope?: SignOutScope }): Promise<void> {
    const scope = options?.scope ?? 'local';
    this.flow.clear();
    this.signingOut = true;
    try {
      if (isSupabaseConfigured()) {
        await getSupabaseClient().auth.signOut({ scope });
      }
      await Preferences.remove({ key: 'ra.mockSessionAuthUserId' });
      await this.clearLocalAuthState();
    } finally {
      this.signingOut = false;
    }
  }

  /**
   * Clears a dead/revoked session and sends the user to sign-in.
   * Used when the UI would otherwise look signed-in with empty data.
   */
  async handleExpiredSession(): Promise<void> {
    if (this.handlingExpiredSession || this.signingOut) {
      return;
    }
    this.handlingExpiredSession = true;
    this.signingOut = true;
    try {
      if (isSupabaseConfigured()) {
        try {
          await getSupabaseClient().auth.signOut({ scope: 'local' });
        } catch {
          // Storage clear below is enough if the remote session is already gone.
        }
      }
      await Preferences.remove({ key: 'ra.mockSessionAuthUserId' });
      await this.clearLocalAuthState();
      if (!this.router.url.startsWith('/auth')) {
        await this.router.navigateByUrl('/auth', { replaceUrl: true });
      }
    } finally {
      this.signingOut = false;
      this.handlingExpiredSession = false;
    }
  }

  /** Permanently deletes the signed-in account and related personal data. */
  async deleteAccount(): Promise<void> {
    const user = this.getCurrentUser();

    if (isSupabaseConfigured()) {
      const { error } = await getSupabaseClient().rpc('delete_own_account');
      if (error) {
        throw mapDomainError(error.message);
      }
    } else {
      await this.profiles.deleteByAuthUserId(user.authUserId);
      const accounts = (await this.loadMockAccounts()).filter(
        (a) => a.authUserId !== user.authUserId,
      );
      await this.saveMockAccounts(accounts);
      this.directory.update((list) =>
        list.filter((u) => u.authUserId !== user.authUserId),
      );
    }

    try {
      await this.signOut();
    } catch {
      this.flow.clear();
      this.session.set(null);
      this.currentUser.set(null);
      await Preferences.remove({ key: 'ra.mockSessionAuthUserId' });
    }
  }

  async completeOnboarding(input: {
    firstName: string;
    lastName: string;
    defaultPersona: 'rider' | 'angel';
  }): Promise<void> {
    const user = this.getCurrentUser();
    // Both capabilities so Profile can switch modes after onboarding.
    const roles = new Set<UserRole>(['rider', 'rideAngel', ...user.roles]);

    const updated = await this.profiles.update(user.authUserId, {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      roles: Array.from(roles),
      onboardingCompleted: true,
      defaultPersona: input.defaultPersona,
    });
    this.currentUser.set(updated);
    this.upsertDirectory(updated);
    await this.applyDefaultPersona(updated);
  }

  /**
   * Temporary in-session mode switch. Default persona is restored on the next
   * sign-in / session apply.
   */
  async switchPersona(persona: AppPersona): Promise<void> {
    const next = persona === 'angel' ? 'angel' : 'rider';
    this.persona.set(next);
    await Preferences.set({ key: KEYS.activePersona, value: next });
  }

  /** Restore the user's configured default landing persona. */
  async applyDefaultPersona(user: User = this.getCurrentUser()): Promise<void> {
    if (!user.defaultPersona) {
      // Legacy profiles without a saved default keep the current device preference.
      return;
    }
    const next = user.defaultPersona === 'angel' ? 'angel' : 'rider';
    this.persona.set(next);
    await Preferences.set({ key: KEYS.activePersona, value: next });
  }

  /** Persist the landing persona used on each sign-in. */
  async setDefaultPersona(persona: 'rider' | 'angel'): Promise<User> {
    const user = this.getCurrentUser();
    const updated = await this.profiles.update(user.authUserId, {
      defaultPersona: persona,
    });
    this.currentUser.set(updated);
    this.upsertDirectory(updated);
    await this.applyDefaultPersona(updated);
    return updated;
  }

  async updateProfile(patch: {
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  }): Promise<User> {
    const user = this.getCurrentUser();
    const updated = await this.profiles.update(user.authUserId, {
      ...(patch.firstName !== undefined
        ? { firstName: patch.firstName.trim() }
        : {}),
      ...(patch.lastName !== undefined
        ? { lastName: patch.lastName.trim() }
        : {}),
      ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
    });
    this.currentUser.set(updated);
    this.upsertDirectory(updated);
    return updated;
  }

  async uploadAvatar(file: File): Promise<User> {
    const mime = file.type || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
      throw new Error('Use a JPEG, PNG, or WebP image.');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('Photo must be under 2 MB.');
    }
    return this.uploadAvatarBlob(file, mime);
  }

  /** Upload a camera/library capture provided as a data URL (Capacitor Camera). */
  async uploadAvatarFromDataUrl(dataUrl: string): Promise<User> {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(
      dataUrl.trim(),
    );
    if (!match) {
      throw new Error('Could not read that photo. Try again.');
    }
    const mime = match[1].toLowerCase();
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    if (bytes.byteLength > 2 * 1024 * 1024) {
      throw new Error('Photo must be under 2 MB.');
    }
    const blob = new Blob([bytes], { type: mime });
    return this.uploadAvatarBlob(blob, mime);
  }

  private async uploadAvatarBlob(blob: Blob, mime: string): Promise<User> {
    const user = this.getCurrentUser();

    if (!isSupabaseConfigured()) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Could not read image.'));
        reader.readAsDataURL(blob);
      });
      return this.updateProfile({ avatarUrl: dataUrl });
    }

    const ext =
      mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.authUserId}/avatar.${ext}`;
    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: mime });
    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const bust = `?t=${Date.now()}`;
    return this.updateProfile({ avatarUrl: `${data.publicUrl}${bust}` });
  }

  getUserById(id: string): User | undefined {
    return this.directory().find((u) => u.id === id || u.authUserId === id);
  }

  listUsers(): User[] {
    return this.directory();
  }

  /** Cache another profile for invites / board cards (never overwrites current user). */
  rememberUser(user: User): void {
    this.upsertDirectory(user);
  }

  hasRole(role: UserRole): boolean {
    const user = this.currentUser();
    if (!user) {
      return false;
    }
    if (role === 'both') {
      return (
        userHasPersonalCapability(user.roles, 'act_as_rider') &&
        userHasPersonalCapability(user.roles, 'act_as_ride_angel')
      );
    }
    if (role === 'rider') {
      return userHasPersonalCapability(user.roles, 'act_as_rider');
    }
    return userHasPersonalCapability(user.roles, 'act_as_ride_angel');
  }

  /** Product creator / discussion moderator. */
  isAppCreator(user: User | null = this.getCurrentUserOrNull()): boolean {
    if (!user) {
      return false;
    }
    if (user.isAppCreator) {
      return true;
    }
    const email = user.email?.trim().toLowerCase();
    if (!email) {
      return false;
    }
    return environment.appCreatorEmails.some(
      (e) => e.trim().toLowerCase() === email,
    );
  }

  /** Dev-only: mock OTP codes are fixed so UI can be exercised without SMS. */
  getMockOtpHint(): string | null {
    return isSupabaseConfigured() ? null : '123456';
  }

  // —— internals ——

  /**
   * Starts an OTP challenge only after the provider accepts the send.
   * Sign-in uses shouldCreateUser: false — unknown identifiers must not
   * create users or advance to the verify screen.
   */
  private async beginOtpChallenge(
    intent: AuthIntent,
    channel: 'phone' | 'email',
    identifier: string,
  ): Promise<void> {
    this.flow.clear();
    try {
      await this.sendOtp({ intent, channel, identifier });
      this.flow.start(intent, channel, identifier);
    } catch (err) {
      this.flow.clear();
      throw err;
    }
  }

  private async sendOtp(challenge: {
    intent: AuthIntent;
    channel: 'phone' | 'email';
    identifier: string;
  }): Promise<void> {
    try {
      if (!isSupabaseConfigured()) {
        if (challenge.intent === 'sign_in') {
          const exists = await this.mockAccountExists(
            challenge.channel,
            challenge.identifier,
          );
          if (!exists) {
            throw new AuthError(
              challenge.channel === 'phone'
                ? "We couldn't find a Ride Angels account using that phone number."
                : "We couldn't find a Ride Angels account using that email.",
              'unknown_account',
            );
          }
        }
        await this.mockSendOtp(challenge.identifier, challenge.channel);
        return;
      }

      const supabase = getSupabaseClient();
      // REGISTER may create. SIGN_IN must never create.
      const shouldCreateUser = challenge.intent === 'register';

      if (challenge.channel === 'phone') {
        const { error } = await supabase.auth.signInWithOtp({
          phone: challenge.identifier,
          options: { shouldCreateUser },
        });
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: challenge.identifier,
          options: { shouldCreateUser },
        });
        if (error) {
          throw error;
        }
      }
    } catch (err) {
      throw mapAuthError(
        err,
        challenge.intent === 'sign_in'
          ? 'sign_in'
          : challenge.intent === 'register'
            ? 'register'
            : 'add_identity',
        challenge.channel,
      );
    }
  }

  private async verifySignInOrRegister(
    pending: { intent: AuthIntent; channel: 'phone' | 'email'; identifier: string },
    token: string,
  ): Promise<User> {
    if (!isSupabaseConfigured()) {
      return this.mockVerify(pending, token);
    }

    const supabase = getSupabaseClient();
    const type = pending.channel === 'phone' ? 'sms' : 'email';
    const payload =
      pending.channel === 'phone'
        ? { phone: pending.identifier, token, type: type as 'sms' }
        : { email: pending.identifier, token, type: type as 'email' };

    const { data, error } = await supabase.auth.verifyOtp(payload);
    if (error) {
      throw error;
    }
    if (!data.session) {
      throw new AuthError('Verification failed. Try again.', 'invalid_otp');
    }

    try {
      await this.applySession(data.session);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Profile could not be loaded.';
      throw new AuthError(message, 'validation');
    }
    this.flow.clear();
    const user = this.currentUser();
    if (!user) {
      throw new AuthError('Profile could not be loaded.', 'validation');
    }
    return user;
  }

  private async verifyIdentityAddition(
    channel: 'phone' | 'email',
    identifier: string,
    token: string,
  ): Promise<User> {
    this.requireAuth();

    if (!isSupabaseConfigured()) {
      await this.mockConfirmOtp(identifier, token);
      const user = this.getCurrentUser();
      const patch =
        channel === 'phone' ? { phone: identifier } : { email: identifier };
      const updated = await this.profiles.update(user.authUserId, patch);
      this.currentUser.set(updated);
      await this.mockLinkIdentity(user.authUserId, channel, identifier);
      this.flow.clear();
      return updated;
    }

    const supabase = getSupabaseClient();
    const type = channel === 'phone' ? 'phone_change' : 'email_change';
    const payload =
      channel === 'phone'
        ? { phone: identifier, token, type: type as 'phone_change' }
        : { email: identifier, token, type: type as 'email_change' };

    const { data, error } = await supabase.auth.verifyOtp(payload);
    if (error) {
      throw error;
    }
    if (data.session) {
      await this.applySession(data.session);
    } else {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await this.syncProfileFromAuthUser(userData.user);
      }
    }
    this.flow.clear();
    return this.getCurrentUser();
  }

  private async applySession(session: Session | null): Promise<void> {
    const hadSession = !!this.session()?.user;
    this.session.set(session);
    if (!session?.user) {
      await this.clearLocalAuthState();
      if (!this.signingOut && hadSession && !this.router.url.startsWith('/auth')) {
        await this.router.navigateByUrl('/auth', { replaceUrl: true });
      }
      return;
    }
    try {
      const profile = await this.syncProfileFromAuthUser(session.user);
      // Restore configured default on fresh sign-in / cold start, not mid-session.
      if (profile.onboardingCompleted && !hadSession) {
        await this.applyDefaultPersona(profile);
      }
      await this.refreshDomainData();
    } catch (err) {
      if (isAuthSessionFailure(err)) {
        await this.handleExpiredSession();
        return;
      }
      // Session exists but profile/domain failed for a non-auth reason — do not
      // pretend the user is ready, but keep the session for retry.
      this.currentUser.set(null);
      throw err;
    }
  }

  private async clearLocalAuthState(): Promise<void> {
    this.session.set(null);
    this.currentUser.set(null);
    if (isSupabaseConfigured()) {
      this.directory.set([]);
    }
    try {
      const { DomainSyncService } = await import('./domain-sync.service');
      this.injector.get(DomainSyncService).clearLocal();
    } catch (err) {
      console.warn('[auth] domain clear skipped', err);
    }
  }

  private async refreshDomainData(): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }
    const { DomainSyncService } = await import('./domain-sync.service');
    await this.injector
      .get(DomainSyncService)
      .refreshForCurrentUser({ force: true });
    try {
      const { PushRegistrationService } = await import(
        './push-registration.service'
      );
      await this.injector.get(PushRegistrationService).prepare();
    } catch (err) {
      console.warn('[auth] push prepare skipped', err);
    }
  }

  private async syncProfileFromAuthUser(authUser: SupabaseUser): Promise<User> {
    const authUserId = authUser.id;
    const email = authUser.email || undefined;
    const phone = authUser.phone || undefined;

    let profile = await this.profiles.getByAuthUserId(authUserId);
    if (!profile) {
      // May already exist via DB trigger on auth.users insert.
      profile = await this.profiles.createForAuthUser({
        authUserId,
        email,
        phone,
      });
    } else if (email !== profile.email || phone !== profile.phone) {
      profile = await this.profiles.update(authUserId, {
        email: email ?? profile.email,
        phone: phone ?? profile.phone,
      });
    }

    this.currentUser.set(profile);
    this.upsertDirectory(profile);
    return profile;
  }

  private methodsFromSupabaseUser(user: SupabaseUser): LinkedSignInMethod[] {
    const phone = user.phone || null;
    const email = user.email || null;
    const phoneConfirmed = !!(user as { phone_confirmed_at?: string }).phone_confirmed_at || !!phone;
    const emailConfirmed = !!user.email_confirmed_at || !!email;

    return [
      {
        channel: 'phone',
        value: phone ? formatPhoneDisplay(phone) : null,
        status: phone ? (phoneConfirmed ? 'verified' : 'pending') : 'not_added',
        isPrimary: !!phone,
      },
      {
        channel: 'email',
        value: email,
        status: email ? (emailConfirmed ? 'verified' : 'pending') : 'not_added',
        isPrimary: !phone && !!email,
      },
    ];
  }

  private emptyMethods(): LinkedSignInMethod[] {
    return [
      { channel: 'phone', value: null, status: 'not_added', isPrimary: false },
      { channel: 'email', value: null, status: 'not_added', isPrimary: false },
    ];
  }

  private requireAuth(): void {
    if (!this.isAuthenticated()) {
      throw new AuthError('You need to sign in first.', 'not_authenticated');
    }
  }

  private upsertDirectory(user: User): void {
    this.directory.update((list) => {
      const without = list.filter(
        (u) => u.id !== user.id && u.authUserId !== user.authUserId,
      );
      return [...without, user];
    });
  }

  // —— Local mock OTP (UI / offline foundation only) ——

  private mockSession(authUserId: string): Session {
    return {
      access_token: `mock-${authUserId}`,
      refresh_token: 'mock',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: authUserId,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      } as SupabaseUser,
    } as Session;
  }

  private async mockSendOtp(identifier: string, _channel: 'phone' | 'email'): Promise<void> {
    await Preferences.set({
      key: `${KEYS.mockOtpPrefix}${identifier}`,
      value: '123456',
    });
  }

  private async mockConfirmOtp(identifier: string, token: string): Promise<void> {
    const { value } = await Preferences.get({
      key: `${KEYS.mockOtpPrefix}${identifier}`,
    });
    if (!value || value !== token) {
      throw new AuthError('That code is incorrect. Check it and try again.', 'invalid_otp');
    }
  }

  private async loadMockAccounts(): Promise<MockAuthAccount[]> {
    const { value } = await Preferences.get({ key: KEYS.mockAccounts });
    return value ? (JSON.parse(value) as MockAuthAccount[]) : [];
  }

  private async saveMockAccounts(accounts: MockAuthAccount[]): Promise<void> {
    await Preferences.set({
      key: KEYS.mockAccounts,
      value: JSON.stringify(accounts),
    });
  }

  private async mockAccountExists(
    channel: 'phone' | 'email',
    identifier: string,
  ): Promise<boolean> {
    const accounts = await this.loadMockAccounts();
    return accounts.some((a) =>
      channel === 'phone' ? a.phone === identifier : a.email === identifier,
    );
  }

  private async mockLinkIdentity(
    authUserId: string,
    channel: 'phone' | 'email',
    identifier: string,
  ): Promise<void> {
    const accounts = await this.loadMockAccounts();
    const taken = accounts.find(
      (a) =>
        a.authUserId !== authUserId &&
        (channel === 'phone' ? a.phone === identifier : a.email === identifier),
    );
    if (taken) {
      throw new AuthError(
        'That sign-in method is already associated with another account.',
        'identity_taken',
      );
    }
    const idx = accounts.findIndex((a) => a.authUserId === authUserId);
    if (idx >= 0) {
      accounts[idx] = {
        ...accounts[idx],
        ...(channel === 'phone' ? { phone: identifier } : { email: identifier }),
      };
    } else {
      accounts.push({
        authUserId,
        ...(channel === 'phone' ? { phone: identifier } : { email: identifier }),
      });
    }
    await this.saveMockAccounts(accounts);
  }

  private async mockVerify(
    pending: { intent: AuthIntent; channel: 'phone' | 'email'; identifier: string },
    token: string,
  ): Promise<User> {
    await this.mockConfirmOtp(pending.identifier, token);
    const accounts = await this.loadMockAccounts();

    if (pending.intent === 'sign_in') {
      const account = accounts.find((a) =>
        pending.channel === 'phone'
          ? a.phone === pending.identifier
          : a.email === pending.identifier,
      );
      if (!account) {
        throw new AuthError(
          pending.channel === 'phone'
            ? 'We couldn\'t find a Ride Angels account using that phone number.'
            : 'We couldn\'t find a Ride Angels account using that email.',
          'unknown_account',
        );
      }
      let profile = await this.profiles.getByAuthUserId(account.authUserId);
      if (!profile) {
        profile = await this.profiles.createForAuthUser({
          authUserId: account.authUserId,
          phone: account.phone,
          email: account.email,
        });
      }
      this.session.set(this.mockSession(account.authUserId));
      this.currentUser.set(profile);
      await Preferences.set({
        key: 'ra.mockSessionAuthUserId',
        value: account.authUserId,
      });
      this.upsertDirectory(profile);
      this.flow.clear();
      return profile;
    }

    // register
    const collision = accounts.find((a) =>
      pending.channel === 'phone'
        ? a.phone === pending.identifier
        : a.email === pending.identifier,
    );
    if (collision) {
      throw new AuthError(
        'An account with that sign-in method already exists. Try signing in instead.',
        'identity_taken',
      );
    }

    const authUserId = `mock-${Date.now()}`;
    const profile = await this.profiles.createForAuthUser({
      authUserId,
      phone: pending.channel === 'phone' ? pending.identifier : undefined,
      email: pending.channel === 'email' ? pending.identifier : undefined,
    });
    accounts.push({
      authUserId,
      phone: pending.channel === 'phone' ? pending.identifier : undefined,
      email: pending.channel === 'email' ? pending.identifier : undefined,
    });
    await this.saveMockAccounts(accounts);
    this.session.set(this.mockSession(authUserId));
    this.currentUser.set(profile);
    await Preferences.set({ key: 'ra.mockSessionAuthUserId', value: authUserId });
    this.upsertDirectory(profile);
    this.flow.clear();
    return profile;
  }
}
