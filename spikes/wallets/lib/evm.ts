// Validació d'adreces EVM: "0x" + 40 hex. Si barreja majúscules i minúscules, ha de complir EIP-55.
// EIP-55: https://eips.ethereum.org/EIPS/eip-55
import { keccak256Hex } from './keccak.ts';

export type EvmValidation = { ok: true; checksummed: string; hadChecksum: boolean } | { ok: false; reason: string };

export function toChecksumAddress(address: string): string {
  const lower = address.toLowerCase().replace(/^0x/, '');
  const hash = keccak256Hex(lower);
  let out = '0x';
  for (let i = 0; i < 40; i++) out += parseInt(hash[i]!, 16) >= 8 ? lower[i]!.toUpperCase() : lower[i]!;
  return out;
}

export function validateEvmAddress(input: string): EvmValidation {
  const s = input.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return { ok: false, reason: 'ha de ser 0x + 40 caràcters hexadecimals' };
  const body = s.slice(2);
  const checksummed = toChecksumAddress(s);
  const mixed = body !== body.toLowerCase() && body !== body.toUpperCase();
  if (mixed && s !== checksummed) return { ok: false, reason: 'checksum EIP-55 incorrecte (revisa majúscules/minúscules o si hi ha un error de còpia)' };
  return { ok: true, checksummed, hadChecksum: mixed };
}
