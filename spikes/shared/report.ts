import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertNoSecrets, assertShareable } from './anonymize.ts';
import { OUTPUT_DIR } from './env.ts';

export function timestamp(d = new Date()): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
}

export function ensureOutputDir(): string {
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 });
  return OUTPUT_DIR;
}

/**
 * Writes `<base>-<ts>.raw.json` (local only) and `<base>-<ts>.report.md`
 * (anonymised, shareable). Both are checked for secrets first.
 */
export function writeOutputs(
  base: string,
  raw: unknown,
  reportMd: string,
  secrets: Array<string | undefined>,
  /** Values allowed in the local raw file but never in the shareable report (e.g. session ids). */
  reportOnlySecrets: Array<string | undefined> = [],
): { rawPath: string; reportPath: string } {
  const dir = ensureOutputDir();
  const ts = timestamp();
  const rawText = JSON.stringify(raw, null, 2);
  assertNoSecrets(rawText, secrets);
  assertShareable(reportMd, [...secrets, ...reportOnlySecrets]);
  const rawPath = path.join(dir, `${base}-${ts}.raw.json`);
  const reportPath = path.join(dir, `${base}-${ts}.report.md`);
  writeFileSync(rawPath, rawText + '\n', { mode: 0o600 });
  writeFileSync(reportPath, reportMd, { mode: 0o600 });
  return { rawPath, reportPath };
}

export const REPORT_FOOTER =
  '\n---\nInforme anonimitzat generat automàticament per `spikes/`. Sense imports, noms, adreces completes ni identificadors complets. Les dades completes són al fitxer `.raw.json` corresponent, que **no** s’ha de compartir.\n';
