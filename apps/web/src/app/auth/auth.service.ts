import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import type {
  AuthenticatedResponse,
  LoginResponse,
  SessionInfo,
  TotpSetupResponse,
} from '@ledge/shared-types';
import { firstValueFrom } from 'rxjs';

/**
 * Client side of the session. The session itself lives in an HttpOnly cookie
 * the app cannot read; this service only keeps what the API returns: the
 * stage, the user and the CSRF token for state-changing requests.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly session = signal<SessionInfo | null>(null);
  readonly csrfToken = signal<string | null>(null);

  readonly isAuthenticated = computed(
    () => this.session()?.authenticated === true,
  );
  readonly user = computed(() => {
    const s = this.session();
    return s?.authenticated ? s.user : null;
  });

  /** Asks the API for the current session (the cookie is sent automatically). */
  async refresh(): Promise<SessionInfo> {
    let info: SessionInfo;
    try {
      info = await firstValueFrom(
        this.http.get<SessionInfo>('/api/auth/session'),
      );
    } catch {
      info = { authenticated: false };
    }
    this.session.set(info);
    this.csrfToken.set('csrfToken' in info ? info.csrfToken : null);
    return info;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>('/api/auth/login', { email, password }),
    );
    this.csrfToken.set(res.csrfToken);
    this.session.set({
      authenticated: false,
      stage: 'PASSWORD_VERIFIED',
      next: res.next,
      csrfToken: res.csrfToken,
    });
    return res;
  }

  verifyTotp(code: string): Promise<AuthenticatedResponse> {
    return this.authenticate('/api/auth/totp/verify', code);
  }

  useRecoveryCode(code: string): Promise<AuthenticatedResponse> {
    return this.authenticate('/api/auth/recovery', code);
  }

  startTotpSetup(): Promise<TotpSetupResponse> {
    return firstValueFrom(
      this.http.post<TotpSetupResponse>('/api/auth/totp/setup', {}),
    );
  }

  confirmTotpSetup(code: string): Promise<AuthenticatedResponse> {
    return this.authenticate('/api/auth/totp/setup/confirm', code);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.session.set({ authenticated: false });
      this.csrfToken.set(null);
    }
  }

  private async authenticate(
    url: string,
    code: string,
  ): Promise<AuthenticatedResponse> {
    const res = await firstValueFrom(
      this.http.post<AuthenticatedResponse>(url, { code }),
    );
    this.csrfToken.set(res.csrfToken);
    // Reload to get the households and the canonical session state.
    await this.refresh();
    return res;
  }
}
