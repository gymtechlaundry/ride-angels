import { Routes } from '@angular/router';
import {
  appReadyGuard,
  authGuard,
  guestGuard,
  onboardingAccessGuard,
} from './core/guards/auth.guard';
import { otpChallengeGuard } from './core/guards/otp-challenge.guard';

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      {
        path: '',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/welcome/auth-welcome.page').then(
            (m) => m.AuthWelcomePage,
          ),
      },
      {
        path: 'register/phone',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/register/register-phone.page').then(
            (m) => m.RegisterPhonePage,
          ),
      },
      {
        path: 'register/email',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/register/register-email.page').then(
            (m) => m.RegisterEmailPage,
          ),
      },
      {
        path: 'sign-in',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/sign-in/sign-in-chooser.page').then(
            (m) => m.SignInChooserPage,
          ),
      },
      {
        path: 'sign-in/phone',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/sign-in/sign-in-phone.page').then(
            (m) => m.SignInPhonePage,
          ),
      },
      {
        path: 'sign-in/email',
        canActivate: [guestGuard],
        loadComponent: () =>
          import('./features/auth/sign-in/sign-in-email.page').then(
            (m) => m.SignInEmailPage,
          ),
      },
      {
        path: 'verify',
        canActivate: [otpChallengeGuard],
        loadComponent: () =>
          import('./features/auth/verify/auth-verify.page').then(
            (m) => m.AuthVerifyPage,
          ),
      },
    ],
  },
  {
    path: 'onboarding',
    canActivate: [onboardingAccessGuard],
    loadComponent: () =>
      import('./features/onboarding/onboarding.page').then((m) => m.OnboardingPage),
  },
  {
    path: 'account/security',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/account-security.page').then(
        (m) => m.AccountSecurityPage,
      ),
  },
  {
    path: 'account/notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/account/notification-settings.page').then(
        (m) => m.NotificationSettingsPage,
      ),
  },
  {
    path: '',
    canActivate: [appReadyGuard],
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: '**',
    redirectTo: 'auth',
  },
];
