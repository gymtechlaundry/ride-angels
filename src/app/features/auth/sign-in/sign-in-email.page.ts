import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthError } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-sign-in-email-page',
  standalone: true,
  imports: [
    IonContent,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    PrimaryButtonComponent,
  ],
  template: `
    <ion-content [fullscreen]="true" class="auth-content" [scrollY]="true">
      <div class="auth-page auth-page--form">
        <app-page-header
          title="Sign in with email"
          [showBack]="true"
          [embed]="true"
        />

        <div class="auth-form-middle">
          <div class="field">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              autocomplete="email"
              placeholder="you@example.com"
              [(ngModel)]="email"
              (focus)="onFieldFocus($event)"
            />
          </div>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
        </div>

        <div class="auth-form-footer">
          <div class="cta-block">
            <div class="actions">
              <app-primary-button
                [label]="busy() ? 'Checking…' : 'Continue'"
                [disabled]="busy()"
                (pressed)="submit()"
              />
            </div>
            <p class="cta-support">
              Use an email already on your Ride Angels account. Signing in never
              creates a new profile.
            </p>
          </div>

          <div class="link-row auth-form-links">
            <a routerLink="/auth/sign-in/phone">Try phone instead</a>
            <a routerLink="/auth/register/phone">Create a new account</a>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styleUrl: '../auth-shared.scss',
})
export class SignInEmailPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  onFieldFocus(event: FocusEvent): void {
    const el = event.target;
    if (!(el instanceof HTMLElement)) {
      return;
    }
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 80);
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.signInWithEmail(this.email);
      await this.router.navigateByUrl('/auth/verify');
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : "We couldn't sign you in using that email.";
      this.error.set(message);
    } finally {
      this.busy.set(false);
    }
  }
}
