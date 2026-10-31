import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, sep } from 'node:path';

/** Carpeta `spikes/`. */
export const SPIKES_ROOT = resolve(import.meta.dirname, '..');
/** Arrel del repo (`ledge/`). */
export const REPO_ROOT = resolve(SPIKES_ROOT, '..');
/** Sortida local (al .gitignore). */
export const OUTPUT_DIR = resolve(SPIKES_ROOT, 'output');

/** Error esperat: es mostra a l'usuari sense stack trace. */
export class SpikeError extends Error {}

/** Carrega `spikes/.env` (si existeix) a `process.env`. */
export function loadDotEnv(): void {
  const path = resolve(SPIKES_ROOT, '.env');
  if (existsSync(path)) process.loadEnvFile(path);
}

export function expandHome(p: string): string {
  return p === '~' || p.startsWith('~/') ? resolve(homedir(), p.slice(2)) : p;
}

/** True si `file` és dins de `dir` (o és `dir`). */
export function isInside(file: string, dir: string): boolean {
  const f = resolve(file);
  const d = resolve(dir);
  return f === d || f.startsWith(d + sep);
}

export function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new SpikeError(`Falta la variable d'entorn ${name}. Copia .env.example a .env i omple-la.`);
  return v;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}
