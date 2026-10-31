// npm run eb:connect -- --aspsp BBVA [--member A] [--psu-type personal] [--days 180]
// Docs: https://enablebanking.com/docs/api/reference → POST /auth i POST /sessions
// Flux: crea l'autorització → l'usuari fa la SCA al navegador → enganxa l'URL de redirecció → es crea la sessió.
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { maskIban, shortHash } from '../lib/anonymize.ts';
import { args, parseMember, run } from './lib/cli.ts';
import { callsTable, EbClient } from './lib/client.ts';
import { SpikeError } from '../lib/env.ts';
import { loadEbConfig } from './lib/config.ts';
import { computeValidUntil, parseRedirectUrl } from './lib/redirect.ts';
import { mdTable, reportHeader, secondsToDays, writeOutputs } from '../lib/report.ts';
import { hasSession, saveSession } from './lib/session-store.ts';
import type { Aspsp, PsuType, SessionCreated, StartAuthResponse } from './lib/types.ts';

run(async () => {
  const opts = args({
    aspsp: { type: 'string' },
    country: { type: 'string', default: 'ES' },
    member: { type: 'string', default: 'A' },
    'psu-type': { type: 'string', default: 'personal' },
    days: { type: 'string' },
  });
  if (!opts.aspsp) throw new SpikeError('Indica el banc: npm run eb:connect -- --aspsp BBVA --member A');
  const member = parseMember(opts.member);
  const country = String(opts.country).toUpperCase();
  const psuType = String(opts['psu-type']) as PsuType;
  if (psuType !== 'personal' && psuType !== 'business') throw new SpikeError('--psu-type ha de ser personal o business.');
  const days = opts.days ? Number(opts.days) : undefined;
  if (days !== undefined && (!Number.isInteger(days) || days < 1)) throw new SpikeError('--days ha de ser un enter positiu.');

  const cfg = loadEbConfig();
  const client = new EbClient(cfg);

  if (hasSession(member)) {
    console.warn(`⚠ Ja hi ha una sessió desada per al membre ${member}. Se substituirà.`);
    console.warn('  Redsys només permet una sessió activa per usuari: la nova pot invalidar l\'anterior.\n');
  }

  // 1. Trobar l'ASPSP exacte i la validesa màxima del consentiment.
  const { aspsps } = await client.request<{ aspsps: Aspsp[] }>('GET', '/aspsps', { query: { country } });
  const wanted = String(opts.aspsp).toLowerCase();
  const exact = aspsps.filter((a) => a.name.toLowerCase() === wanted);
  const aspsp = exact.length === 1 ? exact[0] : undefined;
  if (!aspsp) {
    const similar = aspsps.filter((a) => a.name.toLowerCase().includes(wanted)).map((a) => a.name);
    throw new SpikeError(
      `No hi ha cap ASPSP amb el nom exacte "${opts.aspsp}" a ${country}.` +
        (similar.length ? ` Noms semblants: ${similar.join(', ')}` : ' Executa eb:aspsps per veure la llista.'),
    );
  }
  if (aspsp.psu_types && !aspsp.psu_types.includes(psuType)) {
    throw new SpikeError(`${aspsp.name} no admet psu_type=${psuType}. Admet: ${aspsp.psu_types.join(', ')}`);
  }

  // 2. Iniciar l'autorització.
  const validUntil = computeValidUntil(aspsp.maximum_consent_validity, days);
  const state = randomUUID();
  const auth = await client.request<StartAuthResponse>('POST', '/auth', {
    body: {
      access: { valid_until: validUntil },
      aspsp: { name: aspsp.name, country: aspsp.country },
      state,
      redirect_url: cfg.redirectUrl,
      psu_type: psuType,
    },
  });

  console.log(`\nMembre ${member} · ${aspsp.name} · consentiment demanat fins a ${validUntil}`);
  console.log('\n1) Obre aquesta URL al navegador i completa l\'accés al banc (usuari, contrasenya i confirmació al mòbil):\n');
  console.log(`   ${auth.url}\n`);
  console.log('2) En acabar, el navegador anirà a ' + cfg.redirectUrl + ' i mostrarà un error de connexió. És normal.');
  console.log('3) Copia l\'URL COMPLETA de la barra d\'adreces i enganxa-la aquí. Fes-ho de seguida: el codi caduca.\n');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const pasted = await rl.question('URL de redirecció: ');
  rl.close();
  const code = parseRedirectUrl(pasted, state);

  // 3. Crear la sessió.
  const session = await client.request<SessionCreated>('POST', '/sessions', { body: { code } });
  saveSession(member, session);
  console.log(`\n✓ Sessió creada amb ${session.accounts?.length ?? 0} compte(s). Desada a output/eb-session-${member}.json (no la comparteixis).`);
  if (!session.accounts?.length) {
    console.warn('⚠ L\'API no ha retornat cap compte. Si és la teva app de producció en mode restricted, potser aquest usuari no té els comptes vinculats a l\'app (gate G2).');
  }

  const md = [
    reportHeader(`Enable Banking — connexió (membre ${member})`),
    `- ASPSP: ${session.aspsp?.name ?? aspsp.name} (${session.aspsp?.country ?? country})`,
    `- psu_type: ${session.psu_type ?? psuType}`,
    `- Consentiment màxim de l'ASPSP: ${secondsToDays(aspsp.maximum_consent_validity)} dies`,
    `- valid_until demanat: ${validUntil.slice(0, 10)}`,
    `- valid_until retornat: ${session.access?.valid_until?.slice(0, 10) ?? '—'}`,
    `- Comptes retornats: **${session.accounts?.length ?? 0}**`,
    '',
    '## Comptes',
    '',
    session.accounts?.length
      ? mdTable(
          ['#', 'Ref. (hash)', 'IBAN', 'Tipus (cash_account_type)', 'Producte', 'Moneda', 'Ús', 'psu_status'],
          session.accounts.map((a, i) => [
            i + 1,
            a.uid ? shortHash(a.uid) : '—',
            maskIban(a.account_id?.iban),
            a.cash_account_type,
            a.product,
            a.currency,
            a.usage,
            a.psu_status,
          ]),
        )
      : '_Cap compte retornat._',
    '',
    '## Crides',
    '',
    callsTable(client.calls),
  ].join('\n');
  writeOutputs(`eb-connect-${member}`, session, md);
});
