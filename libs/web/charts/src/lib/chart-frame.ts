import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { ChartState } from './line-chart.model';

/**
 * Card around a chart: title, header slot and the empty / loading / error
 * states (docs/CHARTS.md §5). The chart itself is projected content.
 */
@Component({
  selector: 'ledge-chart-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 't-block' },
  template: `
    <figure
      class="t-m-0 t-rounded-xl t-border t-border-line t-bg-surface t-p-4 md:t-p-6"
      [attr.aria-busy]="state() === 'loading'"
    >
      <figcaption class="t-mb-4 t-flex t-flex-col t-gap-3">
        <h2 class="t-text-sm t-font-medium t-text-content-muted">
          {{ heading() }}
        </h2>
        @if (showContent()) {
          <ng-content select="[chartHeader]" />
        }
      </figcaption>

      @if (showContent()) {
        <div
          class="t-transition-opacity motion-reduce:t-transition-none"
          [class.t-opacity-50]="state() === 'loading'"
        >
          <ng-content />
        </div>
      } @else {
        <div
          class="t-flex t-flex-col t-items-center t-justify-center t-gap-3 t-text-center"
          [style.min-height.px]="minHeight()"
          [attr.data-testid]="'chart-' + state()"
        >
          @switch (state()) {
            @case ('loading') {
              <p class="t-text-sm t-text-content-subtle">Carregant…</p>
            }
            @case ('error') {
              <p class="t-text-sm t-text-content" role="alert">
                {{ errorMessage() }}
              </p>
              <button
                type="button"
                class="t-rounded-md t-border t-border-line t-px-3 t-py-1.5 t-text-sm t-text-content-muted hover:t-bg-surface-raised hover:t-text-content focus-visible:t-outline focus-visible:t-outline-2 focus-visible:t-outline-content"
                (click)="retry.emit()"
              >
                Torna-ho a provar
              </button>
            }
            @default {
              <p class="t-text-sm t-font-medium t-text-content">
                {{ emptyMessage() }}
              </p>
            }
          }
        </div>
      }
    </figure>
  `,
})
export class ChartFrame {
  readonly heading = input.required<string>();
  readonly state = input<ChartState>('ready');
  /** Loading with a previous render: keep it at 50% instead of a spinner. */
  readonly stale = input(false);
  readonly minHeight = input(240);
  readonly emptyMessage = input('Encara no hi ha dades');
  readonly errorMessage = input("No s'han pogut carregar les dades");
  readonly retry = output<void>();

  protected readonly showContent = computed(
    () =>
      this.state() === 'ready' || (this.state() === 'loading' && this.stale()),
  );
}
