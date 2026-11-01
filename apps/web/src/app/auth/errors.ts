import { HttpErrorResponse } from '@angular/common/http';

/** The API never says why a login failed; neither does the UI. */
export function authErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 429) {
      return 'Too many attempts. Try again in a few minutes.';
    }
    if (err.status === 0 || err.status >= 500) {
      return 'The server is not responding. Try again later.';
    }
  }
  return 'Could not sign in. Check your details or try again in a few minutes.';
}
