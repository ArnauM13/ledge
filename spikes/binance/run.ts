/**
 * npm run binance
 * Gate G3: which Binance read-only endpoints return data for this key.
 *
 * All endpoints/weights verified 2026-10-31 against Binance's official OpenAPI spec
 * https://github.com/binance/binance-api-swagger/blob/master/spot_api.yaml
 * (the developers.binance.com Wallet / Simple Earn pages are client-rendered and could not be
 * fetched as text; /api/v3/account and the signing rules were verified on
 * https://developers.binance.com/docs/binance-spot-api-docs/rest-api).
 * Rate limits / headers: https://developers.binance.com/en/docs/products/wallet/general-info.md
 *
 * Step 1 is mandatory: GET /sapi/v1/account/apiRestrictions. If the key has ANY permission other
 * than reading, the script stops before calling anything else.
 * Only GET/POST *query* endpoints are used. No order, transfer, withdraw or subscription endpoint.
 */
import { cell } from '../shared/anonymize.ts';
import { requireEnv, SpikeError } from '../shared/env.ts';
import { sleep, type HttpResult } from '../shared/http.ts';
import { REPORT_FOOTER, writeOutputs } from '../shared/report.ts';
import { BinanceClient, binanceErrorInfo, type BinanceError } from './client.ts';
import { checkApiRestrictions } from './permissions.ts';
import type { ParamValue } from './sign.ts';

interface EndpointSpec {
  key: string;
  method: 'GET' | 'POST';
  path: string;
  params?: Record<string, ParamValue>;
  /** Documented weight, e.g. { ip: 20 } */
  weight: { ip?: number; uid?: number };
  /** Count items that hold a balance / records, never amounts. */
  summarize: (body: unknown) => string;
}

const nz = (...vals: unknown[]) => vals.some((v) => Number(v ?? 0) > 0);
const arr = (b: unknown) => (Array.isArray(b) ? (b as Record<string, unknown>[]) : []);
const rows = (b: unknown) => {
  const o = (b ?? {}) as { rows?: unknown[]; total?: number };
  return { n: Array.isArray(o.rows) ? o.rows.length : 0, total: typeof o.total === 'number' ? o.total : null };
};

