// Client mínim i READ-ONLY per a l'API de Binance.
//  - Només pot cridar les rutes de la llista blanca (`ENDPOINTS`).
//  - S'atura definitivament amb un 429 o un 418 i no reintenta mai.
//  - No desa ni imprimeix mai la clau, el secret ni la signatura.
// Codis d'error: https://developers.binance.com/docs/binance-spot-api-docs/errors
import { anonymizeCryptoText } from '../../lib/anonymize.ts';
import { ENDPOINTS, LIMITS, WEIGHT_SAFETY_RATIO, type EndpointName } from './endpoints.ts';
import { signParams, type ParamValue } from './sign.ts';

export const DEFAULT_API_BASE = 'https://api.binance.com';

export interface BnConfig {
  /** No s'imprimeix mai. */
  apiKey: string;
  /** No s'imprimeix mai. */
  apiSecret: string;
  apiBase: string;
  recvWindow: number;
}

/** Codis que indiquen un problema de clau, signatura o rellotge: no té sentit continuar. */
export const FATAL_CODES: Record<number, string> = {
  [-1002]: 'UNAUTHORIZED: la clau no té permís per a aquesta petició.',
  [-1021]: 'INVALID_TIMESTAMP: el rellotge del sistema no està sincronitzat (o recvWindow massa petit).',
  [-1022]: 'INVALID_SIGNATURE: BINANCE_API_SECRET incorrecte.',
  [-2014]: 'BAD_API_KEY_FMT: BINANCE_API_KEY té un format invàlid.',
  [-2015]: 'REJECTED_MBX_KEY: clau, IP o permisos invàlids. Revisa la restricció d\'IP de la clau.',
};

export class BinanceApiError extends Error {
  constructor(
    readonly status: number,
    /** Codi d'error de Binance (`code`), si n'hi ha. */
    readonly code: number | undefined,
    message: string,
    readonly retryAfter?: string,
  ) {
    super(message);
  }

  get isRateLimit(): boolean {
    return this.status === 429 || this.status === 418 || this.code === -1003;
  }

  get isFatal(): boolean {
    return this.isRateLimit || this.status === 401 || (this.code !== undefined && this.code in FATAL_CODES);
  }
}

export interface CallLog {
  endpoint: EndpointName;
  method: string;
  path: string;
  status: number;
  ms: number;
  /** Pes documentat d'aquesta crida. */
  weight: { ip?: number; uid?: number };
  /** Capçaleres de pes retornades (X-SAPI-USED-*, X-MBX-USED-*), en minúscules. */
  usedWeight: Record<string, string>;
  code?: number;
  /** Missatge d'error anonimitzat. */
  error?: string;
}

/** Explicació en català, sense secrets. */
export function explainBinanceError(e: BinanceApiError): string {
  const base = `HTTP ${e.status}${e.code !== undefined ? ` code ${e.code}` : ''}: ${anonymizeCryptoText(e.message)}`;
  if (e.status === 418) return `${base}\n→ IP bandejada temporalment per Binance. NO tornis a provar fins passat Retry-After (${e.retryAfter ?? '?'} s).`;
  if (e.isRateLimit) return `${base}\n→ Límit de pes superat. El spike s'ha aturat. Espera${e.retryAfter ? ` ${e.retryAfter} s` : ' uns minuts'} abans de tornar-ho a provar.`;
  const hint = e.code !== undefined ? FATAL_CODES[e.code] : undefined;
  return hint ? `${base}\n→ ${hint}` : base;
}

export class BnClient {
  readonly calls: CallLog[] = [];
  /** Si s'ha aturat (429/418, error fatal o pes massa alt), el motiu. A partir d'aquí no es fa cap crida més. */
  halted?: string;

  constructor(
    private readonly cfg: BnConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async signed<T>(name: EndpointName, params: Record<string, ParamValue> = {}): Promise<T> {
    if (this.halted) throw new BinanceApiError(0, undefined, `No s'ha fet la crida: el spike ja estava aturat (${this.halted}).`);
    const def = ENDPOINTS[name];
    if (!def) throw new Error(`Endpoint no permès: ${String(name)}`);

    const payload = signParams(params, this.cfg.apiSecret, { timestamp: this.now(), recvWindow: this.cfg.recvWindow });
    const url = new URL(def.path, this.cfg.apiBase);
    const init: RequestInit = {
      method: def.method,
      headers: { 'X-MBX-APIKEY': this.cfg.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    };
    if (def.method === 'GET') {
      url.search = payload;
    } else {
      // POST: paràmetres al cos (application/x-www-form-urlencoded), com als exemples curl de la doc.
      (init.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
      init.body = payload;
    }

    const log: CallLog = { endpoint: name, method: def.method, path: def.path, status: 0, ms: 0, weight: def.weight, usedWeight: {} };
    this.calls.push(log);

    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      log.error = `Error de xarxa: ${(e as Error).message}`;
      throw new BinanceApiError(0, undefined, log.error);
    }
    log.ms = Math.round(performance.now() - t0);
    log.status = res.status;
    res.headers.forEach((v, k) => {
      if (/^x-(sapi|mbx)-used-/i.test(k)) log.usedWeight[k.toLowerCase()] = v;
    });

    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }

    if (!res.ok) {
      const code = typeof json?.code === 'number' ? json.code : undefined;
      const msg = typeof json?.msg === 'string' ? json.msg : text.slice(0, 300) || res.statusText;
      const err = new BinanceApiError(res.status, code, msg, res.headers.get('retry-after') ?? undefined);
      log.code = code;
      log.error = anonymizeCryptoText(msg);
      if (err.isFatal) this.halted = `HTTP ${res.status}${code !== undefined ? ` code ${code}` : ''}`;
      throw err;
    }

    const over = this.weightOverThreshold(log.usedWeight);
    if (over) this.halted = over;
    return json as T;
  }

  /** Retorna un motiu si alguna capçalera de pes supera el llindar de seguretat. */
  weightOverThreshold(used: Record<string, string>): string | undefined {
    for (const [header, limit] of Object.entries(LIMITS)) {
      const v = Number(used[header]);
      if (Number.isFinite(v) && v >= limit * WEIGHT_SAFETY_RATIO) {
        return `${header}=${v} supera el ${WEIGHT_SAFETY_RATIO * 100}% del límit (${limit})`;
      }
    }
    return undefined;
  }

  /** Pes documentat total de les crides fetes (inclou les fallides, que també compten). */
  get documentedWeight(): { ip: number; uid: number } {
    return this.calls.reduce(
      (acc, c) => ({ ip: acc.ip + (c.status ? c.weight.ip ?? 0 : 0), uid: acc.uid + (c.status ? c.weight.uid ?? 0 : 0) }),
      { ip: 0, uid: 0 },
    );
  }

  /** Valor màxim observat de cada capçalera de pes. */
  get maxObservedWeight(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const c of this.calls) {
      for (const [k, v] of Object.entries(c.usedWeight)) {
        const n = Number(v);
        if (Number.isFinite(n)) out[k] = Math.max(out[k] ?? 0, n);
      }
    }
    return out;
  }
}
