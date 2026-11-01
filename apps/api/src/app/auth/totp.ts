import { Secret, TOTP } from 'otpauth';
import * as QRCode from 'qrcode';
import { TOTP_OPTIONS } from './auth.constants';

export function generateTotpSecret(): string {
  return new Secret({ size: TOTP_OPTIONS.secretBytes }).base32;
}

function totpFor(secretBase32: string, label: string): TOTP {
  return new TOTP({
    issuer: TOTP_OPTIONS.issuer,
    label,
    algorithm: TOTP_OPTIONS.algorithm,
    digits: TOTP_OPTIONS.digits,
    period: TOTP_OPTIONS.period,
    secret: Secret.fromBase32(secretBase32),
  });
}

export interface TotpEnrolment {
  /** Base32 secret, for manual entry in the authenticator app. */
  secret: string;
  otpauthUrl: string;
  /** PNG data URL, generated locally (no external service sees the secret). */
  qrDataUrl: string;
}

export async function totpEnrolment(
  secretBase32: string,
  label: string,
): Promise<TotpEnrolment> {
  const otpauthUrl = totpFor(secretBase32, label).toString();
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 240,
  });
  return { secret: secretBase32, otpauthUrl, qrDataUrl };
}

/**
 * Verifies a 6-digit code. Returns the matched time step, or null.
 * The caller must reject steps <= the last used one (replay protection).
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  now = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) {
    return null;
  }
  const totp = totpFor(secretBase32, 'verify');
  const delta = totp.validate({
    token: code,
    timestamp: now,
    window: TOTP_OPTIONS.window,
  });
  if (delta === null) {
    return null;
  }
  return Math.floor(now / 1000 / TOTP_OPTIONS.period) + delta;
}

/** Current code; only used by tests and the enrolment check. */
export function currentTotp(secretBase32: string, now = Date.now()): string {
  return totpFor(secretBase32, 'verify').generate({ timestamp: now });
}
