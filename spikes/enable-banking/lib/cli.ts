import { args, run as baseRun } from '../../lib/cli.ts';
import { SpikeError } from '../../lib/env.ts';
import { EbApiError, explainError } from './client.ts';

export { args };

/** El membre identifica la sessió desada (A o B). */
export function parseMember(value: unknown): string {
  const m = String(value ?? 'A').toUpperCase();
  if (!/^[A-Z0-9_-]{1,16}$/.test(m)) throw new SpikeError('--member ha de ser curt i alfanumèric (p. ex. A o B).');
  return m;
}

/** Executa el main i mostra els errors esperats (inclosos els d'Enable Banking) sense stack trace ni secrets. */
export function run(main: () => Promise<void>): void {
  baseRun(main, (e) => (e instanceof EbApiError ? explainError(e) : undefined));
}
