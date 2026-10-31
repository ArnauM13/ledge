import { createPrivateKey, sign, type KeyObject } from 'node:crypto';

/**
 * Enable Banking API authentication JWT.
 * Docs (verified 2026-10-31):
 *   https://enablebanking.com/docs/api/reference  ("JWT format and signature")
 *   https://enablebanking.com/docs/api/quick-start ("Creating JWT for API authorisation")
 * - header: { typ: "JWT", alg: "RS256", kid: <application id> }
 * - body:   { iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp }
 * - "Maximum allowed time-to-live for token is 86400 seconds (24 hours)."
 * - Sent as `Authorization: Bearer <JWT>`.
 */
export const EB_JWT_ISS = 'enablebanking.com';
export const EB_JWT_AUD = 'api.enablebanking.com';
export const EB_JWT_MAX_TTL_SECONDS = 86_400;

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export interface EbJwtOptions {
  appId: string;
  privateKey: string | KeyObject;
  /** Seconds since epoch. Defaults to now. */
  nowSeconds?: number;
  ttlSeconds?: number;
}

export function createEbJwt({ appId, privateKey, nowSeconds, ttlSeconds = 3600 }: EbJwtOptions): string {
  if (!appId) throw new Error('appId (kid) is required');
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > EB_JWT_MAX_TTL_SECONDS) {
    throw new Error(`ttlSeconds must be an integer in (0, ${EB_JWT_MAX_TTL_SECONDS}]`);
  }
  const key = typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;
  if (key.asymmetricKeyType !== 'rsa') throw new Error('Enable Banking requires an RSA private key (RS256)');
  const iat = nowSeconds ?? Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'RS256', kid: appId };
  const payload = { iss: EB_JWT_ISS, aud: EB_JWT_AUD, iat, exp: iat + ttlSeconds };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  // RS256 = RSASSA-PKCS1-v1_5 with SHA-256 (node default padding for RSA keys).
  const signature = sign('sha256', Buffer.from(signingInput), key);
  return `${signingInput}.${b64url(signature)}`;
}
