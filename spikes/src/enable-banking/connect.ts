/**
 * npm run eb:connect -- --aspsp BBVA [--member A|B] [--days N] [--country ES]
 * Gates G1/G2: start a consent, let the PSU do SCA in the browser, create a session.
 *
 * Endpoints (https://enablebanking.com/docs/api/reference):
 *   GET  /aspsps?country=ES   -> exact ASPSP name + maximum_consent_validity (seconds)
 *   POST /auth                -> { url, authorization_id, psu_id_hash }  ("Start user authorization")
 *   POST /sessions { code }   -> { session_id, accounts: AccountResource[], aspsp, psu_type, access }
 *
 * Read-only: access = balances + transactions only. No payment endpoints are used.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { argString, parseArgs } from '../lib/args.ts';
import { cell, maskIban, maskId } from '../lib/anonymize.ts';
import { requireEnv, SpikeError } from '../lib/env.ts';
import { ask, confirm } from '../lib/prompt.ts';
import { REPORT_FOOTER, writeOutputs } from '../lib/report.ts';
import { listAspsps, secondsToDays } from './aspsps.ts';
import { EbClient, ebErrorInfo } from './client.ts';
import { computeValidUntil, parseRedirect, rfc3339 } from './redirect.ts';
import { memberLabel, saveSession, sessionPath } from './store.ts';
import type { AccountResource, AspspData, StoredSession } from './types.ts';

function pickAspsp(list: AspspData[], wanted: string): AspspData {
  const w = wanted.toLowerCase();
  const exact = list.filter((a) => a.name.toLowerCase() === w);
  if (exact.length === 1) return exact[0]!;
  const partial = list.filter((a) => a.name.toLowerCase().includes(w));
  if (partial.length === 1) return partial[0]!;
  if (partial.length === 0) throw new SpikeError(`Cap ASPSP coincideix amb "${wanted}". Executa primer npm run eb:aspsps.`);
  throw new SpikeError(`"${wanted}" és ambigu: ${partial.map((a) => a.name).join(' | ')}. Fes servir el nom exacte.`);
}

async function main() {
  const args = parseArgs();
  const wanted = argString(args, 'aspsp');
  if (!wanted) throw new SpikeError('Cal --aspsp (p. ex. npm run eb:connect -- --aspsp BBVA)');
  const member = memberLabel(argString(args, 'member'));
  const country = (argString(args, 'country') ?? 'ES').toUpperCase();
  const days = argString(args, 'days') ? Number(argString(args, 'days')) : undefined;
  if (days !== undefined && (!Number.isFinite(days) || days <= 0)) throw new SpikeError('--days ha de ser un enter positiu');
  const redirectUrl = requireEnv('EB_REDIRECT_URL');

  const client = new EbClient();
  const { res: listRes, aspsps } = await listAspsps(client, country);
  if (!listRes.ok) {
    const e = ebErrorInfo(listRes);
    throw new SpikeError(`GET /aspsps ha fallat: HTTP ${e.http_status} ${e.error ?? ''} ${e.message ?? ''}`);
  }
  const aspsp = pickAspsp(aspsps, wanted);
  const validUntil = computeValidUntil(new Date(), aspsp.maximum_consent_validity, days);

  console.log(`\nASPSP: ${aspsp.name} (${aspsp.country}) · maximum_consent_validity = ${secondsToDays(aspsp.maximum_consent_validity)} dies`);
  console.log(`Consentiment sol·licitat fins a: ${rfc3339(validUntil)}  ·  membre: ${member}`);
  console.log(
    '\nATENCIÓ (Redsys): només hi pot haver UNA sessió activa per usuari i TPP. Una nova autenticació\n' +
      'invalida qualsevol altra sessió d’aquest usuari amb aquesta app. Fes-ho només si cal.',
  );
  if (existsSync(sessionPath(member))) console.log(`Ja existeix una sessió desada per al membre ${member}; se substituirà.`);
  if (!(await confirm('Continuar?'))) {
    console.log('Cancel·lat.');
    return;
  }

  const state = randomUUID();
  const authBody = {
    access: { valid_until: rfc3339(validUntil), balances: true, transactions: true },
    aspsp: { name: aspsp.name, country: aspsp.country },
    state,
    redirect_url: redirectUrl,
    psu_type: 'personal',
  };
  const authRes = await client.post('POST /auth', '/auth', authBody);
  const raw: Record<string, unknown> = {
    generated_at: new Date().toISOString(),
    member,
    aspsp: { name: aspsp.name, country: aspsp.country, maximum_consent_validity: aspsp.maximum_consent_validity },
    requested_valid_until: rfc3339(validUntil),
    auth: { status: authRes.status, latency_ms: authRes.latencyMs },
  };
  if (!authRes.ok) {
    const e = ebErrorInfo(authRes);
    (raw.auth as Record<string, unknown>).body = authRes.body;
    writeReport(raw, member, aspsp, `POST /auth: HTTP ${e.http_status} ${e.error ?? ''} ${e.message ?? ''}`, null);
    throw new SpikeError(`POST /auth ha fallat: HTTP ${e.http_status} ${e.error ?? ''} ${e.message ?? ''}`);
  }
  const authUrl = (authRes.body as { url?: string }).url;
  if (!authUrl) throw new SpikeError('POST /auth no ha retornat cap url');

  console.log('\n1) Obre aquesta URL al navegador i fes la SCA amb el teu banc:\n');
  console.log(authUrl);
  console.log('\n2) En acabar, el navegador anirà a la teva EB_REDIRECT_URL (pot ser que la pàgina no carregui: és normal).');
  const pasted = await ask('3) Enganxa aquí la URL COMPLETA de la barra d’adreces i prem Enter:\n> ');
  const parsed = parseRedirect(pasted, state);
  if (!parsed.ok) {
    const why =
      parsed.reason === 'provider_error'
        ? `el banc/Enable Banking ha retornat error=${parsed.error}${parsed.description ? ` (${parsed.description})` : ''}`
        : parsed.reason === 'state_mismatch'
          ? 'el paràmetre state no coincideix (URL d’un altre intent?)'
          : parsed.reason === 'missing_code'
            ? 'la URL no conté cap paràmetre code'
            : 'no és una URL vàlida';
    raw.redirect_error = { reason: parsed.reason, error: parsed.reason === 'provider_error' ? parsed.error : undefined };
    writeReport(raw, member, aspsp, `Redirecció: ${why}`, null);
    throw new SpikeError(`No s’ha pogut obtenir el code: ${why}`);
  }

  const sesRes = await client.post('POST /sessions', '/sessions', { code: parsed.code });
  raw.session = { status: sesRes.status, latency_ms: sesRes.latencyMs, body: sesRes.body };
  if (!sesRes.ok) {
    const e = ebErrorInfo(sesRes);
    writeReport(raw, member, aspsp, `POST /sessions: HTTP ${e.http_status} ${e.error ?? ''} ${e.message ?? ''}`, null);
    throw new SpikeError(`POST /sessions ha fallat: HTTP ${e.http_status} ${e.error ?? ''} ${e.message ?? ''}`);
  }
  const body = sesRes.body as {
    session_id: string;
    accounts?: AccountResource[];
    aspsp?: { name: string; country: string };
    psu_type?: string;
    access?: { valid_until?: string };
  };
  const stored: StoredSession = {
    member,
    session_id: body.session_id,
    aspsp: body.aspsp ?? { name: aspsp.name, country: aspsp.country },
    psu_type: body.psu_type,
    access: body.access,
    created_at: new Date().toISOString(),
    accounts: body.accounts ?? [],
  };
  const p = saveSession(stored);
  const out = writeReport(raw, member, aspsp, null, stored);
  console.log(`\nSessió creada (${maskId(stored.session_id)}) amb ${stored.accounts.length} compte(s). Desada a ${p}`);
  if (stored.accounts.length === 0) {
    console.log('ATENCIÓ: llista de comptes buida. En mode restringit això indica que els comptes no estan vinculats a l’app.');
  }
  console.log(`Ara executa, de seguida (l’historial complet sovint només és disponible ~1 h): npm run eb:fetch -- --member ${member}`);
  console.log(`Raw (no compartir): ${out.rawPath}\nInforme (compartible): ${out.reportPath}`);
}

function writeReport(
  raw: Record<string, unknown>,
  member: string,
  aspsp: AspspData,
  error: string | null,
  s: StoredSession | null,
) {
  let md = `# Enable Banking — connexió (membre ${member})\n\nGenerat: ${new Date().toISOString()}\n\n`;
  md += `- ASPSP: ${cell(aspsp.name)} (${aspsp.country})\n- maximum_consent_validity: ${aspsp.maximum_consent_validity} s (${secondsToDays(aspsp.maximum_consent_validity)} dies)\n`;
  md += `- valid_until sol·licitat: ${raw.requested_valid_until}\n`;
  if (s) {
    md += `- Sessió creada: sí (${maskId(s.session_id)})\n- valid_until retornat: ${s.access?.valid_until ?? '(no retornat)'}\n`;
    md += `- psu_type: ${s.psu_type ?? '?'}\n- Comptes retornats per POST /sessions: **${s.accounts.length}**\n\n`;
    if (s.accounts.length) {
      md += '| # | IBAN | cash_account_type | usage | moneda | psu_status | uid present |\n|---|---|---|---|---|---|---|\n';
      s.accounts.forEach((a, i) => {
        md += `| ${i + 1} | ${maskIban(a.account_id?.iban)} | ${cell(a.cash_account_type)} | ${cell(a.usage ?? '')} | ${cell(a.currency)} | ${cell(a.psu_status ?? '')} | ${a.uid ? 'sí' : 'no'} |\n`;
      });
    } else {
      md += '> Llista buida: en mode restringit, els comptes no vinculats a l’app s’eliminen de la resposta.\n';
    }
  }
  md += `\n## Errors\n\n${error ? `- ${cell(error)}` : '- Cap'}\n${REPORT_FOOTER}`;
  return writeOutputs(`eb-connect-${member}`, raw, md, [process.env.EB_APP_ID], [s?.session_id]);
}

main().catch((e: Error) => {
  console.error(e instanceof SpikeError ? `ERROR: ${e.message}` : `ERROR inesperat: ${e.name}: ${e.message}`);
  process.exit(1);
});