export const ENDPOINTS: EndpointSpec[] = [
  {
    // "Account Information (USER_DATA)" Weight(IP): 20
    key: 'Spot account',
    method: 'GET',
    path: '/api/v3/account',
    params: { omitZeroBalances: 'true' },
    weight: { ip: 20 },
    summarize: (b) => {
      const bal = ((b ?? {}) as { balances?: Array<{ free?: string; locked?: string }> }).balances ?? [];
      return `${bal.filter((x) => nz(x.free, x.locked)).length} actius amb saldo`;
    },
  },
  {
    // "User Asset (USER_DATA)" — "Get user assets, just for positive data." Weight(IP): 5
    key: 'User assets (getUserAsset)',
    method: 'POST',
    path: '/sapi/v3/asset/getUserAsset',
    params: { needBtcValuation: 'false' },
    weight: { ip: 5 },
    summarize: (b) => `${arr(b).length} actius amb saldo`,
  },
  {
    // "Funding Wallet (USER_DATA)" Weight(IP): 1
    key: 'Funding wallet',
    method: 'POST',
    path: '/sapi/v1/asset/get-funding-asset',
    params: { needBtcValuation: 'false' },
    weight: { ip: 1 },
    summarize: (b) => `${arr(b).filter((x) => nz(x.free, x.locked, x.freeze, x.withdrawing)).length} actius amb saldo`,
  },
  {
    // "Query User Wallet Balance (USER_DATA)" Weight(IP): 60 — response [{ activate, balance, walletName }]
    key: 'Saldo per wallet',
    method: 'GET',
    path: '/sapi/v1/asset/wallet/balance',
    weight: { ip: 60 },
    summarize: (b) => {
      const withBal = arr(b).filter((x) => nz(x.balance)).map((x) => String(x.walletName));
      return withBal.length ? `wallets amb saldo: ${withBal.join(', ')}` : 'cap wallet amb saldo';
    },
  },
  {
    // "Get Flexible Product Position (USER_DATA)" Weight(IP): 150, size max 100
    key: 'Simple Earn flexible',
    method: 'GET',
    path: '/sapi/v1/simple-earn/flexible/position',
    params: { size: 100 },
    weight: { ip: 150 },
    summarize: (b) => {
      const r = rows(b);
      return `${r.n} posicions${r.total !== null && r.total > r.n ? ` (total ${r.total}, no paginat)` : ''}`;
    },
  },
  {
    // "Get Locked Product Position (USER_DATA)" Weight(IP): 150, size max 100
    key: 'Simple Earn locked',
    method: 'GET',
    path: '/sapi/v1/simple-earn/locked/position',
    params: { size: 100 },
    weight: { ip: 150 },
    summarize: (b) => {
      const r = rows(b);
      return `${r.n} posicions${r.total !== null && r.total > r.n ? ` (total ${r.total}, no paginat)` : ''}`;
    },
  },
  {
    // "Deposit History (supporting network)" Weight(IP): 1. Default window: last 90 days.
    key: 'Historial de dipòsits (90 dies)',
    method: 'GET',
    path: '/sapi/v1/capital/deposit/hisrec',
    params: { limit: 1000 },
    weight: { ip: 1 },
    summarize: (b) => `${arr(b).length} registres`,
  },
  {
    // "Withdraw History (supporting network)" Weight(UID): 18000, max 10 req/s. Default window: 90 days.
    key: 'Historial de retirades (90 dies)',
    method: 'GET',
    path: '/sapi/v1/capital/withdraw/history',
    params: { limit: 1000 },
    weight: { uid: 18000 },
    summarize: (b) => `${arr(b).length} registres`,
  },
];

interface CallRow {
  key: string;
  label: string;
  status: number;
  latency_ms: number;
  ok: boolean;
  summary: string;
  error: BinanceError | null;
  weight_doc: string;
  headers: Record<string, string>;
}

const isRateLimited = (r: HttpResult) => r.status === 429 || r.status === 418;

