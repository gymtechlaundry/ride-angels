import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';
import { PrimaryButtonComponent } from '../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [IonContent, FormsModule, PrimaryButtonComponent, BrandLogoComponent],
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  firstName = this.auth.getCurrentUserOrNull()?.firstName ?? '';
  lastName = this.auth.getCurrentUserOrNull()?.lastName ?? '';
  readonly selected = signal<'rider' | 'angel'>('rider');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  select(persona: 'rider' | 'angel'): void {
    this.selected.set(persona);
  }

  async continue(): Promise<void> {
    if (!this.firstName.trim() || !this.lastName.trim()) {
      this.error.set('Please enter your first and last name.');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.auth.completeOnboarding({
        firstName: this.firstName,
        lastName: this.lastName,
        defaultPersona: this.selected(),
      });
      const methods = this.auth.getLinkedSignInMethods();
      const hasVerifiedEmail = methods.some(
        (m) => m.channel === 'email' && m.status === 'verified',
      );
      const hasVerifiedPhone = methods.some(
        (m) => m.channel === 'phone' && m.status === 'verified',
      );
      // Encourage a second sign-in method (email if phone-first, phone if email-first).
      if (!hasVerifiedEmail || !hasVerifiedPhone) {
        await this.router.navigate(['/account/security'], {
          replaceUrl: true,
          queryParams: { prompt: 'recovery' },
        });
        return;
      }
      await this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
    } finally {
      this.saving.set(false);
    }
  }
}
