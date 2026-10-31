// npm run bn:fetch [-- --history-days 90]
// 1) Comprova que la clau sigui de només lectura (s'atura si no ho és).
// 2) Llegeix, en sèrie i sense reintents: compte spot, getUserAsset, funding wallet, saldo per wallet,
//    Simple Earn (flexible i locked) i historial de dipòsits i retirades.
// Cada endpoint té la URL de la documentació oficial a ./lib/endpoints.ts.
import { anonymizeCryptoText } from '../lib/anonymize.ts';
import { args, run, sleep } from '../lib/cli.ts';
import { SpikeError } from '../lib/env.ts';
import { mdTable, reportHeader, writeOutputs } from '../lib/report.ts';
import { BinanceApiError, BnClient, explainBinanceError } from './lib/client.ts';
import { loadBnConfig } from './lib/config.ts';
import { ENDPOINTS, type EndpointName } from './lib/endpoints.ts';
import { guardOrStop, permissionsMarkdown } from './lib/guard.ts';
import { anyPositive, historyWindows, MAX_HISTORY_DAYS } from './lib/history.ts';
import { BN_REPORT_NOTE, callsMarkdown } from './lib/report.ts';

const BALANCE_FIELDS = ['free', 'locked', 'freeze', 'withdrawing'];
const EARN_PAGE_SIZE = 100; // màxim documentat
const EARN_MAX_PAGES = 5;
const HISTORY_LIMIT = 1000; // màxim documentat
/** Pausa entre crides. La més restrictiva documentada és withdraw/history (10 peticions/s). */
const PAUSE_MS = 300;

interface StepResult {
  endpoint: EndpointName;
  ok: boolean;
  /** Nombre de registres retornats (no imports). */
  records?: number;
  /** Hi ha saldo > 0? (sí/no, sense imports) */
  hasBalance?: boolean;
  note?: string;
  error?: string;
}

const yesNo = (v: boolean | undefined) => (v === undefined ? '—' : v ? 'sí' : 'no');