async function main() {
  const apiKey = requireEnv('BINANCE_API_KEY');
  const secret = requireEnv('BINANCE_API_SECRET');
  const secrets = [apiKey, secret];
  const client = new BinanceClient(apiKey, secret);
  const raw: Record<string, unknown> = { generated_at: new Date().toISOString(), calls: [] as unknown[] };
  const rowsOut: CallRow[] = [];
  let ipWeight = 0;
  let uidWeight = 0;

  const record = (key: string, r: HttpResult, w: { ip?: number; uid?: number }, summary: string) => {
    (raw.calls as unknown[]).push({ key, label: r.label, status: r.status, latency_ms: r.latencyMs, headers: r.rateLimitHeaders, body: r.body });
    ipWeight += w.ip ?? 0;
    uidWeight += w.uid ?? 0;
    rowsOut.push({
      key,
      label: r.label,
      status: r.status,
      latency_ms: r.latencyMs,
      ok: r.ok,
      summary,
      error: r.ok ? null : binanceErrorInfo(r),
      weight_doc: [w.ip ? `IP ${w.ip}` : '', w.uid ? `UID ${w.uid}` : ''].filter(Boolean).join(' + '),
      headers: r.rateLimitHeaders,
    });
  };

  const t = await client.syncTime();
  record('Server time', t, { ip: 1 }, t.ok ? 'ok' : 'error');

  // ---- Step 1: mandatory permission check ----
  const pr = await client.signed('GET', '/sapi/v1/account/apiRestrictions');
  record('Permisos de la clau (apiRestrictions)', pr, { ip: 1 }, pr.ok ? 'ok' : 'error');
  let stopReason: string | null = null;
  let permWarnings: string[] = [];
  let permFlags: Record<string, boolean> = {};
  if (!pr.ok) {
    const e = binanceErrorInfo(pr);
    stopReason = `No s’han pogut llegir els permisos de la clau (HTTP ${e.http_status} ${e.code ?? ''} ${e.msg ?? ''}). Aturat per seguretat.`;
  } else {
    const check = checkApiRestrictions(pr.body);
    permWarnings = check.warnings;
    permFlags = Object.fromEntries(
      Object.entries(pr.body as Record<string, unknown>).filter(([, v]) => typeof v === 'boolean'),
    ) as Record<string, boolean>;
    if (!check.ok) {
      stopReason = `La clau té permisos que no són només de lectura: ${check.violations.join(', ')}. ATURAT: crea una clau nova només amb "Enable Reading".`;
    }
  }

  // ---- Step 2: read-only queries ----
  if (!stopReason) {
    for (const ep of ENDPOINTS) {
      await sleep(300);
      const r = await client.signed(ep.method, ep.path, ep.params ?? {});
      record(ep.key, r, ep.weight, r.ok ? ep.summarize(r.body) : 'error');
      if (isRateLimited(r)) {
        stopReason = `Límit de peticions (HTTP ${r.status}, Retry-After=${r.rateLimitHeaders['retry-after'] ?? '?'} s). Aturat sense reintentar.`;
        break;
      }
    }
  }

  raw.stop_reason = stopReason;
  raw.documented_weight = { ip: ipWeight, uid: uidWeight };

  // ---- Report ----
  let md = `# Binance — spike read-only (G3)\n\nGenerat: ${new Date().toISOString()}\n\n`;
  md += `## Permisos de la clau\n\n`;
  md += Object.keys(permFlags).length
    ? `| Camp | Valor |\n|---|---|\n${Object.entries(permFlags).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\n`
    : '- No llegits\n\n';
  md += permWarnings.map((w) => `> ⚠️ ${w}\n`).join('') + '\n';
  md += stopReason ? `**Aturat:** ${cell(stopReason)}\n\n` : '';
  md += `## Endpoints\n\n| Producte | Endpoint | HTTP | Latència (ms) | Dades | Pes documentat | Capçaleres de pes | Error |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of rowsOut) {
    const hdr = Object.entries(r.headers).filter(([k]) => /used|retry/i.test(k)).map(([k, v]) => `${k}=${v}`).join(' ');
    const err = r.error ? `${r.error.code ?? ''} ${r.error.msg ?? ''}`.trim() : '—';
    md += `| ${cell(r.key)} | \`${cell(r.label)}\` | ${r.status} | ${r.latency_ms} | ${cell(r.summary)} | ${r.weight_doc} | ${cell(hdr || '—')} | ${cell(err)} |\n`;
  }
  md += `\nPes total consumit (segons la documentació): **IP ${ipWeight}**, **UID ${uidWeight}**. Límits documentats per a /sapi: IP 12000/min i UID 180000/min, independents per endpoint (vegeu capçaleres X-MBX-USED-WEIGHT-1M per a /api).\n`;
  md += REPORT_FOOTER;

  const out = writeOutputs('binance', raw, md, secrets);
  console.log(stopReason ? `ATURAT: ${stopReason}` : `Fet. ${rowsOut.filter((r) => r.ok).length}/${rowsOut.length} crides OK.`);
  for (const w of permWarnings) console.log(`AVÍS: ${w}`);
  console.log(`Raw (no compartir): ${out.rawPath}\nInforme (compartible): ${out.reportPath}`);
  if (stopReason || rowsOut.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e: Error) => {
  console.error(e instanceof SpikeError ? `ERROR: ${e.message}` : `ERROR inesperat: ${e.name}: ${e.message}`);
  process.exit(1);
});
