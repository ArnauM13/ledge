import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChartFrame } from './chart-frame';
import { ChartState } from './line-chart.model';

@Component({
  imports: [ChartFrame],
  template: `
    <ledge-chart-frame
      heading="Patrimoni net"
      [state]="state()"
      [stale]="stale()"
      (retry)="retries = retries + 1"
    >
      <p data-testid="content">chart</p>
    </ledge-chart-frame>
  `,
})
class Host {
  readonly state = signal<ChartState>('ready');
  readonly stale = signal(false);
  retries = 0;
}

async function render(state: ChartState, stale = false) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.state.set(state);
  fixture.componentInstance.stale.set(stale);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('ChartFrame', () => {
  it('shows the projected chart when ready', async () => {
    const { el } = await render('ready');
    expect(el.querySelector('h2')?.textContent?.trim()).toBe('Patrimoni net');
    expect(el.querySelector('[data-testid="content"]')).not.toBeNull();
  });

  it('shows an empty state with no figures', async () => {
    const { el } = await render('empty');
    expect(el.querySelector('[data-testid="content"]')).toBeNull();
    expect(el.textContent).toContain('Encara no hi ha dades');
    expect(el.textContent).not.toMatch(/\d/);
  });

  it('keeps the previous render dimmed while reloading', async () => {
    const { el } = await render('loading', true);
    const content = el.querySelector('[data-testid="content"]');
    expect(content?.parentElement?.classList).toContain('t-opacity-50');
    expect(el.querySelector('figure')?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows a loading message on first load', async () => {
    const { el } = await render('loading');
    expect(el.querySelector('[data-testid="content"]')).toBeNull();
    expect(el.textContent).toContain('Carregant');
  });

  it('emits retry from the error state', async () => {
    const { fixture, el } = await render('error');
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    el.querySelector('button')?.click();
    expect(fixture.componentInstance.retries).toBe(1);
  });
});
