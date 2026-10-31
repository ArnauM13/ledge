import { loadDotEnv, optionalEnv, requireEnv, SpikeError } from '../../lib/env.ts';
import { DEFAULT_API_BASE, type BnConfig } from './client.ts';
import { parseRecvWindow } from './sign.ts';

// Bases oficials: https://developers.binance.com/docs/wallet/general-info
const ALLOWED_BASES = new Set([
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
]);

export function loadBnConfig(): BnConfig {
  loadDotEnv();
  const apiKey = requireEnv('BINANCE_API_KEY');
  const apiSecret = requireEnv('BINANCE_API_SECRET');
  if (!/^[A-Za-z0-9]{16,128}$/.test(apiKey)) throw new SpikeError('BINANCE_API_KEY no té el format esperat (alfanumèric).');
  if (/\s/.test(apiSecret)) throw new SpikeError('BINANCE_API_SECRET conté espais. Revisa el .env.');
  const apiBase = (optionalEnv('BINANCE_API_BASE') ?? DEFAULT_API_BASE).replace(/\/+$/, '');
  if (!ALLOWED_BASES.has(apiBase)) throw new SpikeError(`BINANCE_API_BASE ha de ser una de: ${[...ALLOWED_BASES].join(', ')}`);
  return { apiKey, apiSecret, apiBase, recvWindow: parseRecvWindow(optionalEnv('BINANCE_RECV_WINDOW')) };
}
