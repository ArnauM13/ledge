/**
 * Authentication parameters. Values follow the OWASP cheat sheets
 * (Password Storage, Session Management, Authentication); see README.md.
 */

/**
 * argon2id, OWASP Password Storage Cheat Sheet minimum configuration:
 * m = 19 MiB, t = 2, p = 1. Hashes with older parameters are upgraded on the
 * next successful login.
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19_456, // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

/** Session cookie. `__Host-` forces Secure, Path=/ and no Domain. */
export const SESSION_COOKIE = '__Host-ledge_session';
/** Full session: expires after this long without requests. */
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
/** Full session: expires this long after login, whatever the activity. */
export const SESSION_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
/** Password-only session (waiting for the TOTP code or enrolment). */
export const PENDING_SESSION_TIMEOUT_MS = 5 * 60 * 1000;
/** `last_seen_at` is written at most this often. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

/** Per account: lock after this many consecutive failures (password, TOTP or recovery code). */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

/** Per IP, in memory: attempts on the login/2FA endpoints per window. */
export const IP_RATE_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 } as const;

/** TOTP (RFC 6238) with the parameters every authenticator app supports. */
export const TOTP_OPTIONS = {
  issuer: 'ledge',
  algorithm: 'SHA1',
  digits: 6,
  period: 30,
  /** Accept the previous and next step to tolerate clock drift. */
  window: 1,
  /** 160-bit secret (RFC 4226 recommendation). */
  secretBytes: 20,
} as const;

export const RECOVERY_CODE_COUNT = 10;

/** Header that carries the CSRF token on state-changing requests. */
export const CSRF_HEADER = 'x-csrf-token';

/** The only message a failed login or 2FA step ever returns. */
export const GENERIC_AUTH_ERROR =
  'Could not sign in. Check your details or try again in a few minutes.';
