import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { SpikeError } from './env.ts';

export function args<const T extends ParseArgsOptionsConfig>(options: T) {
  return parseArgs({ options, allowPositionals: false, strict: true }).values;
}

/**
 * Converteix un error propi d'un spike (p. ex. `EbApiError`) en un missatge per a l'usuari.
 * Retorna `undefined` si no el reconeix.
 */
export type ErrorExplainer = (e: unknown) => string | undefined;

/** Executa el main i mostra els errors esperats sense stack trace ni secrets. */
export function run(main: () => Promise<void>, explain?: ErrorExplainer): void {
  main().catch((e: unknown) => {
    const explained = e instanceof SpikeError ? e.message : explain?.(e);
    if (explained !== undefined) console.error(`\n✗ ${explained}`);
    else console.error('\n✗ Error inesperat:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
