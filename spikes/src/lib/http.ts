export interface HttpResult {
  /** Human label of the call (never contains secrets). */
  label: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  /** Selected response headers (rate-limit related). */
  rateLimitHeaders: Record<string, string>;
  body: unknown;
  /** Network-level error (timeout, DNS...), if any. */
  networkError?: string;
}

const RATE_HEADER_RE = /rate|limit|retry-after|used-weight|x-mbx|x-sapi/i;

export function pickRateLimitHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((value, key) => {
    if (RATE_HEADER_RE.test(key)) out[key] = value;
  });
  return out;
}

/**
 * Thin wrapper around native fetch. It never logs or returns the URL,
 * because some URLs carry API keys in the query string (Etherscan).
 */
export async function httpRequest(
  label: string,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<HttpResult> {
  const started = performance.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw text */
    }
    return {
      label,
      status: res.status,
      ok: res.ok,
      latencyMs: Math.round(performance.now() - started),
      rateLimitHeaders: pickRateLimitHeaders(res.headers),
      body,
    };
  } catch (e) {
    const err = e as Error;
    return {
      label,
      status: 0,
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      rateLimitHeaders: {},
      body: null,
      // Only the error class/name: cause messages from undici may echo the URL.
      networkError: err.name === 'TimeoutError' ? 'TimeoutError' : `${err.name}: network error`,
    };
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
