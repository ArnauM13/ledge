/**
 * npm run eb:fetch [-- --member A|B] [--date-from YYYY-MM-DD] [--max-pages 20] [--force]
 * Gates G1/G2: balances + transaction history for every account in the stored session.
 *
 * Endpoints (https://enablebanking.com/docs/api/reference):
 *   GET /sessions/{session_id}                 ("Get session data": status, accounts (uids), access.valid_until)
 *   GET /accounts/{account_id}/balances        ("Get account balances": balances[].balance_type ...)
 *   GET /accounts/{account_id}/transactions    ("Get account transactions": date_from, date_to,
 *                                               continuation_key, transaction_status, strategy)
 * By default we send `strategy=longest` ("finds the longest available period"), i.e. the oldest
 * history the bank allows. With --date-from we use the default strategy with an explicit date_from.
 *
 * Rate limits: many ASPSPs allow 4 fetches/day without the PSU present. This script:
 *  - never retries an ASPSP call;
 *  - stops everything on 429 / ASPSP_RATE_LIMIT_EXCEEDED (wait >= 6 h);
 *  - stops everything on EXPIRED_SESSION / CLOSED_SESSION / REVOKED_SESSION / SESSION_DOES_NOT_EXIST;
 *  - keeps a local log and refuses a 5th run in 24 h unless --force.
 */
import { argString, parseArgs } from '../lib/args.ts';
import { cell, maskIban, maskId } from '../lib/anonymize.ts';
import { SpikeError } from '../lib/env.ts';
import { sleep, type HttpResult } from '../lib/http.ts';
import { REPORT_FOOTER, writeOutputs } from '../lib/report.ts';
import { EB_RATE_LIMIT_CODES, EB_SESSION_DEAD_CODES, EbClient, ebErrorInfo, type EbErrorInfo } from './client.ts';
import { fetchRunsLast24h, loadSession, MAX_FETCH_RUNS_PER_DAY, memberLabel, recordFetchRun } from './store.ts';
import { daysUntil, summarizeTransactions, type TxLike, type TxSummary } from './summary.ts';

interface AccountResult {
  uid: string;
  iban_masked: string;
  cash_account_type: string;
  currency: string;
  balance_types: string[];
  balances_error: EbErrorInfo | null;
  tx: (TxSummary & { pages: number; truncated: boolean }) | null;
  tx_error: EbErrorInfo | null;
}

type StopReason = null | 'RATE_LIMIT' | 'SESSION';

function classify(r: HttpResult): StopReason {
  const e = ebErrorInfo(r);
  if (r.status === 429 || (e.error && EB_RATE_LIMIT_CODES.has(e.error))) return 'RATE_LIMIT';
  if (e.error && EB_SESSION_DEAD_CODES.has(e.error)) return 'SESSION';
  return null;
}

