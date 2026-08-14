import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

async function ensureAuthReady(auth: AuthService): Promise<void> {
  if (!auth.isReady()) {
    await auth.initialize();
  }
}

/** Requires a signed-in session */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await ensureAuthReady(auth);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/auth']);
};

/** Signed-in users should not see guest auth screens */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await ensureAuthReady(auth);

  if (!auth.isAuthenticated()) {
    return true;
  }

  if (!auth.hasCompletedOnboarding()) {
    return router.createUrlTree(['/onboarding']);
  }
  return router.createUrlTree(['/tabs/home']);
};

/** Tabs require auth + completed onboarding */
export const appReadyGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await ensureAuthReady(auth);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth']);
  }
  if (!auth.hasCompletedOnboarding()) {
    return router.createUrlTree(['/onboarding']);
  }
  return true;
};

/** Onboarding only when signed in and not finished */
export const onboardingAccessGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await ensureAuthReady(auth);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth']);
  }
  if (auth.hasCompletedOnboarding()) {
    return router.createUrlTree(['/tabs/home']);
  }
  return true;
};
