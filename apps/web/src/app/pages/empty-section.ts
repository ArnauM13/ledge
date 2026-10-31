import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder for every section until real data exists.
 * Never shows figures: there is no data source connected yet.
 */
@Component({
  selector: 'ledge-empty-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="t-flex t-flex-col t-gap-6">
      <h1 class="t-text-2xl t-font-semibold t-tracking-tight">
        {{ section() }}
      </h1>
      <div
        class="t-rounded-xl t-border t-border-dashed t-border-line t-bg-surface t-px-6 t-py-16 t-text-center"
        data-testid="empty-state"
      >
        <p class="t-text-base t-font-medium t-text-content">No data yet</p>
        <p class="t-mt-2 t-text-sm t-text-content-muted">
          Nothing is connected or entered for this section.
        </p>
      </div>
    </section>
  `,
})
export class EmptySection {
  /** Bound from the route `data.section` (withComponentInputBinding). */
  readonly section = input.required<string>();
}
