import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { csrfInterceptor } from './csrf.interceptor';

describe('AuthService + CSRF interceptor', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([csrfInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it('login stores the CSRF token and the next step', async () => {
    const done = auth.login('a@example.com', 'secret');
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'a@example.com',
      password: 'secret',
    });
    expect(req.request.headers.has('X-CSRF-Token')).toBe(false);
    req.flush({ next: 'totp', csrfToken: 'tok-1' });
    expect(await done).toEqual({ next: 'totp', csrfToken: 'tok-1' });
    expect(auth.csrfToken()).toBe('tok-1');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('adds X-CSRF-Token to state-changing /api requests only', async () => {
    auth.csrfToken.set('tok-2');
    const client = TestBed.inject(HttpClient);

    const post = firstValueFrom(client.post('/api/auth/logout', {}));
    const postReq = http.expectOne('/api/auth/logout');
    expect(postReq.request.headers.get('X-CSRF-Token')).toBe('tok-2');
    postReq.flush(null);
    await post;

    const get = firstValueFrom(client.get('/api/auth/session'));
    const getReq = http.expectOne('/api/auth/session');
    expect(getReq.request.headers.has('X-CSRF-Token')).toBe(false);
    getReq.flush({ authenticated: false });
    await get;

    const external = firstValueFrom(client.post('https://example.com/x', {}));
    const extReq = http.expectOne('https://example.com/x');
    expect(extReq.request.headers.has('X-CSRF-Token')).toBe(false);
    extReq.flush(null);
    await external;
  });

  it('refresh treats API errors as signed out', async () => {
    const done = auth.refresh();
    http
      .expectOne('/api/auth/session')
      .flush(null, { status: 500, statusText: 'x' });
    expect(await done).toEqual({ authenticated: false });
    expect(auth.csrfToken()).toBeNull();
  });
});
