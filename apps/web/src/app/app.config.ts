import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { appRoutes } from './app.routes';
import { csrfInterceptor } from './auth/csrf.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes, withComponentInputBinding()),
    // Same-origin calls to /api (dev: proxy.conf.json). The session cookie is
    // HttpOnly; only the CSRF token is handled here.
    provideHttpClient(withFetch(), withInterceptors([csrfInterceptor])),
  ],
};
