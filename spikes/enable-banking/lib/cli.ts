import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { EbApiError, explainError } from './client.ts';
import { SpikeError } from './env.ts';

export function args<const T extends ParseArgsOptionsConfig>(options: T) {
  return parseArgs({ options, allowPositionals: false, strict: true }).values;
}

/** El membre identifica la sessió desada (A o B). */
export function parseMember(value: unknown): string {
  const m = String(value ?? 'A').toUpperCase();
  if (!/^[A-Z0-9_-]{1,16}$/.test(m)) throw new SpikeError('--member ha de ser curt i alfanumèric (p. ex. A o B).');
  return m;
}

/** Executa el main i mostra els errors esperats sense stack trace ni secrets. */
export function run(main: () => Promise<void>): void {
  main().catch((e: unknown) => {
    if (e instanceof SpikeError) console.error(`\n✗ ${e.message}`);
    else if (e instanceof EbApiError) console.error(`\n✗ ${explainError(e)}`);
    else console.error('\n✗ Error inesperat:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
