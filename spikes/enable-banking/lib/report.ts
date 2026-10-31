import { mkdirSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { OUTPUT_DIR, SPIKES_ROOT } from './env.ts';

/** Desa `<name>.raw.json` (només local) i `<name>.report.md` (anonimitzat, compartible). */
export function writeOutputs(name: string, raw: unknown, markdown: string): void {
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 });
  const rawPath = resolve(OUTPUT_DIR, `${name}.raw.json`);
  const mdPath = resolve(OUTPUT_DIR, `${name}.report.md`);
  writeFileSync(rawPath, JSON.stringify(raw, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(mdPath, markdown.trimEnd() + '\n', { mode: 0o600 });
  console.log(`\nDades completes (NO compartir): ${relative(SPIKES_ROOT, rawPath)}`);
  console.log(`Informe anonimitzat (per compartir, revisa'l abans): ${relative(SPIKES_ROOT, mdPath)}`);
}

export function mdTable(headers: string[], rows: (string | number | boolean | undefined | null)[][]): string {
  const cell = (v: unknown) => (v === undefined || v === null || v === '' ? '—' : String(v).replace(/\|/g, '\\|'));
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`),
  ].join('\n');
}

export const secondsToDays = (s: number | undefined | null): string =>
  typeof s === 'number' ? String(Math.round(s / 86_400)) : '—';

export function reportHeader(title: string): string {
  return [
    `# ${title}`,
    '',
    `- Generat: ${new Date().toISOString()}`,
    '- Informe anonimitzat: IBAN emmascarats, sense imports, noms ni identificadors de sessió.',
    '',
  ].join('\n');
}
