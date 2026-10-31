import { httpRequest, type HttpResult } from '../lib/http.ts';
import { buildSignedQuery, type ParamValue } from './sign.ts';

/** https://developers.binance.com/docs/binance-spot-api-docs/rest-api (General API information) */
export const BINANCE_BASE_URL = 'https://api.binance.com';

export interface BinanceError {
  http_status: number;
  code: number | null;
  msg: string | null;
  retry_after: string | null;
}

export function binanceErrorInfo(r: HttpResult): BinanceError {
  const b = (r.body ?? {}) as Record<string, unknown>;
  return {
    http_status: r.status,
    code: typeof b.code === 'number' ? b.code : null,
    msg: typeof b.msg === 'string' ? b.msg : r.networkError ?? null,
    retry_after: r.rateLimitHeaders['retry-after'] ?? null,
  };
}

export class BinanceClient {
  private offsetMs = 0;
  constructor(
    private readonly apiKey: string,
    private readonly secret: string,
  ) {}

  /** GET /api/v3/time — Weight(IP): 1, no auth. Used to avoid -1021 timestamp errors. */
  async syncTime(): Promise<HttpResult> {
    const before = Date.now();
    const r = await httpRequest('GET /api/v3/time', `${BINANCE_BASE_URL}/api/v3/time`);
    const serverTime = (r.body as { serverTime?: number } | null)?.serverTime;
    if (r.ok && typeof serverTime === 'number') this.offsetMs = serverTime - Math.round((before + Date.now()) / 2);
    return r;
  }

  /** Signed request. Params go in the query string (allowed for POST too). Signature/URL never logged. */
  async signed(method: 'GET' | 'POST', path: string, params: Record<string, ParamValue> = {}): Promise<HttpResult> {
    const qs = buildSignedQuery(params, this.secret, Date.now() + this.offsetMs, 10_000);
    return httpRequest(`${method} ${path}`, `${BINANCE_BASE_URL}${path}?${qs}`, {
      method,
      headers: { 'X-MBX-APIKEY': this.apiKey, Accept: 'application/json' },
    });
  }
}
