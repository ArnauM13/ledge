/**
 * npm run eb:aspsps [-- --country ES[,DE]]
 * Gate G1 (part): which Spanish ASPSPs are available and with which consent validity.
 *
 * Endpoint: GET /aspsps?country=XX
 * Docs: https://enablebanking.com/docs/api/reference ("Get list of ASPSPs")
 * Response: { aspsps: ASPSPData[] }; `maximum_consent_validity` is in SECONDS.
 */
import { pathToFileURL } from 'node:url';
import { argString, parseArgs } from '../lib/args.ts';
import { cell } from '../lib/anonymize.ts';
import { SpikeError } from '../lib/env.ts';
import type { HttpResult } from '../lib/http.ts';
import { REPORT_FOOTER, writeOutputs } from '../lib/report.ts';
import { EbClient, ebErrorInfo } from './client.ts';
import type { AspspData } from './types.ts';

export const TARGETS: Array<{ key: string; re: RegExp }> = [
  { key: 'BBVA', re: /\bbbva\b/i },
  { key: 'MyInvestor', re: /my\s*investor/i },
  { key: 'Trade Republic', re: /trade\s*republic/i },
];

export async function listAspsps(client: EbClient, country: string): Promise<{ res: HttpResult; aspsps: AspspData[] }> {
  const res = await client.get(`GET /aspsps?country=${country}`, `/aspsps?country=${encodeURIComponent(country)}`);
  const aspsps = res.ok ? (((res.body as { aspsps?: AspspData[] })?.aspsps ?? []) as AspspData[]) : [];
  return { res, aspsps };
}

export const secondsToDays = (s: number | undefined) =>
  typeof s === 'number' ? Math.round((s / 86400) * 10) / 10 : null;

function describe(a: AspspData): string[] {
  return [
    cell(a.name),
    cell(a.country),
    cell((a.psu_types ?? []).join(', ')),
    cell(a.maximum_consent_validity),
    cell(secondsToDays(a.maximum_consent_validity)),
    cell(a.beta),
    cell(a.bic ?? ''),
    cell((a.required_psu_headers ?? []).join(', ') || '—'),
    cell(
      (a.auth_methods ?? [])
        .map((m) => `${m.name ?? '?'}/${m.approach ?? '?'}/${m.psu_type ?? '?'}${m.hidden_method ? ' (hidden)' : ''}`)
        .join('; ') || '—',
    ),
    cell(Array.isArray(a.payments) ? a.payments.length : 0),
  ];
}

async function main() {
  const args = parseArgs();
  const countries = (argString(args, 'country') ?? 'ES')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  if (countries.length === 0) throw new SpikeError('--country ha de ser un codi ISO de 2 lletres (p. ex. ES o ES,DE)');

  const client = new EbClient();
  const raw: Record<string, unknown> = { generated_at: new Date().toISOString(), countries, calls: [] as unknown[] };
  const all: AspspData[] = [];
  const errors: string[] = [];

  for (const c of countries) {
    const { res, aspsps } = await listAspsps(client, c);
    (raw.calls as unknown[]).push({ label: res.label, status: res.status, latency_ms: res.latencyMs, body: res.body });
    if (!res.ok) {
      const e = ebErrorInfo(res);
      errors.push(`${res.label}: HTTP ${e.http_status} ${e.error ?? ''} ${e.message ?? ''}`.trim());
      continue;
    }
    all.push(...aspsps);
  }

  const header =
    '| Nom | País | Tipus PSU | maximum_consent_validity (s) | (dies) | beta | BIC | required_psu_headers | auth_methods (nom/approach/psu) | # tipus de pagament |\n|---|---|---|---|---|---|---|---|---|---|';
  let md = `# Enable Banking — ASPSPs (${countries.join(', ')})\n\nGenerat: ${new Date().toISOString()}\n\n`;
  md += `Endpoint: \`GET /aspsps?country=…\` — https://enablebanking.com/docs/api/reference\n\n`;
  md += `ASPSPs retornats: **${all.length}**\n\n## Objectius\n\n`;
  for (const t of TARGETS) {
    const hits = all.filter((a) => t.re.test(a.name));
    md += `### ${t.key}: ${hits.length > 0 ? `**present** (${hits.length})` : '**no present**'}\n\n`;
    if (hits.length) md += `${header}\n${hits.map((h) => `| ${describe(h).join(' | ')} |`).join('\n')}\n\n`;
  }
  md += `## Tots els ASPSPs retornats\n\n${header}\n${all.map((a) => `| ${describe(a).join(' | ')} |`).join('\n')}\n\n`;
  md += `## Errors\n\n${errors.length ? errors.map((e) => `- ${cell(e)}`).join('\n') : '- Cap'}\n`;
  md += REPORT_FOOTER;

  const out = writeOutputs('eb-aspsps', raw, md, [process.env.EB_APP_ID]);
  console.log(`ASPSPs: ${all.length}. ${TARGETS.map((t) => `${t.key}: ${all.some((a) => t.re.test(a.name)) ? 'sí' : 'no'}`).join(' · ')}`);
  console.log(`Raw (no compartir): ${out.rawPath}\nInforme (compartible): ${out.reportPath}`);
  if (errors.length) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e: Error) => {
    console.error(e instanceof SpikeError ? `ERROR: ${e.message}` : `ERROR inesperat: ${e.name}: ${e.message}`);
    process.exit(1);
  });
}
