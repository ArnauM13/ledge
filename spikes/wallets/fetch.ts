// npm run wallets:fetch
// Consulta adreces PÚBLIQUES (mai seeds ni claus privades). Read-only, sense reintents.
//
// BTC — mempool.space REST: GET /api/address/:address
//   Docs: https://mempool.space/docs/api/rest  (verificat el 31/10/2026)
//   Camps: address, chain_stats, mempool_stats ({tx_count, funded_txo_count, funded_txo_sum, spent_txo_count, spent_txo_sum}).
//   Límits: "we enforce rate limits. If you exceed these limits, you will get an HTTP 429 error" — no en publica xifres
//   ni capçaleres, per això el spike va a poc a poc i registra qualsevol capçalera de rate limit que arribi.
//
// EVM — Etherscan API V2: GET https://api.etherscan.io/v2/api?chainid=…&module=account&action=balancemulti&address=a,b&tag=latest&apikey=…
//   Docs: https://docs.etherscan.io/api-reference/endpoint/balancemulti (màx. 20 adreces per crida; saldo en wei)
//         https://docs.etherscan.io/rate-limits (Free: 3 crides/s, 100.000/dia, "selected chains only")
//         https://docs.etherscan.io/supported-chains (quines cadenes inclou el pla gratuït)
//         https://docs.etherscan.io/common-error-messages (errors: status "0", message "NOTOK", detall a `result`)
//   Un sol chainid per crida.
import { anonymizeCryptoText, maskAddress } from '../lib/anonymize.ts';
import { run, sleep } from '../lib/cli.ts';
import { mdTable, reportHeader, writeOutputs } from '../lib/report.ts';
import { ETHERSCAN_V2_BASE, loadWalletsConfig } from './lib/config.ts';

const BTC_PAUSE_MS = 1_000; // mempool.space no publica el límit: anem a 1 crida/s
const EVM_PAUSE_MS = 400; // Free tier: 3 crides/s

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 10: 'Optimism', 56: 'BNB Smart Chain', 137: 'Polygon', 8453: 'Base', 42161: 'Arbitrum One', 43114: 'Avalanche C-Chain',
};

interface CallResult {
  label: string;
  status: number;
  ms: number;
  ok: boolean;
  /** Capçaleres relacionades amb rate limits (si n'hi ha). */
  rateHeaders: Record<string, string>;
  error?: string;
}

/** Capçaleres que semblen de rate limit (cap de les dues APIs en documenta cap). */
function rateHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    if (/rate|limit|retry-after|quota/i.test(k)) out[k.toLowerCase()] = v;
  });
  return out;
}

async function timedGet(url: URL): Promise<{ res?: Response; ms: number; text: string; networkError?: string }> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    return { res, ms: Math.round(performance.now() - t0), text };
  } catch (e) {
    return { ms: Math.round(performance.now() - t0), text: '', networkError: (e as Error).message };
  }
}

const fmtHeaders = (h: Record<string, string>) => (Object.keys(h).length ? Object.entries(h).map(([k, v]) => `${k}=${v}`).join(', ') : 'cap');

