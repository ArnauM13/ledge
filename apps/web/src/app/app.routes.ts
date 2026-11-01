import { Route } from '@angular/router';
import { authGuard, loginGuard, stepGuard } from './auth/auth.guards';
import { DEV_ROUTES } from './dev/dev-routes';
import { Shell } from './layout/shell';
import { NAV_ITEMS } from './navigation';

export const appRoutes: Route[] = [
  {
    path: 'login',
    title: 'Sign in · ledge',
    canActivate: [loginGuard],
    loadComponent: () =>
      import('./pages/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'login/totp',
    title: 'Two-factor authentication · ledge',
    canActivate: [stepGuard('totp')],
    loadComponent: () =>
      import('./pages/login/totp-page').then((m) => m.TotpPage),
  },
  {
    path: 'login/totp-setup',
    title: 'Set up two-factor authentication · ledge',
    canActivate: [stepGuard('totp-setup')],
    loadComponent: () =>
      import('./pages/login/totp-setup-page').then((m) => m.TotpSetupPage),
  },
  // Dev-only chart gallery with TEST DATA, outside the login so it works
  // without the API. Empty in production builds (docs/CHARTS.md §7).
  ...DEV_ROUTES,
  {
    // Everything else needs a full session (password + TOTP).
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      ...NAV_ITEMS.map((item): Route => ({
        path: item.path,
        title: `${item.label} · ledge`,
        data: { section: item.label },
        loadComponent: () =>
          import('./pages/empty-section').then((m) => m.EmptySection),
      })),
    ],
  },
  { path: '**', redirectTo: 'overview' },
];
