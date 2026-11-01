import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NetWorthSeries } from '@ledge/shared-types';
import { NetWorthCard } from './net-worth-card';

const n = (s: string | null | undefined) =>
  (s ?? '')
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const data: NetWorthSeries = {
  currency: 'EUR',
  members: [{ id: 'a', label: 'A' }],
  points: [
    {
      date: '2026-10-01',
      total: '131200.00',
      byMember: { a: '131200.00' },
      quality: 'REAL',
    },
    {
      date: '2026-10-31',
      total: '130000.00',
      byMember: { a: '130000.00' },
      quality: 'REAL',
    },
  ],
};

@Component({
  imports: [NetWorthCard],
  template: `<ledge-net-worth-card [data]="data()" [loading]="loading()" />`,
})
class Host {
  readonly data = signal<NetWorthSeries | null>(null);
  readonly loading = signal(false);
}

async function render(d: NetWorthSeries | null, loading = false) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.data.set(d);
  fixture.componentInstance.loading.set(loading);
  await fixture.whenStable();
  return fixture;
}

describe('NetWorthCard', () => {
  it('shows no figures without data', async () => {
    const el = (await render(null)).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Encara no hi ha dades');
    expect(el.textContent).not.toMatch(/\d/);
  });

  it('shows the current value and a signed, coloured loss', async () => {
    const el = (await render(data)).nativeElement as HTMLElement;
    expect(
      n(el.querySelector('[data-testid="net-worth-current"]')?.textContent),
    ).toBe('130.000,00 €');
    const change = el.querySelector('[data-testid="net-worth-change"]');
    expect(n(change?.textContent)).toBe('-1.200,00 €');
    expect(change?.classList).toContain('t-text-negative');
  });

  it('starts on the 1A range and switches with aria-pressed', async () => {
    const fixture = await render(data);
    const el = fixture.nativeElement as HTMLElement;
    const pressed = () =>
      Array.from(el.querySelectorAll('[aria-label="Període"] button'))
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => n(b.textContent));
    expect(pressed()).toEqual(['1A']);
    (
      Array.from(el.querySelectorAll('[aria-label="Període"] button')).find(
        (b) => n(b.textContent) === 'Tot',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(pressed()).toEqual(['Tot']);
  });
});
