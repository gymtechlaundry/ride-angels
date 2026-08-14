import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthError } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { DEMO_PASSWORD } from '../../core/mock/mock-data';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { PrimaryButtonComponent } from '../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-sign-in-page',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule, RouterLink, PrimaryButtonComponent, BrandLogoComponent],
  templateUrl: './sign-in.page.html',
  styleUrl: './sign-in.page.scss',
})
export class SignInPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly demoPassword = DEMO_PASSWORD;

  readonly form = this.fb.nonNullable.group({
    email: ['eleanor@rideangels.app', [Validators.required, Validators.email]],
    password: [DEMO_PASSWORD, [Validators.required, Validators.minLength(6)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Enter a valid email and password.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.auth.signIn(this.form.getRawValue());
      const target = this.auth.hasCompletedOnboarding()
        ? '/tabs/home'
        : '/onboarding';
      await this.router.navigateByUrl(target, { replaceUrl: true });
    } catch (err) {
      this.error.set(
        err instanceof AuthError ? err.message : 'Unable to sign in. Try again.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  fillDemo(email: string): void {
    this.form.patchValue({ email, password: DEMO_PASSWORD });
    this.error.set(null);
  }
}
