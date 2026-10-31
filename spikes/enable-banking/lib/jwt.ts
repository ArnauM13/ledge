import { createSign } from 'node:crypto';

// Doc: https://enablebanking.com/docs/api/reference (secció d'autenticació)
// Header: typ=JWT, alg=RS256 (únic suportat), kid=<application_id>
// Claims: iss=enablebanking.com, aud=api.enablebanking.com, iat, exp. TTL màxim: 86400 s.
export const JWT_MAX_TTL_SECONDS = 86_400;
export const JWT_ISS = 'enablebanking.com';
export const JWT_AUD = 'api.enablebanking.com';

const b64url = (input: string | Buffer): string => Buffer.from(input).toString('base64url');

export interface JwtOptions {
  /** Segons Unix. Per defecte, ara. */
  now?: number;
  /** Per defecte, 1 h. */
  ttlSeconds?: number;
}

export function createEbJwt(appId: string, privateKeyPem: string, opts: JwtOptions = {}): string {
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? 3600;
  if (!appId) throw new Error('appId buit');
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > JWT_MAX_TTL_SECONDS) {
    throw new Error(`ttlSeconds ha d'estar entre 1 i ${JWT_MAX_TTL_SECONDS}`);
  }
  const header = { typ: 'JWT', alg: 'RS256', kid: appId };
  const payload = { iss: JWT_ISS, aud: JWT_AUD, iat: now, exp: now + ttl };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${b64url(signature)}`;
}
