import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { appRoutes } from './app.routes';
import { NAV_ITEMS } from './navigation';

describe('App shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(appRoutes, withComponentInputBinding())],
    });
  });

  it('renders one nav link per section, in order', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('nav a'),
    ).map((a) => a.textContent?.trim());

    expect(links).toEqual(NAV_ITEMS.map((item) => item.label));
    expect(links).toHaveLength(9);
  });

  it('redirects / to Overview and shows the empty state', async () => {
    const harness = await RouterTestingHarness.create('/');
    const el = harness.routeNativeElement as HTMLElement;

    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Overview');
    expect(el.querySelector('[data-testid="empty-state"]')).not.toBeNull();
  });

  it('shows no figures in any section', async () => {
    const harness = await RouterTestingHarness.create();
    for (const item of NAV_ITEMS) {
      await harness.navigateByUrl(`/${item.path}`);
      const text =
        (harness.routeNativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain(item.label);
      expect(text).not.toMatch(/\d/);
    }
  });
});
