import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthFlowService } from '../services/auth-flow.service';
import { AuthService } from '../services/auth.service';

/** OTP verify is allowed for guests (register/sign-in) and authenticated add-identity. */
export const otpChallengeGuard: CanActivateFn = async () => {
  const flow = inject(AuthFlowService);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isReady()) {
    await auth.initialize();
  } else {
    await flow.hydrate();
  }

  if (flow.pending()) {
    return true;
  }

  if (auth.isAuthenticated()) {
    return router.createUrlTree(['/account/security']);
  }
  return router.createUrlTree(['/auth']);
};
