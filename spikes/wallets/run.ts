/**
 * npm run wallets
 * Gate G4: public-address balance lookups (BTC via mempool.space, EVM via Etherscan API V2).
 *
 * mempool.space — GET https://mempool.space/api/address/:address
 *   Docs: https://mempool.space/docs/api/rest ("Get Address"): fields address, chain_stats,
 *   mempool_stats {tx_count, funded_txo_count, funded_txo_sum, spent_txo_count, spent_txo_sum}.
 *   Rate limits are enforced (HTTP 429) but not quantified; we space calls by 1 s.
 * Etherscan API V2 — GET https://api.etherscan.io/v2/api?chainid=..&module=account&action=balancemulti
 *   Docs: https://docs.etherscan.io/api-reference/endpoint/balancemulti (max 20 addresses/call)
 *         https://docs.etherscan.io/api-reference/endpoint/chainlist (GET /v2/chainlist)
 *         https://docs.etherscan.io/rate-limits (free: 3 calls/s, 100k/day, "selected chains only")
 *         https://docs.etherscan.io/common-error-messages
 * The apikey travels in the query string; URLs are never logged or stored.
 */
import { cell, maskCryptoAddress } from '../shared/anonymize.ts';
import { optionalEnv, requireEnv, SpikeError } from '../shared/env.ts';
import { httpRequest, sleep, type HttpResult } from '../shared/http.ts';
import { REPORT_FOOTER, writeOutputs } from '../shared/report.ts';
import { listLooksLikeSeed, splitList, validateBtcAddress, validateEvmAddress } from './validate.ts';

const MEMPOOL = 'https://mempool.space/api';
const ETHERSCAN = 'https://api.etherscan.io/v2';

interface Row {
  kind: string;
  target: string;
  label: string;
  status: number;
  latency_ms: number;
  ok: boolean;
  detail: string;
  headers: Record<string, string>;
}

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