run(async () => {
  const opts = args({ 'history-days': { type: 'string', default: '90' } });
  const historyDays = Number(opts['history-days']);
  if (!Number.isInteger(historyDays) || historyDays < 1 || historyDays > MAX_HISTORY_DAYS) {
    throw new SpikeError(`--history-days ha de ser un enter entre 1 i ${MAX_HISTORY_DAYS}.`);
  }

  const client = new BnClient(loadBnConfig());

  // 1. Primer pas obligatori.
  const guard = await guardOrStop(client, 'bn-fetch', 'Binance — lectura de saldos (G3)');
  console.log(`Clau de només lectura ✅ · restricció d'IP: ${guard.check.ipRestricted ? 'sí' : 'NO ⚠️'}`);

  const raw: Record<string, unknown> = { apiRestrictions: guard.raw };
  const results: StepResult[] = [];
  const wallets: { name: string; activate?: boolean; hasBalance: boolean }[] = [];

  const step = async (endpoint: EndpointName, fn: () => Promise<Omit<StepResult, 'endpoint' | 'ok'>>) => {
    if (client.halted) return;
    const label = ENDPOINTS[endpoint].label;
    try {
      const r = await fn();
      results.push({ endpoint, ok: true, ...r });
      console.log(`  ✓ ${label}${r.records !== undefined ? ` · registres: ${r.records}` : ''}${r.hasBalance !== undefined ? ` · amb saldo: ${yesNo(r.hasBalance)}` : ''}`);
    } catch (e) {
      if (!(e instanceof BinanceApiError)) throw e;
      const error = explainBinanceError(e);
      results.push({ endpoint, ok: false, error });
      console.error(`  ✗ ${label}: ${error}`);
    }
    await sleep(PAUSE_MS);
  };

  console.log('\nLectura (només GET/POST de consulta):');

  await step('account', async () => {
    const r = await client.signed<{ balances?: unknown[]; accountType?: string; permissions?: string[] }>('account', { omitZeroBalances: true });
    raw.account = r;
    const positive = (r.balances ?? []).filter((b) => anyPositive(b, BALANCE_FIELDS));
    return { records: positive.length, hasBalance: positive.length > 0, note: `accountType=${r.accountType ?? '?'}; permissions=${(r.permissions ?? []).join(',') || '—'}` };
  });

  await step('userAsset', async () => {
    const r = await client.signed<unknown[]>('userAsset');
    raw.userAsset = r;
    const list = Array.isArray(r) ? r : [];
    return { records: list.length, hasBalance: list.some((a) => anyPositive(a, BALANCE_FIELDS)) };
  });

  await step('fundingAsset', async () => {
    const r = await client.signed<unknown[]>('fundingAsset');
    raw.fundingAsset = r;
    const list = Array.isArray(r) ? r : [];
    return { records: list.length, hasBalance: list.some((a) => anyPositive(a, BALANCE_FIELDS)), note: 'Doc: només Binance Pay, Card, Gift Card i Stock Token' };
  });

  await step('walletBalance', async () => {
    const r = await client.signed<{ walletName?: string; activate?: boolean; balance?: string }[]>('walletBalance');
    raw.walletBalance = r;
    const list = Array.isArray(r) ? r : [];
    for (const w of list) wallets.push({ name: w.walletName ?? '?', activate: w.activate, hasBalance: Number(w.balance) > 0 });
    return { records: list.length, hasBalance: wallets.some((w) => w.hasBalance) };
  });

  for (const endpoint of ['earnFlexible', 'earnLocked'] as const) {
    await step(endpoint, async () => {
      const rows: unknown[] = [];
      let total = 0;
      let current = 1;
      do {
        const r = await client.signed<{ rows?: unknown[]; total?: number }>(endpoint, { current, size: EARN_PAGE_SIZE });
        rows.push(...(r.rows ?? []));
        total = r.total ?? rows.length;
        current++;
        if (rows.length < total) await sleep(PAUSE_MS);
      } while (rows.length < total && current <= EARN_MAX_PAGES && !client.halted);
      raw[endpoint] = { total, rows };
      return { records: total, hasBalance: total > 0, note: `${current - 1} pàgina(es)${rows.length < total ? ' (TALLAT)' : ''}` };
    });
  }

  const windows = historyWindows(Date.now(), historyDays);
  for (const endpoint of ['depositHistory', 'withdrawHistory'] as const) {
    await step(endpoint, async () => {
      const items: unknown[] = [];
      let truncated = 0;
      for (const [i, w] of windows.entries()) {
        if (i > 0) await sleep(PAUSE_MS);
        const r = await client.signed<unknown[]>(endpoint, { startTime: w.startTime, endTime: w.endTime, limit: HISTORY_LIMIT });
        const list = Array.isArray(r) ? r : [];
        items.push(...list);
        if (list.length >= HISTORY_LIMIT) truncated++;
        if (client.halted) break;
      }
      raw[endpoint] = items;
      return { records: items.length, note: `${windows.length} finestra(es) de ≤89 dies, ${historyDays} dies${truncated ? `; ${truncated} finestra(es) TALLADES a ${HISTORY_LIMIT}` : ''}` };
    });
  }

  if (client.halted) console.error(`\n⛔ Aturat: ${client.halted}`);

  const products: [string, boolean | undefined][] = [
    ['Spot (/api/v3/account)', results.find((r) => r.endpoint === 'account')?.hasBalance],
    ['Actius positius (getUserAsset)', results.find((r) => r.endpoint === 'userAsset')?.hasBalance],
    ['Funding (get-funding-asset)', results.find((r) => r.endpoint === 'fundingAsset')?.hasBalance],
    ['Simple Earn flexible', results.find((r) => r.endpoint === 'earnFlexible')?.hasBalance],
    ['Simple Earn locked', results.find((r) => r.endpoint === 'earnLocked')?.hasBalance],
  ];

  const md = [
    reportHeader('Binance — lectura de saldos (G3)', BN_REPORT_NOTE),
    `- Historial demanat: ${historyDays} dies`,
    client.halted ? `- **Aturat:** ${anonymizeCryptoText(client.halted)}` : '- Execució completa',
    '',
    '## Permisos de la clau',
    '',
    permissionsMarkdown(guard.check),
    '',
    '## Endpoints',
    '',
    mdTable(
      ['Endpoint', 'Ruta', 'Dades', 'Registres', 'Amb saldo', 'Notes', 'Error'],
      (Object.keys(ENDPOINTS) as EndpointName[])
        .filter((e) => e !== 'apiRestrictions')
        .map((e) => {
          const r = results.find((x) => x.endpoint === e);
          return [
            ENDPOINTS[e].label,
            `\`${ENDPOINTS[e].path}\``,
            !r ? 'no cridat' : r.ok ? 'sí' : 'error',
            r?.records,
            yesNo(r?.hasBalance),
            r?.note,
            r?.error?.split('\n')[0],
          ];
        }),
    ),
    '',
    '## Productes amb saldo (sí/no)',
    '',
    mdTable(['Producte', 'Saldo > 0'], products.map(([p, v]) => [p, yesNo(v)])),
    '',
    '### Saldo per wallet (`/sapi/v1/asset/wallet/balance`)',
    '',
    wallets.length ? mdTable(['Wallet', 'Activa', 'Saldo > 0'], wallets.map((w) => [w.name, yesNo(w.activate), yesNo(w.hasBalance)])) : '_Sense dades._',
    '',
    '## Crides i pes',
    '',
    callsMarkdown(client),
  ].join('\n');

  writeOutputs('bn-fetch', raw, md);
}, (e) => (e instanceof BinanceApiError ? explainBinanceError(e) : undefined));
