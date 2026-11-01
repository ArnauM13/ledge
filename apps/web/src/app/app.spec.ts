import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { SessionInfo } from '@ledge/shared-types';
import { appRoutes } from './app.routes';
import { AuthService } from './auth/auth.service';
import { NAV_ITEMS } from './navigation';

const AUTHENTICATED: SessionInfo = {
  authenticated: true,
  stage: 'AUTHENTICATED',
  csrfToken: 'csrf',
  user: { id: 'u1', email: 'a@example.com', displayName: 'Member A' },
  households: [],
};

function fakeAuth(info: SessionInfo) {
  const session = signal<SessionInfo | null>(info);
  return {
    session,
    csrfToken: signal<string | null>(null),
    user: () => (info.authenticated ? info.user : null),
    isAuthenticated: () => info.authenticated,
    refresh: vi.fn(async () => info),
    logout: vi.fn(async () => undefined),
  };
}

function setup(info: SessionInfo) {
  const auth = fakeAuth(info);
  TestBed.configureTestingModule({
    providers: [
      provideRouter(appRoutes, withComponentInputBinding()),
      { provide: AuthService, useValue: auth },
    ],
  });
  return auth;
}

describe('App routing and shell', () => {
  it('signed in: renders one nav link per section, in order, and the user', async () => {
    setup(AUTHENTICATED);
    const harness = await RouterTestingHarness.create('/');
    const root = harness.fixture.nativeElement as HTMLElement;
    const links = Array.from(root.querySelectorAll('nav a')).map((a) =>
      a.textContent?.trim(),
    );
    expect(links).toEqual(NAV_ITEMS.map((item) => item.label));
    expect(links).toHaveLength(9);
    expect(
      root.querySelector('[data-testid="user-name"]')?.textContent,
    ).toContain('Member A');
  });

  it('signed in: redirects / to Overview and shows the empty state', async () => {
    setup(AUTHENTICATED);
    const harness = await RouterTestingHarness.create('/');
    const el = harness.routeNativeElement as HTMLElement;
    expect(TestBed.inject(Router).url).toBe('/overview');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Overview');
    expect(el.querySelector('[data-testid="empty-state"]')).not.toBeNull();
  });

  it('signed in: shows no figures in any section', async () => {
    setup(AUTHENTICATED);
    const harness = await RouterTestingHarness.create();
    for (const item of NAV_ITEMS) {
      await harness.navigateByUrl(`/${item.path}`);
      const text =
        (harness.routeNativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain(item.label);
      expect(text).not.toMatch(/\d/);
    }
  });

  it('signed out: every protected page redirects to the login', async () => {
    setup({ authenticated: false });
    const harness = await RouterTestingHarness.create();
    for (const path of ['/overview', '/settings', '/']) {
      await harness.navigateByUrl(path);
      expect(TestBed.inject(Router).url).toBe('/login');
    }
    expect(
      (harness.fixture.nativeElement as HTMLElement).querySelector('nav'),
    ).toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('input[type="password"]'),
    ).not.toBeNull();
  });

  it('password only: protected pages go to the TOTP step, not inside', async () => {
    setup({
      authenticated: false,
      stage: 'PASSWORD_VERIFIED',
      next: 'totp',
      csrfToken: 'c',
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/overview');
    expect(TestBed.inject(Router).url).toBe('/login/totp');
    await harness.navigateByUrl('/login/totp-setup');
    expect(TestBed.inject(Router).url).toBe('/login/totp');
  });

  it('password only, first login: goes to the mandatory TOTP enrolment', async () => {
    setup({
      authenticated: false,
      stage: 'PASSWORD_VERIFIED',
      next: 'totp-setup',
      csrfToken: 'c',
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/overview');
    expect(TestBed.inject(Router).url).toBe('/login/totp-setup');
  });

  it('sign out calls the API and returns to the login', async () => {
    const auth = setup(AUTHENTICATED);
    const harness = await RouterTestingHarness.create('/overview');
    const button = Array.from(
      (harness.fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((b) => b.textContent?.includes('Sign out')) as HTMLButtonElement;
    auth.refresh.mockResolvedValue({ authenticated: false });
    button.click();
    await harness.fixture.whenStable();
    expect(auth.logout).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/login');
  });
});
