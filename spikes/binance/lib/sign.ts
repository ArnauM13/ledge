// Signatura de peticions SIGNED (USER_DATA) amb HMAC-SHA256.
// Docs: https://developers.binance.com/docs/binance-spot-api-docs/rest-api/request-security
//   - "The signature payload of your request is the query string concatenated without separator to the HTTP body."
//   - Paràmetre `signature` (hex) i capçalera `X-MBX-APIKEY`.
//   - `timestamp` en ms; `recvWindow` opcional, per defecte 5000 ms, màxim 60000 ms.
import { createHmac } from 'node:crypto';
import { SpikeError } from '../../lib/env.ts';

export const DEFAULT_RECV_WINDOW = 5_000;
export const MAX_RECV_WINDOW = 60_000;

export type ParamValue = string | number | boolean | undefined;

export function hmacSha256Hex(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Serialitza els paràmetres en l'ordre donat (s'ometen els `undefined`). */
export function toQueryString(params: Record<string, ParamValue>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) sp.append(k, String(v));
  return sp.toString();
}

/**
 * Construeix el payload complet (`...&recvWindow=…&timestamp=…&signature=…`).
 * El que se signa és exactament el que s'envia (abans d'afegir `signature`).
 */
export function signParams(
  params: Record<string, ParamValue>,
  secret: string,
  opts: { timestamp: number; recvWindow: number },
): string {
  const payload = toQueryString({ ...params, recvWindow: opts.recvWindow, timestamp: opts.timestamp });
  return `${payload}&signature=${hmacSha256Hex(payload, secret)}`;
}

export function parseRecvWindow(value: string | undefined): number {
  if (value === undefined || value === '') return DEFAULT_RECV_WINDOW;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_RECV_WINDOW) {
    throw new SpikeError(`BINANCE_RECV_WINDOW ha de ser un enter entre 1 i ${MAX_RECV_WINDOW} (ms).`);
  }
  return n;
}
