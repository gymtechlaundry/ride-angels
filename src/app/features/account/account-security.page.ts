import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AlertController,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import { map } from 'rxjs/operators';
import { AuthError } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../shared/components/primary-button/primary-button.component';
import { confirmAndDeleteAccount } from './confirm-delete-account';

@Component({
  selector: 'app-account-security-page',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    FormsModule,
    PageHeaderComponent,
    PrimaryButtonComponent,
  ],
  templateUrl: './account-security.page.html',
  styleUrl: './account-security.page.scss',
})
export class AccountSecurityPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);

  private readonly promptRecovery = toSignal(
    this.route.queryParamMap.pipe(map((q) => q.get('prompt') === 'recovery')),
    {
      initialValue:
        this.route.snapshot.queryParamMap.get('prompt') === 'recovery',
    },
  );

  readonly methods = computed(() => {
    void this.auth.currentUser();
    return this.auth.getLinkedSignInMethods();
  });

  readonly missingEmail = computed(() =>
    this.methods().some((m) => m.channel === 'email' && m.status === 'not_added'),
  );
  readonly missingPhone = computed(() =>
    this.methods().some((m) => m.channel === 'phone' && m.status === 'not_added'),
  );

  /** Post-onboarding recovery nudge when a second sign-in method is missing. */
  readonly showRecoveryPrompt = computed(
    () =>
      !!this.promptRecovery() &&
      (this.missingEmail() || this.missingPhone()) &&
      !this.adding(),
  );

  readonly recoveryTitle = computed(() => {
    if (this.missingEmail() && !this.missingPhone()) {
      return 'Add an email for backup sign-in';
    }
    if (this.missingPhone() && !this.missingEmail()) {
      return 'Add a phone number for backup sign-in';
    }
    return 'Add a backup sign-in method';
  });

  readonly recoveryBody = computed(() => {
    if (this.missingEmail() && !this.missingPhone()) {
      return 'You joined with your phone. Adding a verified email gives you another way to sign in if you change numbers or lose access to SMS.';
    }
    if (this.missingPhone() && !this.missingEmail()) {
      return 'You joined with email. Adding a verified phone number makes it easier to sign in on this device later.';
    }
    return 'Add another verified method so you can always reach this same Ride Angels account.';
  });

  readonly recoveryActionLabel = computed(() => {
    if (this.missingEmail() && !this.missingPhone()) {
      return 'Add email';
    }
    if (this.missingPhone() && !this.missingEmail()) {
      return 'Add phone number';
    }
    return 'Choose a method below';
  });

  readonly recoveryChannel = computed<'email' | 'phone' | null>(() => {
    if (this.missingEmail() && !this.missingPhone()) {
      return 'email';
    }
    if (this.missingPhone() && !this.missingEmail()) {
      return 'phone';
    }
    return null;
  });

  readonly adding = signal<'phone' | 'email' | null>(null);
  readonly value = signal('');
  readonly busy = signal(false);
  readonly deleting = signal(false);
  readonly signingOutEverywhere = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const change = this.route.snapshot.queryParamMap.get('change');
    if (change === 'phone' || change === 'email') {
      this.startAdd(change);
    }
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await Promise.resolve();
    } finally {
      event.target.complete();
    }
  }

  startAdd(channel: 'phone' | 'email'): void {
    this.adding.set(channel);
    this.value.set('');
    this.error.set(null);
  }

  startRecoveryAdd(): void {
    const channel = this.recoveryChannel();
    if (channel) {
      this.startAdd(channel);
    }
  }

  cancelAdd(): void {
    this.adding.set(null);
    this.value.set('');
    this.error.set(null);
  }

  async skipForNow(): Promise<void> {
    await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
  }

  async submitAdd(): Promise<void> {
    const channel = this.adding();
    if (!channel) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      if (channel === 'email') {
        await this.auth.addEmailToCurrentUser(this.value());
      } else {
        await this.auth.addPhoneToCurrentUser(this.value());
      }
      await this.router.navigateByUrl('/auth/verify');
    } catch (err) {
      this.error.set(
        err instanceof AuthError
          ? err.message
          : 'Unable to update sign-in methods.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  panelTitle(channel: 'phone' | 'email'): string {
    const method = this.methods().find((m) => m.channel === channel);
    const changing = !!method && method.status !== 'not_added';
    if (channel === 'email') {
      return changing ? 'Change your email' : 'Verify your email';
    }
    return changing ? 'Change your phone' : 'Verify your phone';
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending verification';
      default:
        return 'Not added';
    }
  }

  async deleteAccount(): Promise<void> {
    this.deleting.set(true);
    try {
      await confirmAndDeleteAccount(this.alert, this.toast, this.auth, this.router);
    } finally {
      this.deleting.set(false);
    }
  }

  async signOutEverywhere(): Promise<void> {
    const confirm = await this.alert.create({
      header: 'Sign out all devices?',
      message:
        'This ends every Ride Angels session for your account, including this one. You’ll need to sign in again on each device.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Sign out everywhere', role: 'destructive' },
      ],
    });
    await confirm.present();
    const result = await confirm.onDidDismiss();
    if (result.role !== 'destructive') {
      return;
    }

    this.signingOutEverywhere.set(true);
    try {
      await this.auth.signOut({ scope: 'global' });
      await this.router.navigateByUrl('/auth', { replaceUrl: true });
      const toast = await this.toast.create({
        message: 'Signed out of all devices.',
        duration: 2200,
        position: 'top',
      });
      await toast.present();
    } catch (err) {
      const toast = await this.toast.create({
        message:
          err instanceof Error
            ? err.message
            : 'Could not sign out of all devices. Try again.',
        duration: 2800,
        position: 'top',
        color: 'danger',
      });
      await toast.present();
    } finally {
      this.signingOutEverywhere.set(false);
    }
  }
}
