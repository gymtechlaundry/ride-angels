import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthError } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { PrimaryButtonComponent } from '../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-sign-up-page',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule, RouterLink, PrimaryButtonComponent, BrandLogoComponent],
  templateUrl: './sign-up.page.html',
  styleUrl: './sign-up.page.scss',
})
export class SignUpPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.minLength(1)]],
    lastName: ['', [Validators.required, Validators.minLength(1)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Please complete all required fields.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.auth.signUp(this.form.getRawValue());
      await this.router.navigateByUrl('/onboarding', { replaceUrl: true });
    } catch (err) {
      this.error.set(
        err instanceof AuthError ? err.message : 'Unable to create your account.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
