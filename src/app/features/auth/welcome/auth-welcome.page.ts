import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-auth-welcome-page',
  standalone: true,
  imports: [IonContent, BrandLogoComponent, PrimaryButtonComponent],
  template: `
    <ion-content [fullscreen]="true" class="auth-content">
      <div class="auth-page auth-page--split welcome-page">
        <div class="auth-top">
          <div class="hero">
            <app-brand-logo variant="splash" maxWidth="280px" />
            <h1>Trusted rides with the people who care</h1>
            <p>
              Coordinate appointments, claim drives, and keep your circle connected.
            </p>
          </div>
        </div>

        <div class="auth-bottom">
          <div class="actions">
            <app-primary-button label="Create Account" (pressed)="goRegister()" />
            <app-primary-button
              label="Sign In"
              variant="soft"
              (pressed)="goSignIn()"
            />
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styleUrl: '../auth-shared.scss',
  styles: [
    `
      .welcome-page .hero h1 {
        font-size: 28px;
        max-width: 16ch;
      }

      .welcome-page .auth-bottom {
        justify-content: flex-end;
      }
    `,
  ],
})
export class AuthWelcomePage {
  private readonly router = inject(Router);

  goRegister(): void {
    void this.router.navigateByUrl('/auth/register/phone');
  }

  goSignIn(): void {
    void this.router.navigateByUrl('/auth/sign-in');
  }
}
