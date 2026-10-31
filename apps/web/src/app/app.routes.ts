import { Route } from '@angular/router';
import { NAV_ITEMS } from './navigation';

export const appRoutes: Route[] = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...NAV_ITEMS.map((item): Route => ({
    path: item.path,
    title: `${item.label} · ledge`,
    data: { section: item.label },
    loadComponent: () =>
      import('./pages/empty-section').then((m) => m.EmptySection),
  })),
  { path: '**', redirectTo: 'overview' },
];
