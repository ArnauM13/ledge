import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { expandHome, isInside, loadDotEnv, REPO_ROOT, requireEnv, SpikeError } from '../../lib/env.ts';

export const DEFAULT_API_BASE = 'https://api.enablebanking.com';
export const DEFAULT_REDIRECT_URL = 'https://localhost:3000/callback';

export interface EbConfig {
  appId: string;
  /** Contingut PEM. No s'imprimeix mai. */
  privateKeyPem: string;
  apiBase: string;
  redirectUrl: string;
  psuIpAddress?: string;
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
