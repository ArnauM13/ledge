import { anonymizeText, templatePath } from './anonymize.ts';
import type { EbConfig } from './env.ts';
import { createEbJwt } from './jwt.ts';

export class EbApiError extends Error {
  constructor(
    readonly status: number,
    /** Codi d'error d'Enable Banking (p. ex. EXPIRED_SESSION), si n'hi ha. */
    readonly errorCode: string | undefined,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }

  get isRateLimit(): boolean {
    return this.status === 429 || this.errorCode === 'ASPSP_RATE_LIMIT_EXCEEDED';
  }

  /** Errors que obliguen a tornar a fer eb:connect. */
  get isSessionGone(): boolean {
    return ['EXPIRED_SESSION', 'CLOSED_SESSION', 'REVOKED_SESSION', 'SESSION_DOES_NOT_EXIST'].includes(this.errorCode ?? '');
  }
}

export interface CallLog {
  method: string;
  /** Ruta amb els UUID substituïts per `:id`. */
  path: string;
  status: number;
  ms: number;
  errorCode?: string;
}

interface RequestOptions {
  query?: Record<string, string | undefined>;
  body?: unknown;
  /** Afegeix les capçaleres Psu-* (si EB_PSU_IP_ADDRESS està configurada). */
  psu?: boolean;
}

/** Client mínim i read-only (només GET, i POST/DELETE de sessió i autorització). */
export class EbClient {
  readonly calls: CallLog[] = [];
  private readonly token: string;

  constructor(private readonly cfg: EbConfig) {
    this.token = createEbJwt(cfg.appId, cfg.privateKeyPem);
  }

  get psuHeadersEnabled(): boolean {
    return Boolean(this.cfg.psuIpAddress);
  }

  async request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(path, this.cfg.apiBase);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, v);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
    };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.psu && this.cfg.psuIpAddress) {
      headers['Psu-Ip-Address'] = this.cfg.psuIpAddress;
      headers['Psu-User-Agent'] = 'ledge-spike/0.1';
    }

    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e) {
      throw new EbApiError(0, 'NETWORK_ERROR', `Error de xarxa: ${(e as Error).message}`);
    }
    const ms = Math.round(performance.now() - t0);
    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }

    const errorCode: string | undefined = res.ok
      ? undefined
      : typeof json?.error === 'string'
        ? json.error
        : typeof json?.code === 'string'
          ? json.code
          : undefined;
    this.calls.push({ method, path: templatePath(url.pathname), status: res.status, ms, errorCode });

    if (!res.ok) {
      const msg = typeof json?.message === 'string' ? json.message : text.slice(0, 300) || res.statusText;
      throw new EbApiError(res.status, errorCode, msg, json?.detail);
    }
    return json as T;
  }
}

/** Explicació en català per a l'usuari, amb el que cal fer. */
export function explainError(e: EbApiError): string {
  const base = `HTTP ${e.status}${e.errorCode ? ` ${e.errorCode}` : ''}: ${anonymizeText(e.message)}`;
  if (e.isRateLimit) return `${base}\n→ Límit de consultes del banc. NO tornis a provar fins d'aquí a 6 h com a mínim.`;
  if (e.isSessionGone) return `${base}\n→ La sessió ja no és vàlida. Torna a executar eb:connect.`;
  if (e.status === 401 || (e.status === 403 && /application/i.test(e.message)))
    return `${base}\n→ App o JWT rebutjats: revisa EB_APP_ID (nom del .pem), que la clau sigui la d'aquesta app i el rellotge del sistema.`;
  if (e.errorCode === 'EXPIRED_AUTHORIZATION_CODE' || e.errorCode === 'WRONG_AUTHORIZATION_CODE')
    return `${base}\n→ El codi de redirecció ha caducat o és incorrecte. Torna a executar eb:connect i enganxa l'URL de seguida.`;
  if (e.errorCode === 'PSU_HEADER_NOT_PROVIDED')
    return `${base}\n→ El banc demana capçaleres PSU. Prova d'omplir EB_PSU_IP_ADDRESS al .env.`;
  return base;
}

/** Taula Markdown de les crides fetes (sense IDs). */
export function callsTable(calls: CallLog[]): string {
  const rows = calls.map((c) => `| ${c.method} | \`${c.path}\` | ${c.status} | ${c.ms} | ${c.errorCode ?? '—'} |`);
  return ['| Mètode | Ruta | HTTP | ms | Error |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
}
