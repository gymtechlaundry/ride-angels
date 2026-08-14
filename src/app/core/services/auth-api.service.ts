import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  AuthAccountRecord,
  AuthError,
  AuthSession,
  SignInRequest,
  SignUpRequest,
  User,
} from '../models';
import { DEMO_PASSWORD, MOCK_USERS } from '../mock/mock-data';

const KEYS = {
  accounts: 'ra.auth.accounts',
  session: 'ra.auth.session',
} as const;

/**
 * Local stub auth API.
 * Swap this service for a real HTTP auth client later without changing UI.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private accounts: AuthAccountRecord[] = [];
  private seeded = false;

  async ensureReady(): Promise<void> {
    if (this.seeded) {
      return;
    }
    const { value } = await Preferences.get({ key: KEYS.accounts });
    if (value) {
      this.accounts = JSON.parse(value) as AuthAccountRecord[];
    } else {
      this.accounts = MOCK_USERS.filter((u) => !!u.email).map((user) => ({
        email: user.email!.toLowerCase(),
        password: DEMO_PASSWORD,
        user: { ...user },
      }));
      await this.persistAccounts();
    }
    this.seeded = true;
  }

  async signIn(request: SignInRequest): Promise<{ user: User; session: AuthSession }> {
    await this.ensureReady();
    const email = request.email.trim().toLowerCase();
    const account = this.accounts.find((a) => a.email === email);

    if (!account || account.password !== request.password) {
      throw new AuthError('Email or password is incorrect.', 'invalid_credentials');
    }

    const session = this.createSession(account.user.id);
    await this.persistSession(session);
    return { user: { ...account.user }, session };
  }

  async signUp(request: SignUpRequest): Promise<{ user: User; session: AuthSession }> {
    await this.ensureReady();
    const email = request.email.trim().toLowerCase();

    if (!email || !request.password || request.password.length < 6) {
      throw new AuthError('Enter a valid email and a password with at least 6 characters.');
    }
    if (!request.firstName.trim() || !request.lastName.trim()) {
      throw new AuthError('First and last name are required.');
    }
    if (this.accounts.some((a) => a.email === email)) {
      throw new AuthError('An account with that email already exists.', 'email_taken');
    }

    const firstName = request.firstName.trim();
    const lastName = request.lastName.trim();
    const id = `user-${Date.now()}`;
    const user: User = {
      id,
      authUserId: id,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,
      email,
      phone: request.phone?.trim() || undefined,
      roles: [],
    };

    this.accounts.push({
      email,
      password: request.password,
      user,
    });
    await this.persistAccounts();

    const session = this.createSession(user.id);
    await this.persistSession(session);
    return { user, session };
  }

  async getSession(): Promise<AuthSession | null> {
    const { value } = await Preferences.get({ key: KEYS.session });
    if (!value) {
      return null;
    }
    return JSON.parse(value) as AuthSession;
  }

  async getUserById(id: string): Promise<User | undefined> {
    await this.ensureReady();
    return this.accounts.find((a) => a.user.id === id)?.user;
  }

  async updateUser(user: User): Promise<User> {
    await this.ensureReady();
    const index = this.accounts.findIndex((a) => a.user.id === user.id);
    if (index < 0) {
      throw new AuthError('Account not found.', 'not_authenticated');
    }
    this.accounts[index] = {
      ...this.accounts[index],
      user: { ...user },
      email: (user.email ?? this.accounts[index].email).toLowerCase(),
    };
    await this.persistAccounts();
    return { ...user };
  }

  async clearSession(): Promise<void> {
    await Preferences.remove({ key: KEYS.session });
  }

  listDirectoryUsers(): User[] {
    return this.accounts.map((a) => ({ ...a.user }));
  }

  private createSession(userId: string): AuthSession {
    return {
      userId,
      accessToken: `mock-token-${userId}-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
  }

  private async persistAccounts(): Promise<void> {
    await Preferences.set({
      key: KEYS.accounts,
      value: JSON.stringify(this.accounts),
    });
  }

  private async persistSession(session: AuthSession): Promise<void> {
    await Preferences.set({
      key: KEYS.session,
      value: JSON.stringify(session),
    });
  }
}
