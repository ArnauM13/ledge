// npm run eb:fetch [-- --member A] [--date-from 2024-01-01] [--max-pages 50] [--no-transactions]
// Docs: https://enablebanking.com/docs/api/reference
//   GET /sessions/{session_id}, GET /accounts/{id}/balances, GET /accounts/{id}/transactions
// Per a l'historial es fa servir strategy=longest ("tries to find the longest possible period";
// pot fer crides extra al banc). Atenció: molts bancs permeten només 4 consultes/dia sense l'usuari present.
import { anonymizeText, maskIban, shortHash } from '../lib/anonymize.ts';
import { args, parseMember, run } from './lib/cli.ts';
import { callsTable, EbApiError, EbClient, explainError } from './lib/client.ts';
import { SpikeError } from '../lib/env.ts';
import { loadEbConfig } from './lib/config.ts';
import { mdTable, reportHeader, writeOutputs } from '../lib/report.ts';
import { loadSession } from './lib/session-store.ts';
import type { AccountResource, Balance, SessionInfo, Transaction, TransactionsPage } from './lib/types.ts';

interface AccountResult {
  uid: string;
  meta?: AccountResource;
  balances?: Balance[];
  balancesError?: string;
  transactions?: Transaction[];
  transactionsError?: string;
  pages?: number;
  truncated?: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateRange(txs: Transaction[]): { from?: string; to?: string } {
  const dates = txs.map((t) => t.booking_date ?? t.value_date ?? t.transaction_date).filter((d): d is string => !!d).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

function daysBetween(from?: string, to?: string): string {
  if (!from || !to) return '—';
  return String(Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
}

run(async () => {
  const opts = args({
    member: { type: 'string', default: 'A' },
    'date-from': { type: 'string' },
    'max-pages': { type: 'string', default: '50' },
    'no-transactions': { type: 'boolean', default: false },
  });
  const member = parseMember(opts.member);
  const dateFrom = opts['date-from'];
  if (dateFrom && !DATE_RE.test(dateFrom)) throw new SpikeError('--date-from ha de tenir el format AAAA-MM-DD.');
  const maxPages = Number(opts['max-pages']);
  if (!Number.isInteger(maxPages) || maxPages < 1) throw new SpikeError('--max-pages ha de ser un enter positiu.');

  const stored = loadSession(member);
  const client = new EbClient(loadEbConfig());
  const results: AccountResult[] = [];
  let stopReason: string | undefined;

  // 1. Estat de la sessió.
  const info = await client.request<SessionInfo>('GET', `/sessions/${stored.session_id}`);
  console.log(`Sessió del membre ${member}: estat ${info.status ?? '?'}, vàlida fins a ${info.access?.valid_until ?? '?'}`);
  const uids = info.accounts ?? stored.accounts.map((a) => a.uid).filter((u): u is string => !!u);

  if (info.status && info.status !== 'AUTHORIZED') {
    stopReason = `La sessió està en estat ${info.status}. Torna a executar eb:connect.`;
  } else {
    // 2. Per cada compte: saldos i moviments. Seqüencial i sense reintents automàtics.
    for (const [i, uid] of uids.entries()) {
      const r: AccountResult = { uid, meta: stored.accounts.find((a) => a.uid === uid) };
      results.push(r);
      console.log(`\nCompte ${i + 1}/${uids.length} (${maskIban(r.meta?.account_id?.iban)})`);

      try {
        const b = await client.request<{ balances?: Balance[] }>('GET', `/accounts/${uid}/balances`, { psu: true });
        r.balances = b.balances ?? [];
        console.log(`  saldos: ${r.balances.length} (${r.balances.map((x) => x.balance_type).join(', ')})`);
      } catch (e) {
        if (!(e instanceof EbApiError)) throw e;
        r.balancesError = explainError(e);
        console.error(`  saldos: ✗ ${r.balancesError}`);
        if (e.isRateLimit || e.isSessionGone) { stopReason = r.balancesError; break; }
      }

      if (opts['no-transactions']) continue;
      try {
        const txs: Transaction[] = [];
        let key: string | undefined;
        let pages = 0;
        do {
          const page: TransactionsPage = await client.request<TransactionsPage>('GET', `/accounts/${uid}/transactions`, {
            query: { strategy: 'longest', date_from: dateFrom, continuation_key: key },
            psu: true,
          });
          txs.push(...(page.transactions ?? []));
          key = page.continuation_key ?? undefined;
          pages++;
        } while (key && pages < maxPages);
        r.transactions = txs;
        r.pages = pages;
        r.truncated = Boolean(key);
        const range = dateRange(txs);
        console.log(`  moviments: ${txs.length} en ${pages} pàgina(es), de ${range.from ?? '?'} a ${range.to ?? '?'}${r.truncated ? ' (TALLAT per --max-pages)' : ''}`);
      } catch (e) {
        if (!(e instanceof EbApiError)) throw e;
        r.transactionsError = explainError(e);
        console.error(`  moviments: ✗ ${r.transactionsError}`);
        if (e.isRateLimit || e.isSessionGone) { stopReason = r.transactionsError; break; }
      }
    }
  }

  if (stopReason) console.error(`\n⛔ Aturat: ${stopReason}`);

  const validUntil = info.access?.valid_until;
  const daysLeft = validUntil ? Math.round((Date.parse(validUntil) - Date.now()) / 86_400_000) : undefined;

  const md = [
    reportHeader(`Enable Banking — saldos i moviments (membre ${member})`),
    `- ASPSP: ${info.aspsp?.name ?? stored.aspsp?.name ?? '—'}`,
    `- Estat de la sessió: ${info.status ?? '—'}`,
    `- Consentiment vàlid fins a: ${validUntil?.slice(0, 10) ?? '—'}${daysLeft !== undefined ? ` (${daysLeft} dies)` : ''}`,
    `- Comptes a la sessió: **${uids.length}**${uids.length === 0 ? ' ← llista buida' : ''}`,
    `- Estratègia de moviments: strategy=longest${dateFrom ? `, date_from=${dateFrom}` : ''}`,
    `- Capçaleres PSU enviades: ${client.psuHeadersEnabled ? 'sí' : 'no'}`,
    stopReason ? `- **Aturat:** ${anonymizeText(stopReason)}` : '- Execució completa',
    '',
    '## Comptes',
    '',
    results.length
      ? mdTable(
          ['#', 'Ref.', 'IBAN', 'Tipus', 'Moneda', 'Tipus de saldo', 'Moviments', 'Primer', 'Últim', 'Dies d\'historial', 'Pàgines', 'Errors'],
          results.map((r, i) => {
            const range = dateRange(r.transactions ?? []);
            return [
              i + 1,
              shortHash(r.uid),
              maskIban(r.meta?.account_id?.iban),
              r.meta?.cash_account_type,
              r.meta?.currency,
              r.balances?.map((b) => b.balance_type).join(', '),
              r.transactions?.length,
              range.from,
              range.to,
              daysBetween(range.from, range.to),
              r.pages ? `${r.pages}${r.truncated ? ' (tallat)' : ''}` : undefined,
              [r.balancesError, r.transactionsError].filter(Boolean).map((x) => anonymizeText(x!.split('\n')[0]!)).join(' / '),
            ];
          }),
        )
      : '_Cap compte consultat._',
    '',
    '## Crides',
    '',
    callsTable(client.calls),
  ].join('\n');

  writeOutputs(`eb-fetch-${member}`, { session: info, accounts: results }, md);
});
