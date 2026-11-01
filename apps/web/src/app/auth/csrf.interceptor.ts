import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Adds the session's CSRF token to state-changing requests to our API. */
export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).csrfToken();
  if (!token || SAFE_METHODS.has(req.method) || !req.url.startsWith('/api/')) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-CSRF-Token': token } }));
};
