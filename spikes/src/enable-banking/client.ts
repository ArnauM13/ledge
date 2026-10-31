import { readFileSync, existsSync } from 'node:fs';
import { httpRequest, type HttpResult } from '../lib/http.ts';
import { isInsideRepo, requireEnv, optionalEnv, SpikeError } from '../lib/env.ts';
import { createEbJwt } from './jwt.ts';

/** https://enablebanking.com/docs/api/reference ("Base URLs") */
export const EB_BASE_URL = 'https://api.enablebanking.com';

/** Error codes (ErrorResponse.error) from https://enablebanking.com/docs/api/reference */
export const EB_RATE_LIMIT_CODES = new Set(['ASPSP_RATE_LIMIT_EXCEEDED']);
export const EB_SESSION_DEAD_CODES = new Set([
  'EXPIRED_SESSION',
  'CLOSED_SESSION',
  'REVOKED_SESSION',
  'SESSION_DOES_NOT_EXIST',
  'WRONG_SESSION_STATUS',
]);

export interface EbErrorInfo {
  http_status: number;
  /** Text error code, e.g. ASPSP_RATE_LIMIT_EXCEEDED (ErrorResponse.error). */
  error: string | null;
  message: string | null;
}

/** ErrorResponse = { message, code?, error?, detail? }. `detail` is kept only in raw output. */
export function ebErrorInfo(r: HttpResult): EbErrorInfo {
  const b = (r.body ?? {}) as Record<string, unknown>;
  return {
    http_status: r.status,
    error: typeof b.error === 'string' ? b.error : r.networkError ?? null,
    message: typeof b.message === 'string' ? b.message : null,
  };
}

export class EbClient {
  private readonly appId: string;
  private readonly privateKeyPem: string;
  private readonly psuHeaders: Record<string, string>;

  constructor() {
    this.appId = requireEnv('EB_APP_ID');
    const keyPath = requireEnv('EB_PRIVATE_KEY_PATH');
    if (isInsideRepo(keyPath)) {
      throw new SpikeError('EB_PRIVATE_KEY_PATH apunta a un fitxer dins del repo. Mou la clau fora del repo.');
    }
    if (!existsSync(keyPath)) throw new SpikeError('No es troba el fitxer de EB_PRIVATE_KEY_PATH.');
    this.privateKeyPem = readFileSync(keyPath, 'utf8');
    // Optional "PSU present" headers (only when the user is actually at the keyboard).
    // https://enablebanking.com/docs/api/reference (Psu-Ip-Address, Psu-User-Agent, ...)
    const ip = optionalEnv('EB_PSU_IP_ADDRESS');
    this.psuHeaders = ip
      ? { 'Psu-Ip-Address': ip, 'Psu-User-Agent': optionalEnv('EB_PSU_USER_AGENT') ?? 'ledge-spike/0.0' }
      : {};
  }

  get psuPresent(): boolean {
    return Object.keys(this.psuHeaders).length > 0;
  }

  /** The JWT is never logged, returned or written anywhere. */
  private authHeaders(): Record<string, string> {
    let jwt: string;
    try {
      jwt = createEbJwt({ appId: this.appId, privateKey: this.privateKeyPem, ttlSeconds: 3600 });
    } catch {
      throw new SpikeError('No s’ha pogut signar el JWT: comprova que EB_PRIVATE_KEY_PATH és una clau RSA privada PEM.');
    }
    return { Authorization: `Bearer ${jwt}`, Accept: 'application/json' };
  }

  async get(label: string, pathAndQuery: string, opts: { psu?: boolean } = {}): Promise<HttpResult> {
    const headers = { ...this.authHeaders(), ...(opts.psu ? this.psuHeaders : {}) };
    return httpRequest(label, EB_BASE_URL + pathAndQuery, { method: 'GET', headers });
  }

  async delete(label: string, path: string): Promise<HttpResult> {
    return httpRequest(label, EB_BASE_URL + path, { method: 'DELETE', headers: this.authHeaders() });
  }

  async post(label: string, path: string, body: unknown): Promise<HttpResult> {
    return httpRequest(label, EB_BASE_URL + path, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
}
