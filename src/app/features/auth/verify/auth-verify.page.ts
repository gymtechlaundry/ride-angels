import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthError } from '../../../core/models';
import { AuthFlowService } from '../../../core/services/auth-flow.service';
import { AuthService } from '../../../core/services/auth.service';
import { formatPhoneDisplay } from '../../../core/utils/phone';
import { OtpInputComponent } from '../../../shared/components/otp-input/otp-input.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-auth-verify-page',
  standalone: true,
  imports: [
    IonContent,
    PageHeaderComponent,
    PrimaryButtonComponent,
    OtpInputComponent,
  ],
  template: `
    <ion-content [fullscreen]="true" class="auth-content" [scrollY]="true">
      <div class="auth-page auth-page--form">
        <app-page-header
          [title]="title()"
          [showBack]="true"
          [embed]="true"
        />

        <div class="auth-form-middle">
          <app-otp-input
            [disabled]="busy()"
            (completed)="onComplete($event)"
            (changed)="code.set($event)"
          />

          @if (auth.getMockOtpHint(); as hint) {
            <p class="mock-hint">Dev mock code: {{ hint }}</p>
          }

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
        </div>

        <div class="auth-form-footer">
          <div class="cta-block">
            <div class="actions">
              <app-primary-button
                [label]="busy() ? 'Verifying…' : 'Verify'"
                [disabled]="busy() || code().length < 6"
                (pressed)="verify()"
              />
              <button
                type="button"
                class="text-link ra-reset"
                (click)="resend()"
                [disabled]="busy()"
              >
                Resend code
              </button>
            </div>
            <p class="cta-support">{{ subtitle() }}</p>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styleUrl: '../auth-shared.scss',
})
export class AuthVerifyPage {
  readonly auth = inject(AuthService);
  private readonly flow = inject(AuthFlowService);
  private readonly router = inject(Router);

  readonly code = signal('');
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly pending = this.flow.pending;

  readonly title = computed(() => {
    const p = this.pending();
    if (!p) {
      return 'Enter code';
    }
    if (p.intent === 'add_identity') {
      return p.channel === 'email' ? 'Verify email' : 'Verify phone';
    }
    return 'Enter verification code';
  });

  readonly subtitle = computed(() => {
    const p = this.pending();
    if (!p) {
      return 'Return to sign in and request a new code.';
    }
    const dest =
      p.channel === 'phone' ? formatPhoneDisplay(p.identifier) : p.identifier;
    return `We sent a 6-digit code to ${dest}.`;
  });

  constructor() {
    void this.ensureChallenge();
  }

  private async ensureChallenge(): Promise<void> {
    await this.flow.hydrate();
    if (!this.flow.pending()) {
      await this.router.navigateByUrl('/auth');
    }
  }

  onComplete(code: string): void {
    this.code.set(code);
    void this.verify();
  }

  async verify(): Promise<void> {
    if (this.code().length < 6 || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.flow.hydrate();
      const pending = this.flow.pending();
      if (!pending) {
        this.error.set('No verification in progress.');
        await this.router.navigateByUrl('/auth');
        return;
      }
      await this.auth.verifyPendingOtp(this.code());
      if (pending.intent === 'add_identity') {
        await this.router.navigateByUrl('/account/security', { replaceUrl: true });
        return;
      }
      if (!this.auth.hasCompletedOnboarding()) {
        await this.router.navigateByUrl('/onboarding', { replaceUrl: true });
        return;
      }
      await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
    } catch (err) {
      this.error.set(
        err instanceof AuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Verification failed.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  async resend(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.resendPendingOtp();
    } catch (err) {
      this.error.set(err instanceof AuthError ? err.message : 'Unable to resend.');
    } finally {
      this.busy.set(false);
    }
  }
}
