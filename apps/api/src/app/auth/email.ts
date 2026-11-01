export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Emails are stored trimmed and lower-case (enforced by a CHECK constraint). */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
