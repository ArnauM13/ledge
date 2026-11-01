import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { LineChart } from './line-chart';
import { LinePoint, LineSeries } from './line-chart.model';

const pt = (d: number, value: number, estimated = false): LinePoint => ({
  date: new Date(Date.UTC(2026, 9, d)),
  value,
  estimated,
});
const n = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

@Component({
  imports: [LineChart],
  template: `<ledge-line-chart [series]="series()" summary="Patrimoni net" />`,
})
class Host {
  readonly series = signal<LineSeries[]>([]);
}

class FakeResizeObserver {
  constructor(private readonly cb: ResizeObserverCallback) {}
  observe(): void {
    this.cb(
      [{ contentRect: { width: 600 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  disconnect(): void {
    /* noop */
  }
}

async function render(series: LineSeries[]) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.series.set(series);
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const household: LineSeries = {
  id: 'hh',
  label: 'Household',
  slot: 1,
  points: [pt(1, 100_000), pt(15, 120_000), pt(31, 130_000, true)],
};

describe('LineChart', () => {
  beforeEach(() => {
    globalThis.ResizeObserver =
      FakeResizeObserver as unknown as typeof ResizeObserver;
  });

  it('labels the end value of a single series, without a legend', async () => {
    const el = await render([household]);
    expect(el.querySelector('[data-testid="legend"]')).toBeNull();
    expect(n(el.querySelector('[data-testid="end-label"]')?.textContent)).toBe(
      '130.000,00 €',
    );
  });

  it('draws the estimated stretch dashed', async () => {
    const el = await render([household]);
    const dashed = el.querySelectorAll('path[data-estimated="true"]');
    expect(dashed).toHaveLength(1);
    expect(dashed[0].getAttribute('stroke-dasharray')).toBe('4 4');
  });

  it('shows a legend with every series for two series', async () => {
    const b: LineSeries = {
      id: 'b',
      label: 'B',
      slot: 2,
      points: [pt(1, 50_000)],
    };
    const el = await render([household, b]);
    expect(n(el.querySelector('[data-testid="legend"]')?.textContent)).toBe(
      'Household 130.000,00 € B 50.000,00 €',
    );
  });

  it('moves the crosshair with the keyboard and shows the values', async () => {
    const el = await render([household]);
    const group = el.querySelector('[role="group"]') as HTMLElement;
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await TestBed.inject(ApplicationRef).whenStable();
    const tooltip = n(el.querySelector('[data-testid="tooltip"]')?.textContent);
    expect(tooltip).toContain('15 d’oct. del 2026');
    expect(tooltip).toContain('120.000,00 €');

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await TestBed.inject(ApplicationRef).whenStable();
    expect(el.querySelector('[data-testid="tooltip"]')).toBeNull();
  });

  it('offers a table view, newest first, marking estimates', async () => {
    const el = await render([household]);
    const button = Array.from(el.querySelectorAll('button')).find(
      (b) => n(b.textContent) === 'Veure com a taula',
    );
    button?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    const rows = Array.from(
      el.querySelectorAll('[data-testid="chart-table"] tbody tr'),
    ).map((r) => n(r.textContent));
    expect(rows).toEqual([
      '31 d’oct. del 2026 130.000,00 € (estimat)',
      '15 d’oct. del 2026 120.000,00 €',
      '1 d’oct. del 2026 100.000,00 €',
    ]);
  });
});
