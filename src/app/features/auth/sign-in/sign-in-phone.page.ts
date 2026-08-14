import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthError } from '../../../core/models';
import { AuthService } from '../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-sign-in-phone-page',
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
          title="Sign in with phone"
          [showBack]="true"
          [embed]="true"
        />

        <div class="auth-form-middle">
          <div class="field">
            <label for="phone">Mobile number</label>
            <input
              id="phone"
              type="tel"
              autocomplete="tel"
              placeholder="(912) 555-1234"
              [(ngModel)]="phone"
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
              We'll text a code only if this number already belongs to a Ride
              Angels account.
            </p>
          </div>

          <div class="link-row auth-form-links">
            <a routerLink="/auth/sign-in/email">Try email instead</a>
            <a routerLink="/auth/register/phone">Create a new account</a>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styleUrl: '../auth-shared.scss',
})
export class SignInPhonePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  phone = '';
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
      await this.auth.signInWithPhone(this.phone);
      await this.router.navigateByUrl('/auth/verify');
    } catch (err) {
      const message =
        err instanceof AuthError ? err.message : 'Unable to sign in.';
      this.error.set(message);
    } finally {
      this.busy.set(false);
    }
  }
}
