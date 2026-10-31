// npm run eb:aspsps [-- --country ES]
// Doc: https://enablebanking.com/docs/api/reference  → GET /aspsps
// Pregunta: hi són BBVA, MyInvestor i Trade Republic? Quina validesa màxima de consentiment tenen?
import { args, run } from './lib/cli.ts';
import { callsTable, EbClient } from './lib/client.ts';
import { loadEbConfig } from './lib/config.ts';
import { mdTable, reportHeader, secondsToDays, writeOutputs } from '../lib/report.ts';
import type { Aspsp } from './lib/types.ts';

const TARGETS = [
  { label: 'BBVA', match: /bbva/i },
  { label: 'MyInvestor', match: /my\s*investor/i },
  { label: 'Trade Republic', match: /trade\s*republic/i },
];

run(async () => {
  const opts = args({ country: { type: 'string', default: 'ES' } });
  const country = String(opts.country).toUpperCase();
  const client = new EbClient(loadEbConfig());

  console.log(`Consultant GET /aspsps?country=${country} ...`);
  const data = await client.request<{ aspsps: Aspsp[] }>('GET', '/aspsps', { query: { country } });
  const list = data.aspsps ?? [];
  const isSandbox = list.some((a) => a.sandbox !== undefined && a.sandbox !== null);

  const sections: string[] = [];
  const summary: [string, string][] = [];
  for (const t of TARGETS) {
    const found = list.filter((a) => t.match.test(a.name));
    summary.push([t.label, found.length ? `SÍ (${found.length})` : 'NO']);
    console.log(`  ${t.label}: ${found.length ? found.map((a) => a.name).join(', ') : 'no trobat'}`);
    if (!found.length) {
      sections.push(`### ${t.label}\n\nNo apareix a la llista.`);
      continue;
    }
    sections.push(
      `### ${t.label}\n\n` +
        mdTable(
          ['Nom', 'PSU types', 'Consentiment màx. (dies)', 'Mètodes d\'autenticació', 'Beta', 'Capçaleres PSU obligatòries', 'Pagaments'],
          found.map((a) => [
            a.name,
            a.psu_types?.join(', '),
            secondsToDays(a.maximum_consent_validity),
            a.auth_methods?.map((m) => `${m.approach ?? '?'}/${m.psu_type ?? '?'}${m.hidden_method ? ' (ocult)' : ''}`).join(', '),
            a.beta,
            a.required_psu_headers?.join(', '),
            a.payments?.length ? 'sí' : 'no',
          ]),
        ),
    );
  }

  const md = [
    reportHeader(`Enable Banking — ASPSP disponibles (${country})`),
    `- Entorn: ${isSandbox ? '**SANDBOX** (bancs de prova; per a dades reals cal l\'app de producció)' : 'producció (o sense informació de sandbox)'}`,
    `- Total d'ASPSP a ${country}: ${list.length}`,
    '',
    '## Resum',
    '',
    mdTable(['Entitat', 'Present'], summary),
    '',
    '## Detall',
    '',
    sections.join('\n\n'),
    '',
    '## Crides',
    '',
    callsTable(client.calls),
  ].join('\n');

  writeOutputs(`eb-aspsps-${country}`, data, md);
});
