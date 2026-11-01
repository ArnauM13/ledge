import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { formatDayLong, formatEur } from './format';
import { buildLineGeometry, nearestIndex } from './line-chart.geometry';
import { LineSeries, SeriesSlot } from './line-chart.model';

interface ActiveRow {
  id: string;
  label: string;
  slot: SeriesSlot;
  value: number;
  estimated: boolean;
}

/**
 * Line chart (1–5 series, one y-axis). SVG drawn by Angular; d3 only computes
 * scales and paths. Hover / ← → move a crosshair; a table view is always
 * available. Spec: docs/CHARTS.md (G-1, §4, §6).
 */
@Component({
  selector: 'ledge-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 't-block' },
  templateUrl: './line-chart.html',
})
export class LineChart {
  readonly series = input.required<LineSeries[]>();
  /** Accessible summary, e.g. "Patrimoni net, de … a …". */
  readonly summary = input.required<string>();
  readonly height = input(240);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly width = signal(0);
  protected readonly active = signal<number | null>(null);
  protected readonly showTable = signal(false);

  /** Per series: time → point, so lookups by date are O(1). */
  private readonly byTime = computed(() =>
    this.series().map(
      (s) => new Map(s.points.map((p) => [p.date.getTime(), p] as const)),
    ),
  );

  protected readonly geometry = computed(() =>
    buildLineGeometry(this.series(), {
      width: this.width(),
      height: this.height(),
    }),
  );

  protected readonly activeX = computed(() => {
    const g = this.geometry();
    const i = this.active();
    return g && i !== null ? g.xs[i] : null;
  });

  protected readonly activeDate = computed(() => {
    const g = this.geometry();
    const i = this.active();
    return g && i !== null ? g.dates[i] : null;
  });

  protected readonly activeRows = computed<ActiveRow[]>(() => {
    const date = this.activeDate();
    if (!date) {
      return [];
    }
    return this.rowsAt(date.getTime());
  });

  /** Table rows: every date, newest first. */
  protected readonly tableRows = computed(() => {
    const g = this.geometry();
    if (!g) {
      return [];
    }
    return [...g.dates].reverse().map((date) => ({
      date,
      cells: this.byTime().map((m) => m.get(date.getTime())),
    }));
  });

  protected readonly formatEur = formatEur;
  protected readonly formatDayLong = formatDayLong;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      this.width.set(el.clientWidth);
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const ro = new ResizeObserver((entries) => {
        this.width.set(Math.floor(entries[0].contentRect.width));
      });
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  protected color(slot: SeriesSlot): string {
    return `rgb(var(--ledge-series-${slot}))`;
  }

  protected onPointerMove(event: PointerEvent): void {
    const g = this.geometry();
    const svg = event.currentTarget as SVGElement | null;
    if (!g || !svg) {
      return;
    }
    const x = event.clientX - svg.getBoundingClientRect().left;
    this.active.set(nearestIndex(g.xs, x));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const g = this.geometry();
    if (!g) {
      return;
    }
    const lastIndex = g.dates.length - 1;
    const current = this.active() ?? lastIndex;
    const next: Record<string, number | null> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(lastIndex, current + 1),
      Home: 0,
      End: lastIndex,
      Escape: null,
    };
    if (event.key in next) {
      event.preventDefault();
      this.active.set(next[event.key]);
    }
  }

  protected tooltipLeft(x: number): string {
    return x > this.width() / 2 ? `calc(${x}px - 12px)` : `calc(${x}px + 12px)`;
  }

  protected tooltipShift(x: number): string {
    return x > this.width() / 2 ? 'translateX(-100%)' : 'none';
  }

  private rowsAt(time: number): ActiveRow[] {
    const maps = this.byTime();
    return this.series().flatMap((s, i) => {
      const p = maps[i].get(time);
      return p
        ? [
            {
              id: s.id,
              label: s.label,
              slot: s.slot,
              value: p.value,
              estimated: p.estimated,
            },
          ]
        : [];
    });
  }
}
