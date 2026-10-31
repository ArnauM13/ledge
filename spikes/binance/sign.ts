import { createHmac } from 'node:crypto';

/**
 * Binance SIGNED (USER_DATA) requests.
 * Docs: https://developers.binance.com/docs/binance-spot-api-docs/rest-api  (General API info: "SIGNED endpoint security")
 *   - signature = HMAC-SHA256(secretKey, totalParams), hex encoded
 *   - totalParams = percent-encoded query string (+ body); we send everything in the query string
 *   - header X-MBX-APIKEY; `timestamp` required; `recvWindow` default 5000, max 60000
 *   - From ~2026-01-15 payloads must be percent-encoded before signing (wallet change log).
 */
export type ParamValue = string | number | boolean;

/** RFC 3986 percent-encoding, preserving insertion order. */
export function encodeParams(params: Record<string, ParamValue>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

export function hmacSha256Hex(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** Returns `<encoded params>&timestamp=..&recvWindow=..&signature=<hex>`. */
export function buildSignedQuery(
  params: Record<string, ParamValue>,
  secret: string,
  timestamp: number,
  recvWindow = 5000,
): string {
  if (recvWindow > 60_000) throw new Error('recvWindow max is 60000');
  const q = encodeParams({ ...params, recvWindow, timestamp });
  return `${q}&signature=${hmacSha256Hex(q, secret)}`;
}
