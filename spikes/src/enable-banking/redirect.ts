/**
 * After SCA the bank/Enable Banking redirects the PSU to `redirect_url` with
 * `?code=...&state=...` (or `?error=...&error_description=...`).
 * Docs: https://enablebanking.com/docs/api/reference ("Authorize user session")
 *       https://enablebanking.com/docs/api/quick-start
 */
export type RedirectResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'invalid_url' | 'state_mismatch' | 'missing_code' | 'provider_error'; error?: string; description?: string };

export function parseRedirect(pasted: string, expectedState: string): RedirectResult {
  let u: URL;
  try {
    u = new URL(pasted.trim());
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  const p = u.searchParams;
  const err = p.get('error');
  if (err) return { ok: false, reason: 'provider_error', error: err, description: p.get('error_description') ?? undefined };
  if (p.get('state') !== expectedState) return { ok: false, reason: 'state_mismatch' };
  const code = p.get('code');
  if (!code) return { ok: false, reason: 'missing_code' };
  return { ok: true, code };
}

/** RFC3339 with explicit offset, as in the docs example `2025-12-01T12:00:00.000000+00:00`. */
export function rfc3339(d: Date): string {
  return d.toISOString().replace('Z', '+00:00');
}

/** valid_until = now + min(requested days, maximum_consent_validity) - 5 min safety margin. */
export function computeValidUntil(now: Date, maxConsentSeconds: number, requestedDays?: number): Date {
  const maxMs = maxConsentSeconds * 1000;
  const reqMs = requestedDays ? requestedDays * 86400 * 1000 : maxMs;
  return new Date(now.getTime() + Math.min(maxMs, reqMs) - 5 * 60 * 1000);
}
