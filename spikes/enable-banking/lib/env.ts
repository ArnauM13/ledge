import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, resolve, sep } from 'node:path';

/** Carpeta `spikes/`. */
export const SPIKES_ROOT = resolve(import.meta.dirname, '..', '..');
/** Arrel del repo (`ledge/`). */
export const REPO_ROOT = resolve(SPIKES_ROOT, '..');
/** Sortida local (al .gitignore). */
export const OUTPUT_DIR = resolve(SPIKES_ROOT, 'output');

export const DEFAULT_API_BASE = 'https://api.enablebanking.com';
export const DEFAULT_REDIRECT_URL = 'https://localhost:3000/callback';

/** Error esperat: es mostra a l'usuari sense stack trace. */
export class SpikeError extends Error {}

export interface EbConfig {
  appId: string;
  /** Contingut PEM. No s'imprimeix mai. */
  privateKeyPem: string;
  apiBase: string;
  redirectUrl: string;
  psuIpAddress?: string;
}

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

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new SpikeError(`Falta la variable d'entorn ${name}. Copia .env.example a .env i omple-la.`);
  return v;
}

export function loadEbConfig(): EbConfig {
  loadDotEnv();
  const appId = requireEnv('EB_APP_ID');
  const keyPath = expandHome(requireEnv('EB_PRIVATE_KEY_PATH'));

  if (!isAbsolute(keyPath)) throw new SpikeError('EB_PRIVATE_KEY_PATH ha de ser una ruta absoluta (o començar per ~/).');
  if (isInside(keyPath, REPO_ROOT)) {
    throw new SpikeError('La clau privada és dins del repo. Mou-la fora (p. ex. ~/.secrets/ledge/) i actualitza EB_PRIVATE_KEY_PATH.');
  }
  if (!existsSync(keyPath)) throw new SpikeError('No es troba el fitxer de EB_PRIVATE_KEY_PATH.');

  const privateKeyPem = readFileSync(keyPath, 'utf8');
  if (!privateKeyPem.includes('PRIVATE KEY')) throw new SpikeError('EB_PRIVATE_KEY_PATH no sembla una clau privada PEM.');

  return {
    appId,
    privateKeyPem,
    apiBase: process.env.EB_API_BASE?.trim() || DEFAULT_API_BASE,
    redirectUrl: process.env.EB_REDIRECT_URL?.trim() || DEFAULT_REDIRECT_URL,
    psuIpAddress: process.env.EB_PSU_IP_ADDRESS?.trim() || undefined,
  };
}
