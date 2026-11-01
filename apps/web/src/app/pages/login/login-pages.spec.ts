import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { LoginPage } from './login-page';
import { TotpSetupPage } from './totp-setup-page';

function type(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('sign-in screens', () => {
  const auth = {
    csrfToken: signal<string | null>(null),
    login: vi.fn(),
    startTotpSetup: vi.fn(),
    confirmTotpSetup: vi.fn(),
    refresh: vi.fn(async () => ({ authenticated: false })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  it('login: sends the credentials and goes to the TOTP enrolment', async () => {
    auth.login.mockResolvedValue({ next: 'totp-setup', csrfToken: 'c' });
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    type(el, '#email', 'a@example.com');
    type(el, '#password', 'a long passphrase');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(auth.login).toHaveBeenCalledWith(
      'a@example.com',
      'a long passphrase',
    );
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith(
      '/login/totp-setup',
    );
  });

  it('login: shows a generic error and clears the password', async () => {
    auth.login.mockRejectedValue(new HttpErrorResponse({ status: 401 }));
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    type(el, '#email', 'a@example.com');
    type(el, '#password', 'wrong');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not sign in',
    );
    expect((el.querySelector('#password') as HTMLInputElement).value).toBe('');
  });

  it('TOTP enrolment: shows the QR, then the recovery codes once', async () => {
    auth.startTotpSetup.mockResolvedValue({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUrl: 'otpauth://totp/ledge:a?secret=JBSWY3DPEHPK3PXP',
      qrDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    auth.confirmTotpSetup.mockResolvedValue({
      csrfToken: 'c',
      user: { id: 'u', email: 'a@example.com', displayName: 'A' },
      recoveryCodes: ['AAAA-BBBB-CCCC-DDDD', 'EEEE-FFFF-GGGG-HHHH'],
    });
    const fixture = TestBed.createComponent(TotpSetupPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')?.getAttribute('src')).toBe(
      'data:image/png;base64,iVBORw0KGgo=',
    );

    type(el, '#code', '123456');
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(auth.confirmTotpSetup).toHaveBeenCalledWith('123456');
    const codes = el.querySelectorAll('[data-testid="recovery-codes"] li');
    expect(Array.from(codes).map((c) => c.textContent?.trim())).toEqual([
      'AAAA-BBBB-CCCC-DDDD',
      'EEEE-FFFF-GGGG-HHHH',
    ]);
    expect(el.querySelector('img')).toBeNull();

    (
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('saved'),
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="recovery-codes"]')).toBeNull();
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith(
      '/overview',
    );
  });
});