run(async () => {
  const cfg = loadWalletsConfig();
  const raw: { btc: unknown[]; evm: unknown[] } = { btc: [], evm: [] };
  const btcResults: (CallResult & { type: string })[] = [];
  const evmResults: (CallResult & { chainid: number; requested: number; returned: number })[] = [];
  let stop: string | undefined;

  // --- BTC ---
  if (cfg.btc.length) console.log(`BTC (${cfg.btc.length} adreces) via ${new URL(cfg.mempoolBase).host}:`);
  for (const [i, { address, type }] of cfg.btc.entries()) {
    if (stop) break;
    if (i > 0) await sleep(BTC_PAUSE_MS);
    const url = new URL(`${cfg.mempoolBase}/address/${address}`);
    const { res, ms, text, networkError } = await timedGet(url);
    const r: CallResult & { type: string } = { label: maskAddress(address), type, status: res?.status ?? 0, ms, ok: false, rateHeaders: res ? rateHeaders(res.headers) : {} };
    let json: any;
    try { json = JSON.parse(text); } catch { json = undefined; }
    if (networkError) r.error = `Error de xarxa: ${networkError}`;
    else if (!res!.ok) r.error = `HTTP ${res!.status}: ${anonymizeCryptoText(text.slice(0, 200))}`;
    else if (!json?.chain_stats || !json?.mempool_stats) r.error = 'Resposta sense chain_stats/mempool_stats';
    else r.ok = true;
    if (res?.status === 429) stop = 'mempool.space ha retornat 429 (rate limit). Aturat.';
    btcResults.push(r);
    raw.btc.push({ address, type, status: r.status, ms, rateHeaders: r.rateHeaders, body: json ?? text.slice(0, 500) });
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.label} (${type}) · HTTP ${r.status || 'xarxa'} · ${ms} ms${r.error ? ` · ${r.error}` : ''}`);
  }

  // --- EVM ---
  if (cfg.evm.length && !stop) console.log(`\nEVM (${cfg.evm.length} adreces × ${cfg.chains.length} cadenes) via Etherscan V2:`);
  for (const [i, chainid] of cfg.chains.entries()) {
    if (stop || !cfg.evm.length) break;
    if (i > 0) await sleep(EVM_PAUSE_MS);
    const url = new URL(ETHERSCAN_V2_BASE);
    url.search = new URLSearchParams({
      chainid: String(chainid), module: 'account', action: 'balancemulti', address: cfg.evm.join(','), tag: 'latest',
    }).toString();
    const publicUrl = url.toString(); // sense apikey: és el que es desa al raw
    url.searchParams.set('apikey', cfg.etherscanApiKey!);

    const got = await timedGet(url);
    const { res, ms, text } = got;
    const networkError = got.networkError?.replaceAll(cfg.etherscanApiKey!, '<apikey>');
    const label = `${chainid} (${CHAIN_NAMES[chainid] ?? '?'})`;
    const r = { label, chainid, requested: cfg.evm.length, returned: 0, status: res?.status ?? 0, ms, ok: false, rateHeaders: res ? rateHeaders(res.headers) : {} } as CallResult & { chainid: number; requested: number; returned: number };
    let json: any;
    try { json = JSON.parse(text); } catch { json = undefined; }

    if (networkError) r.error = `Error de xarxa: ${networkError}`;
    else if (!res!.ok) r.error = `HTTP ${res!.status}`;
    else if (json?.status !== '1') {
      const detail = typeof json?.result === 'string' ? json.result : json?.message ?? text.slice(0, 200);
      r.error = `status ${json?.status ?? '?'} ${json?.message ?? ''}: ${anonymizeCryptoText(String(detail))}`.trim();
      if (/rate limit|limit reached/i.test(String(detail))) stop = `Etherscan: límit de crides (${anonymizeCryptoText(String(detail))}). Aturat.`;
      if (/invalid api ?key/i.test(String(detail))) stop = 'Etherscan: clau invàlida. Aturat.';
    } else if (!Array.isArray(json.result)) r.error = 'result no és una llista';
    else {
      const wanted = new Set(cfg.evm.map((a) => a.toLowerCase()));
      r.returned = json.result.filter((x: any) => typeof x?.account === 'string' && wanted.has(x.account.toLowerCase())).length;
      r.ok = r.returned === r.requested;
      if (!r.ok) r.error = `Només ${r.returned}/${r.requested} adreces a la resposta`;
    }
    if (res?.status === 429) stop = 'Etherscan ha retornat HTTP 429. Aturat.';
    evmResults.push(r);
    raw.evm.push({ url: publicUrl, chainid, status: r.status, ms, rateHeaders: r.rateHeaders, body: json ?? text.slice(0, 500) });
    console.log(`  ${r.ok ? '✓' : '✗'} chainid ${label} · HTTP ${r.status || 'xarxa'} · ${ms} ms${r.error ? ` · ${r.error}` : ''}`);
  }

  if (stop) console.error(`\n⛔ ${stop}`);

  const md = [
    reportHeader('Wallets — BTC i EVM (G4)', 'Informe anonimitzat: adreces emmascarades (p. ex. bc1q…a1b2), sense saldos, imports ni historial.'),
    `- Adreces BTC: ${cfg.btc.length} · Adreces EVM: ${cfg.evm.length} · Cadenes EVM: ${cfg.evm.length ? cfg.chains.join(', ') : '—'}`,
    stop ? `- **Aturat:** ${stop}` : '- Execució completa',
    '',
    '## BTC — mempool.space `GET /api/address/:address`',
    '',
    btcResults.length
      ? mdTable(['Adreça', 'Tipus', 'HTTP', 'Latència (ms)', 'OK', 'Capçaleres de rate limit', 'Error'],
          btcResults.map((r) => [r.label, r.type, r.status || 'xarxa', r.ms, r.ok ? 'sí' : 'no', fmtHeaders(r.rateHeaders), r.error]))
      : '_No s\'ha consultat cap adreça BTC._',
    '',
    '## EVM — Etherscan V2 `module=account&action=balancemulti`',
    '',
    evmResults.length
      ? mdTable(['Cadena (chainid)', 'HTTP', 'Latència (ms)', 'Adreces retornades', 'OK', 'Capçaleres de rate limit', 'Error'],
          evmResults.map((r) => [r.label, r.status || 'xarxa', r.ms, `${r.returned}/${r.requested}`, r.ok ? 'sí' : 'no', fmtHeaders(r.rateHeaders), r.error]))
      : '_No s\'ha consultat cap cadena EVM._',
    '',
    cfg.evm.length ? `Adreces EVM consultades: ${cfg.evm.map(maskAddress).join(', ')}` : '',
  ].join('\n');

  writeOutputs('wallets-fetch', raw, md);
});
