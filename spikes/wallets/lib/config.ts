import { loadDotEnv, optionalEnv, SpikeError } from '../../lib/env.ts';
import { validateBtcAddress, type BtcAddressType } from './btc.ts';
import { validateEvmAddress } from './evm.ts';
import { detectSecret } from './secrets.ts';

export const DEFAULT_MEMPOOL_BASE = 'https://mempool.space/api';
export const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';
/** `balancemulti` accepta com a màxim 20 adreces per crida. */
export const MAX_ADDRESSES = 20;
const MAX_CHAINS = 10;

export interface WalletsConfig {
  btc: { address: string; type: BtcAddressType }[];
  evm: string[];
  chains: number[];
  /** No s'imprimeix mai. */
  etherscanApiKey?: string;
  mempoolBase: string;
}

/**
 * Comprova que cap valor sembli un secret. El missatge d'error NO inclou mai el valor.
 * Exportat per als tests.
 */
export function assertNoSecrets(varName: string, raw: string): void {
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const whole = detectSecret(raw);
  const idx = items.findIndex((s) => detectSecret(s));
  const kind = whole ?? (idx >= 0 ? detectSecret(items[idx]!) : undefined);
  if (!kind) return;
  throw new SpikeError(
    [
      `⛔ ${varName}${idx >= 0 && !whole ? ` (element #${idx + 1})` : ''} sembla una ${kind}.`,
      'L\'he rebutjat: no s\'ha mostrat, no s\'ha enviat enlloc i no s\'ha desat a cap fitxer.',
      'Aquest spike només accepta ADRECES PÚBLIQUES. Esborra-la del .env ara mateix.',
      'Si l\'has copiada en algun altre lloc (xat, núvol, git), considera la wallet compromesa i mou-ne els fons.',
    ].join('\n'),
  );
}

export function parseList(raw: string | undefined): string[] {
  return [...new Set((raw ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
}

export function parseChains(raw: string | undefined): number[] {
  const list = parseList(raw ?? '1');
  const chains = list.map((c) => {
    if (!/^\d{1,12}$/.test(c) || Number(c) < 1) throw new SpikeError(`EVM_CHAINS: "${c}" no és un chainid vàlid (enter positiu, p. ex. 1, 10, 137, 8453, 42161).`);
    return Number(c);
  });
  if (chains.length > MAX_CHAINS) throw new SpikeError(`EVM_CHAINS: com a màxim ${MAX_CHAINS} cadenes.`);
  return chains.length ? chains : [1];
}

export function parseBtcAddresses(raw: string | undefined): WalletsConfig['btc'] {
  if (raw) assertNoSecrets('BTC_ADDRESSES', raw);
  const out: WalletsConfig['btc'] = [];
  for (const [i, a] of parseList(raw).entries()) {
    const v = validateBtcAddress(a);
    if (!v.ok) throw new SpikeError(`BTC_ADDRESSES (element #${i + 1}): ${v.reason}.`);
    if (!out.some((x) => x.address === v.normalized)) out.push({ address: v.normalized, type: v.type });
  }
  if (out.length > MAX_ADDRESSES) throw new SpikeError(`BTC_ADDRESSES: com a màxim ${MAX_ADDRESSES} adreces.`);
  return out;
}

export function parseEvmAddresses(raw: string | undefined): string[] {
  if (raw) assertNoSecrets('EVM_ADDRESSES', raw);
  const out: string[] = [];
  for (const [i, a] of parseList(raw).entries()) {
    const v = validateEvmAddress(a);
    if (!v.ok) throw new SpikeError(`EVM_ADDRESSES (element #${i + 1}): ${v.reason}.`);
    if (!out.includes(v.checksummed)) out.push(v.checksummed);
  }
  if (out.length > MAX_ADDRESSES) throw new SpikeError(`EVM_ADDRESSES: com a màxim ${MAX_ADDRESSES} adreces.`);
  return out;
}

export function loadWalletsConfig(): WalletsConfig {
  loadDotEnv();
  const btc = parseBtcAddresses(optionalEnv('BTC_ADDRESSES'));
  const evm = parseEvmAddresses(optionalEnv('EVM_ADDRESSES'));
  const chains = parseChains(optionalEnv('EVM_CHAINS'));
  if (!btc.length && !evm.length) throw new SpikeError('Omple BTC_ADDRESSES i/o EVM_ADDRESSES al .env (adreces públiques separades per comes).');

  const etherscanApiKey = optionalEnv('ETHERSCAN_API_KEY');
  if (evm.length && !etherscanApiKey) throw new SpikeError('Falta ETHERSCAN_API_KEY (necessària per a EVM_ADDRESSES).');
  if (etherscanApiKey && !/^[A-Za-z0-9]{16,64}$/.test(etherscanApiKey)) throw new SpikeError('ETHERSCAN_API_KEY no té el format esperat (alfanumèric).');

  const mempoolBase = (optionalEnv('MEMPOOL_API_BASE') ?? DEFAULT_MEMPOOL_BASE).replace(/\/+$/, '');
  if (!/^https:\/\//.test(mempoolBase)) throw new SpikeError('MEMPOOL_API_BASE ha de començar per https://');

  return { btc, evm, chains, etherscanApiKey, mempoolBase };
}
