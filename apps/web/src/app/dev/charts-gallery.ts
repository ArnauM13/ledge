import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NetWorthCard } from '../charts/net-worth-card';
import { netWorthFixture } from './net-worth.fixture';

/**
 * Dev-only gallery (registered only when isDevMode()). Shows every chart and
 * state with TEST DATA. Spec: docs/CHARTS.md §1 and §7.
 */
@Component({
  selector: 'ledge-charts-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NetWorthCard],
  template: `
    <section class="t-flex t-flex-col t-gap-6">
      <h1 class="t-text-2xl t-font-semibold t-tracking-tight">
        Galeria de gràfiques
      </h1>
      <p
        class="t-rounded-md t-border t-border-line t-bg-surface-raised t-px-4 t-py-2 t-text-sm t-font-medium"
        role="note"
        data-testid="test-data-banner"
      >
        Dades de prova — només existeix al build de desenvolupament.
      </p>

      <h2 class="t-text-sm t-font-medium t-text-content-muted">
        G-1 · amb dades
      </h2>
      <ledge-net-worth-card [data]="fixture" />

      <h2 class="t-text-sm t-font-medium t-text-content-muted">G-1 · estats</h2>
      <div class="t-grid t-gap-6 lg:t-grid-cols-2">
        <ledge-net-worth-card />
        <ledge-net-worth-card [loading]="true" />
        <ledge-net-worth-card [data]="fixture" [loading]="true" />
        <ledge-net-worth-card [error]="true" />
      </div>
    </section>
  `,
})
export class ChartsGallery {
  protected readonly fixture = netWorthFixture();
}
