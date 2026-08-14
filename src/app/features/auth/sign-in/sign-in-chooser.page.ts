import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { BrandLogoComponent } from '../../../shared/components/brand-logo/brand-logo.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-sign-in-chooser-page',
  standalone: true,
  imports: [
    IonContent,
    RouterLink,
    BrandLogoComponent,
    PrimaryButtonComponent,
  ],
  template: `
    <ion-content [fullscreen]="true" class="auth-content">
      <div class="auth-page auth-page--split">
        <button
          type="button"
          class="auth-back ra-reset"
          aria-label="Go back"
          (click)="goBack()"
        >
          <span class="ra-icon-box" style="width:16px;height:16px">
            <img class="ra-icon" src="assets/icons/chevron-left.svg" alt="" />
          </span>
        </button>

        <div class="auth-top">
          <div class="hero hero--mark">
            <app-brand-logo variant="splash" maxWidth="240px" />
          </div>
        </div>

        <div class="auth-bottom">
          <div class="cta-block">
            <div class="actions">
              <app-primary-button label="Continue with Phone" (pressed)="goPhone()" />
              <app-primary-button
                label="Continue with Email"
                variant="soft"
                (pressed)="goEmail()"
              />
            </div>
            <div class="link-row">
              <a routerLink="/auth/register/phone">Create a new account</a>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  `,
  styleUrl: '../auth-shared.scss',
})
export class SignInChooserPage {
  private readonly router = inject(Router);

  goBack(): void {
    void this.router.navigateByUrl('/auth');
  }

  goPhone(): void {
    void this.router.navigateByUrl('/auth/sign-in/phone');
  }

  goEmail(): void {
    void this.router.navigateByUrl('/auth/sign-in/email');
  }
}
