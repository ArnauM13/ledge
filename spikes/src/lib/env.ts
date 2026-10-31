import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the `spikes/` directory. */
export const SPIKES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Absolute path of the repository root (parent of `spikes/`). */
export const REPO_DIR = path.resolve(SPIKES_DIR, '..');
export const OUTPUT_DIR = path.join(SPIKES_DIR, 'output');

let loaded = false;

/**
 * Loads `spikes/.env` (if present) using Node's built-in loader
 * (`process.loadEnvFile`, Node >= 20.12). Variables already set in the
 * environment win over the file. No third-party dotenv dependency.
 */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const file = path.join(SPIKES_DIR, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(name: string): string {
  loadEnv();
  const v = process.env[name]?.trim();
  if (!v) throw new SpikeError(`Falta la variable d'entorn ${name}. Revisa spikes/.env (vegeu .env.example).`);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  loadEnv();
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** True if `p` resolves to a location inside the git repository. */
export function isInsideRepo(p: string): boolean {
  const rel = path.relative(REPO_DIR, path.resolve(p));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Error whose message is safe to print (never contains secrets). */
export class SpikeError extends Error {}