async function main() {
  const btcRaw = splitList(optionalEnv('BTC_ADDRESSES'));
  const evmRaw = splitList(optionalEnv('EVM_ADDRESSES'));
  const chains = splitList(optionalEnv('EVM_CHAINS') ?? '1');
  if (btcRaw.length === 0 && evmRaw.length === 0) throw new SpikeError('Defineix BTC_ADDRESSES i/o EVM_ADDRESSES a spikes/.env');

  // ---- Validate everything before any network call. Never echo invalid inputs. ----
  const problems: string[] = [];
  if (listLooksLikeSeed(btcRaw)) problems.push('BTC_ADDRESSES sembla una seed phrase separada per comes');
  if (listLooksLikeSeed(evmRaw)) problems.push('EVM_ADDRESSES sembla una seed phrase separada per comes');
  const btc = btcRaw.map((a, i) => {
    const v = validateBtcAddress(a);
    if (!v.ok) problems.push(`BTC_ADDRESSES[${i}]: ${v.reason}`);
    return v;
  });
  const evm = evmRaw.map((a, i) => {
    const v = validateEvmAddress(a);
    if (!v.ok) problems.push(`EVM_ADDRESSES[${i}]: ${v.reason}`);
    return v;
  });
  chains.forEach((c, i) => {
    if (!/^\d{1,12}$/.test(c)) problems.push(`EVM_CHAINS[${i}]: ha de ser un chainid numèric (p. ex. 1, 42161)`);
  });
  if (problems.length) throw new SpikeError(`Entrades rebutjades (no s’ha fet cap crida):\n  - ${problems.join('\n  - ')}`);

  const apiKey = evm.length ? requireEnv('ETHERSCAN_API_KEY') : undefined;
  const raw: Record<string, unknown> = { generated_at: new Date().toISOString(), calls: [] as unknown[] };
  const rows: Row[] = [];
  const push = (kind: string, target: string, r: HttpResult, ok: boolean, detail: string) => {
    (raw.calls as unknown[]).push({ kind, target, label: r.label, status: r.status, latency_ms: r.latencyMs, headers: r.rateLimitHeaders, body: r.body });
    rows.push({ kind, target, label: r.label, status: r.status, latency_ms: r.latencyMs, ok, detail, headers: r.rateLimitHeaders });
  };

  // ---- BTC ----
  for (const v of btc) {
    if (!v.ok) continue;
    const r = await httpRequest('GET /api/address/{addr}', `${MEMPOOL}/address/${encodeURIComponent(v.value)}`);
    const b = (r.body ?? {}) as Record<string, unknown>;
    const ok = r.ok && typeof b.chain_stats === 'object' && typeof b.mempool_stats === 'object';
    push('BTC (mempool.space)', `${maskCryptoAddress(v.value)} [${v.type}]`, r, ok,
      ok ? 'chain_stats + mempool_stats rebuts' : r.networkError ?? (r.status === 429 ? '429 rate limit' : `resposta inesperada`));
    if (r.status === 429) break; // do not hammer a public service
    await sleep(1000);
  }

  // ---- EVM ----
  if (evm.length) {
    const cl = await httpRequest('GET /v2/chainlist', `${ETHERSCAN}/chainlist`);
    const list = ((cl.body as { result?: Array<{ chainid: string; chainname: string; status: number | string }> })?.result ?? []);
    push('Etherscan chainlist', '—', cl, cl.ok && list.length > 0, cl.ok ? `${list.length} cadenes` : 'error');
    const addrs = evm.filter((v) => v.ok).map((v) => v.value);
    for (const chainid of chains) {
      const meta = list.find((c) => String(c.chainid) === chainid);
      for (const group of chunk(addrs, 20)) {
        await sleep(400); // free tier: 3 calls/s
        const q = new URLSearchParams({ chainid, module: 'account', action: 'balancemulti', address: group.join(','), tag: 'latest', apikey: apiKey! });
        const r = await httpRequest(`GET /v2/api balancemulti chainid=${chainid}`, `${ETHERSCAN}/api?${q.toString()}`);
        const b = (r.body ?? {}) as { status?: string; message?: string; result?: unknown };
        const ok = r.ok && b.status === '1' && Array.isArray(b.result);
        const detail = ok
          ? `${(b.result as unknown[]).length}/${group.length} adreces amb resposta`
          : r.networkError ?? `${b.message ?? ''}: ${typeof b.result === 'string' ? b.result : ''}`.trim();
        push(`EVM ${meta ? `${meta.chainname} ` : ''}(chainid ${chainid}${meta ? `, status ${meta.status}` : ', no és a chainlist'})`,
          group.map(maskCryptoAddress).join(', '), r, ok, detail);
      }
    }
  }

  // ---- Report (no balances) ----
  let md = `# Wallets — spike (G4)\n\nGenerat: ${new Date().toISOString()}\n\n`;
  md += `Adreces validades: BTC ${btc.length} · EVM ${evm.length} · cadenes EVM: ${chains.join(', ') || '—'}\n\n`;
  md += `| Font | Adreça(es) | Crida | HTTP | Latència (ms) | Resultat | Capçaleres de rate limit |\n|---|---|---|---|---|---|---|\n`;
  for (const r of rows) {
    const hdr = Object.entries(r.headers).map(([k, v]) => `${k}=${v}`).join(' ');
    md += `| ${cell(r.kind)} | ${cell(r.target)} | \`${cell(r.label)}\` | ${r.status} | ${r.latency_ms} | ${r.ok ? '✅' : '❌'} ${cell(r.detail)} | ${cell(hdr || 'cap')} |\n`;
  }
  md += `\nSaldos: només al fitxer raw (no compartir).\n${REPORT_FOOTER}`;

  const out = writeOutputs('wallets', raw, md, [apiKey]);
  console.log(`Fet: ${rows.filter((r) => r.ok).length}/${rows.length} consultes OK.`);
  console.log(`Raw (no compartir): ${out.rawPath}\nInforme (compartible): ${out.reportPath}`);
  if (rows.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch((e: Error) => {
  console.error(e instanceof SpikeError ? `ERROR: ${e.message}` : `ERROR inesperat: ${e.name}: ${e.message}`);
  process.exit(1);
});
