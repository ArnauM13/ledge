import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { AuthNextStep } from '@ledge/shared-types';
import { AuthService } from './auth.service';

const STEP_ROUTE: Record<AuthNextStep, string> = {
  totp: '/login/totp',
  'totp-setup': '/login/totp-setup',
};

/** Protected area: only with a full (password + TOTP) session. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const info = await auth.refresh();
  if (info.authenticated) {
    return true;
  }
  return router.parseUrl('stage' in info ? STEP_ROUTE[info.next] : '/login');
};

/** Login page: skip it when already signed in. */
export const loginGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const info = await auth.refresh();
  return info.authenticated ? inject(Router).parseUrl('/overview') : true;
};

/** TOTP pages: only right after the password step, and only the right one. */
export function stepGuard(step: AuthNextStep): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const info = await auth.refresh();
    if (info.authenticated) {
      return router.parseUrl('/overview');
    }
    if (!('stage' in info)) {
      return router.parseUrl('/login');
    }
    return info.next === step ? true : router.parseUrl(STEP_ROUTE[info.next]);
  };
}