async function main() {
  const args = parseArgs();
  const member = memberLabel(argString(args, 'member'));
  const dateFrom = argString(args, 'date-from');
  if (dateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) throw new SpikeError('--date-from ha de ser YYYY-MM-DD');
  const maxPages = Number(argString(args, 'max-pages') ?? 20);
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 200) throw new SpikeError('--max-pages ha de ser 1..200');
  const force = args.force === true;

  const stored = loadSession(member);
  if (!stored) throw new SpikeError(`No hi ha cap sessió desada per al membre ${member}. Executa npm run eb:connect -- --aspsp BBVA --member ${member}`);

  const client = new EbClient();
  const raw: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    member,
    psu_headers_sent: client.psuPresent,
    strategy: dateFrom ? { date_from: dateFrom } : { strategy: 'longest' },
    calls: [] as unknown[],
  };
  const log = (r: HttpResult) =>
    (raw.calls as unknown[]).push({ label: r.label, status: r.status, latency_ms: r.latencyMs, body: r.body });
  const errors: string[] = [];
  let stop: StopReason = null;

  // 1) Session status (Enable Banking side; does not query the bank).
  const sRes = await client.get('GET /sessions/{id}', `/sessions/${encodeURIComponent(stored.session_id)}`);
  log(sRes);
  const session = (sRes.ok ? sRes.body : null) as null | {
    status?: string;
    accounts?: string[];
    access?: { valid_until?: string };
  };
  if (!sRes.ok) {
    const e = ebErrorInfo(sRes);
    errors.push(`GET /sessions/{id}: HTTP ${e.http_status} ${e.error ?? ''} ${e.message ?? ''}`);
    stop = classify(sRes) ?? 'SESSION';
  } else if (session?.status !== 'AUTHORIZED') {
    errors.push(`La sessió no està AUTHORIZED (status=${session?.status ?? '?'})`);
    stop = 'SESSION';
  }

  const uids = session?.accounts ?? [];
  const results: AccountResult[] = [];
  let aspspCalls = 0;

  if (!stop && uids.length > 0) {
    const runs = fetchRunsLast24h(member);
    if (runs >= MAX_FETCH_RUNS_PER_DAY && !force) {
      throw new SpikeError(
        `Ja hi ha ${runs} execucions d’eb:fetch en 24 h per al membre ${member} (límit habitual sense PSU: ${MAX_FETCH_RUNS_PER_DAY}). Espera o usa --force si saps el que fas.`,
      );
    }
    recordFetchRun(member);

    for (const uid of uids) {
      if (stop) break;
      const acc = stored.accounts.find((a) => a.uid === uid);
      const r: AccountResult = {
        uid,
        iban_masked: maskIban(acc?.account_id?.iban),
        cash_account_type: acc?.cash_account_type ?? '?',
        currency: acc?.currency ?? '?',
        balance_types: [],
        balances_error: null,
        tx: null,
        tx_error: null,
      };
      results.push(r);

      // 2) Balances
      const bRes = await client.get('GET /accounts/{uid}/balances', `/accounts/${encodeURIComponent(uid)}/balances`, { psu: true });
      aspspCalls++;
      log(bRes);
      if (bRes.ok) {
        const bal = ((bRes.body as { balances?: Array<{ balance_type?: string }> }).balances ?? []);
        r.balance_types = [...new Set(bal.map((b) => b.balance_type ?? '?'))];
      } else {
        r.balances_error = ebErrorInfo(bRes);
        errors.push(`balances ${maskId(uid)}: HTTP ${r.balances_error.http_status} ${r.balances_error.error ?? ''} ${r.balances_error.message ?? ''}`);
        stop = classify(bRes);
        if (stop) break;
      }
      await sleep(1000);

      // 3) Transactions (paginated with continuation_key)
      const all: TxLike[] = [];
      let key: string | undefined;
      let pages = 0;
      let truncated = false;
      do {
        const q = new URLSearchParams(dateFrom ? { date_from: dateFrom } : { strategy: 'longest' });
        if (key) q.set('continuation_key', key);
        const tRes = await client.get(
          'GET /accounts/{uid}/transactions',
          `/accounts/${encodeURIComponent(uid)}/transactions?${q.toString()}`,
          { psu: true },
        );
        aspspCalls++;
        pages++;
        log(tRes);
        if (!tRes.ok) {
          r.tx_error = ebErrorInfo(tRes);
          errors.push(`transactions ${maskId(uid)} (pàgina ${pages}): HTTP ${r.tx_error.http_status} ${r.tx_error.error ?? ''} ${r.tx_error.message ?? ''}`);
          stop = classify(tRes);
          break;
        }
        const body = tRes.body as { transactions?: TxLike[]; continuation_key?: string | null };
        all.push(...(body.transactions ?? []));
        key = body.continuation_key || undefined;
        if (key && pages >= maxPages) {
          truncated = true;
          break;
        }
        if (key) await sleep(1000);
      } while (key);
      r.tx = { ...summarizeTransactions(all), pages, truncated };
      await sleep(1000);
    }
  }

  raw.session_status = session?.status ?? null;
  raw.valid_until = session?.access?.valid_until ?? stored.access?.valid_until ?? null;
  raw.aspsp_calls = aspspCalls;
  raw.stop_reason = stop;

  // ---- Report ----
  const validUntil = (raw.valid_until as string | null) ?? undefined;
  let md = `# Enable Banking — fetch (membre ${member})\n\nGenerat: ${new Date().toISOString()}\n\n`;
  md += `- ASPSP: ${cell(stored.aspsp.name)} (${stored.aspsp.country})\n`;
  md += `- Sessió: ${maskId(stored.session_id)} · status: **${cell(session?.status ?? 'desconegut')}**\n`;
  md += `- Consentiment valid_until: ${validUntil ?? '?'}${daysUntil(validUntil) !== null ? ` (queden ${daysUntil(validUntil)} dies)` : ''}\n`;
  md += `- Comptes a la sessió (GET /sessions): **${uids.length}**${uids.length === 0 && session ? ' — **llista buida** (mode restringit: comptes no vinculats a l’app?)' : ''}\n`;
  md += `- Comptes retornats a la creació (POST /sessions): ${stored.accounts.length}\n`;
  md += `- Estratègia d’historial: ${dateFrom ? `date_from=${dateFrom}` : 'strategy=longest'}\n`;
  md += `- Capçaleres PSU enviades: ${client.psuPresent ? 'sí' : 'no'} · crides a l’ASPSP: ${aspspCalls}\n`;
  md += `- Aturada anticipada: ${stop === 'RATE_LIMIT' ? '**sí — límit de l’ASPSP (espera ≥ 6 h)**' : stop === 'SESSION' ? '**sí — sessió no vàlida (cal reconnectar; recorda: Redsys = 1 sessió activa)**' : 'no'}\n\n`;
  md += `## Comptes\n\n| # | IBAN | tipus | moneda | tipus de saldo | # moviments | primer | darrer | dies d’historial | pàgines | estats | errors |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
  results.forEach((r, i) => {
    const errs = [r.balances_error, r.tx_error].filter(Boolean).map((e) => `${e!.http_status} ${e!.error ?? ''}`).join('; ');
    md += `| ${i + 1} | ${r.iban_masked} | ${cell(r.cash_account_type)} | ${cell(r.currency)} | ${cell(r.balance_types.join(', ') || '—')} | ${r.tx?.count ?? '—'} | ${r.tx?.earliest ?? '—'} | ${r.tx?.latest ?? '—'} | ${r.tx?.span_days ?? '—'} | ${r.tx ? `${r.tx.pages}${r.tx.truncated ? ' (tallat)' : ''}` : '—'} | ${cell(r.tx ? Object.entries(r.tx.by_status).map(([k, v]) => `${k}:${v}`).join(' ') : '—')} | ${cell(errs || '—')} |\n`;
  });
  md += `\n## Gate G2 (aquest membre)\n\n`;
  md += uids.length > 0
    ? `- L’API **retorna ${uids.length} compte(s)** per a aquest membre.\n`
    : `- L’API **retorna una llista buida** per a aquest membre.\n`;
  md += `\n## Errors (codi exacte)\n\n${errors.length ? errors.map((e) => `- ${cell(e.trim())}`).join('\n') : '- Cap'}\n${REPORT_FOOTER}`;

  const out = writeOutputs(`eb-fetch-${member}`, raw, md, [process.env.EB_APP_ID], [stored.session_id, ...uids]);
  console.log(`Comptes: ${uids.length} · crides ASPSP: ${aspspCalls} · errors: ${errors.length}${stop ? ` · aturat (${stop})` : ''}`);
  console.log(`Raw (no compartir): ${out.rawPath}\nInforme (compartible): ${out.reportPath}`);
  if (errors.length) process.exitCode = 1;
}

main().catch((e: Error) => {
  console.error(e instanceof SpikeError ? `ERROR: ${e.message}` : `ERROR inesperat: ${e.name}: ${e.message}`);
  process.exit(1);
});
