import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { NetWorthSeries } from '@ledge/shared-types';
import {
  ChartFrame,
  ChartState,
  formatDayLong,
  formatEur,
  formatEurSigned,
  LineChart,
  parseIsoDay,
} from '@ledge/web-charts';
import {
  headline,
  NET_WORTH_RANGES,
  NetWorthRange,
  NetWorthView,
  toLineSeries,
} from './net-worth';

const RANGE_LABEL: Record<NetWorthRange, string> = {
  '1M': 'darrer mes',
  '6M': 'darrers 6 mesos',
  '1A': 'darrer any',
  Tot: 'des del principi',
};

/** Chart G-1: net worth over time (docs/CHARTS.md §2). */
@Component({
  selector: 'ledge-net-worth-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartFrame, LineChart],
  template: `
    <ledge-chart-frame
      heading="Patrimoni net"
      [state]="frameState()"
      [stale]="data() !== null"
      (retry)="retry.emit()"
    >
      <div chartHeader class="t-flex t-flex-col t-gap-3">
        @if (summary(); as h) {
          <div>
            <p
              class="t-text-3xl t-font-semibold t-tracking-tight"
              data-testid="net-worth-current"
            >
              {{ formatEur(h.current) }}
            </p>
            <p class="t-mt-1 t-text-sm">
              <span
                class="t-font-medium t-tabular-nums"
                [class.t-text-positive]="h.change > 0"
                [class.t-text-negative]="h.change < 0"
                [class.t-text-content-muted]="h.change === 0"
                data-testid="net-worth-change"
                >{{ formatEurSigned(h.change) }}</span
              >
              <span class="t-text-content-subtle"> · {{ rangeLabel() }}</span>
            </p>
          </div>
        }
        <div class="t-flex t-flex-wrap t-items-center t-gap-2">
          <div
            class="t-flex t-rounded-md t-border t-border-line t-p-0.5"
            role="group"
            aria-label="Període"
          >
            @for (r of ranges; track r) {
              <button
                type="button"
                class="t-rounded t-px-2.5 t-py-1 t-text-xs focus-visible:t-outline focus-visible:t-outline-2 focus-visible:t-outline-content"
                [class.t-bg-surface-raised]="range() === r"
                [class.t-text-content]="range() === r"
                [class.t-text-content-muted]="range() !== r"
                [attr.aria-pressed]="range() === r"
                (click)="range.set(r)"
              >
                {{ r }}
              </button>
            }
          </div>
          <div
            class="t-flex t-rounded-md t-border t-border-line t-p-0.5"
            role="group"
            aria-label="Vista"
          >
            @for (v of views; track v.id) {
              <button
                type="button"
                class="t-rounded t-px-2.5 t-py-1 t-text-xs focus-visible:t-outline focus-visible:t-outline-2 focus-visible:t-outline-content"
                [class.t-bg-surface-raised]="view() === v.id"
                [class.t-text-content]="view() === v.id"
                [class.t-text-content-muted]="view() !== v.id"
                [attr.aria-pressed]="view() === v.id"
                (click)="view.set(v.id)"
              >
                {{ v.label }}
              </button>
            }
          </div>
        </div>
      </div>

      <ledge-line-chart [series]="series()" [summary]="ariaSummary()" />
    </ledge-chart-frame>
  `,
})
export class NetWorthCard {
  /** null = nothing loaded yet. */
  readonly data = input<NetWorthSeries | null>(null);
  readonly loading = input(false);
  readonly error = input(false);
  readonly retry = output<void>();

  protected readonly ranges = NET_WORTH_RANGES;
  protected readonly views: { id: NetWorthView; label: string }[] = [
    { id: 'household', label: 'Household' },
    { id: 'members', label: 'Per membre' },
  ];
  protected readonly range = signal<NetWorthRange>('1A');
  protected readonly view = signal<NetWorthView>('household');

  protected readonly frameState = computed<ChartState>(() => {
    if (this.error()) {
      return 'error';
    }
    if (this.loading()) {
      return 'loading';
    }
    const d = this.data();
    return d && d.points.length > 0 ? 'ready' : 'empty';
  });

  protected readonly series = computed(() => {
    const d = this.data();
    return d ? toLineSeries(d, this.view(), this.range()) : [];
  });

  /** Display numbers; the exact strings come from `headline()`. */
  protected readonly summary = computed(() => {
    const d = this.data();
    const h = d ? headline(d, this.range()) : null;
    return h
      ? {
          current: Number(h.current),
          change: Number(h.change),
          first: h.first,
          last: h.last,
        }
      : null;
  });

  protected readonly rangeLabel = computed(() => RANGE_LABEL[this.range()]);

  protected readonly ariaSummary = computed(() => {
    const h = this.summary();
    if (!h) {
      return 'Patrimoni net, sense dades';
    }
    return (
      `Patrimoni net, de ${formatEur(Number(h.first.total))} el ` +
      `${formatDayLong(parseIsoDay(h.first.date))} a ${formatEur(h.current)} el ` +
      `${formatDayLong(parseIsoDay(h.last.date))}`
    );
  });

  protected readonly formatEur = formatEur;
  protected readonly formatEurSigned = formatEurSigned;
}
