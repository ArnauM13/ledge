import { Route } from '@angular/router';

/**
 * Dev-only routes (chart gallery with TEST DATA, docs/CHARTS.md §7).
 * The production build swaps this file for dev-routes.prod.ts (fileReplacements
 * in apps/web/project.json), so the gallery and its fixtures never ship.
 */
export const DEV_ROUTES: Route[] = [
  {
    path: 'dev/charts',
    title: 'Gràfiques (dev) · ledge',
    loadComponent: () =>
      import('./charts-gallery').then((m) => m.ChartsGallery),
  },
];
