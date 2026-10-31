// Validació d'adreces Bitcoin de MAINNET (només format i checksum; sense xarxa).
//  - Base58Check (P2PKH "1…", versió 0x00; P2SH "3…", versió 0x05).
//  - Bech32 (BIP-173) per a SegWit v0 ("bc1q…") i Bech32m (BIP-350) per a v1+ ("bc1p…", Taproot).
// NO s'accepten xpub/ypub/zpub en aquest spike.
import { createHash } from 'node:crypto';

export type BtcAddressType = 'P2PKH' | 'P2SH' | 'P2WPKH' | 'P2WSH' | 'P2TR' | 'SegWit v2+';
export type BtcValidation = { ok: true; type: BtcAddressType; normalized: string } | { ok: false; reason: string };

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest();

export function base58Decode(s: string): Uint8Array | undefined {
  let n = 0n;
  for (const ch of s) {
    const i = BASE58.indexOf(ch);
    if (i < 0) return undefined;
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const ch of s) {
    if (ch !== '1') break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** Retorna el payload (sense els 4 bytes de checksum) si el checksum és correcte. */
export function base58CheckDecode(s: string): Uint8Array | undefined {
  const raw = base58Decode(s);
  if (!raw || raw.length < 5) return undefined;
  const payload = raw.subarray(0, -4);
  const check = sha256(sha256(payload)).subarray(0, 4);
  return Buffer.compare(Buffer.from(raw.subarray(-4)), check) === 0 ? payload : undefined;
}

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i]!;
  }
  return chk >>> 0;
}

const hrpExpand = (hrp: string) => [...hrp].map((c) => c.charCodeAt(0) >> 5).concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));

function convertBits(data: number[], from: number, to: number): number[] | undefined {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxv = (1 << to) - 1;
  for (const v of data) {
    acc = (acc << from) | v;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }
  if (bits >= from || ((acc << (to - bits)) & maxv)) return undefined; // padding invàlid
  return out;
}

function validateSegwit(addr: string): BtcValidation {
  if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return { ok: false, reason: 'barreja majúscules i minúscules (bech32 no ho permet)' };
  const a = addr.toLowerCase();
  if (a.length > 90) return { ok: false, reason: 'massa llarga per a bech32' };
  const pos = a.lastIndexOf('1');
  const hrp = a.slice(0, pos);
  if (hrp !== 'bc') return { ok: false, reason: hrp === 'tb' || hrp === 'bcrt' ? 'és una adreça de testnet/regtest (només mainnet)' : 'prefix bech32 desconegut' };
  const data: number[] = [];
  for (const ch of a.slice(pos + 1)) {
    const v = BECH32.indexOf(ch);
    if (v < 0) return { ok: false, reason: 'caràcter no vàlid per a bech32' };
    data.push(v);
  }
  if (data.length < 7) return { ok: false, reason: 'massa curta' };
  const check = polymod([...hrpExpand(hrp), ...data]);
  const version = data[0]!;
  const program = convertBits(data.slice(1, -6), 5, 8);
  if (version > 16 || !program || program.length < 2 || program.length > 40) return { ok: false, reason: 'programa witness invàlid' };
  if (version === 0) {
    if (check !== BECH32_CONST) return { ok: false, reason: 'checksum bech32 incorrecte' };
    if (program.length === 20) return { ok: true, type: 'P2WPKH', normalized: a };
    if (program.length === 32) return { ok: true, type: 'P2WSH', normalized: a };
    return { ok: false, reason: 'longitud de programa v0 invàlida' };
  }
  if (check !== BECH32M_CONST) return { ok: false, reason: 'checksum bech32m incorrecte' };
  if (version === 1 && program.length === 32) return { ok: true, type: 'P2TR', normalized: a };
  return { ok: true, type: 'SegWit v2+', normalized: a };
}

const EXTENDED_PUB_RE = /^[xyztuvYZUV]pub[1-9A-HJ-NP-Za-km-z]{100,}$/;

export function validateBtcAddress(input: string): BtcValidation {
  const s = input.trim();
  if (EXTENDED_PUB_RE.test(s)) return { ok: false, reason: 'és una clau pública estesa (xpub/ypub/zpub). Aquest spike només accepta adreces individuals' };
  if (/^bc1/i.test(s) || /^(tb|bcrt)1/i.test(s)) return validateSegwit(s);
  if (/^[13mn2]/.test(s)) {
    if (s.length < 26 || s.length > 35) return { ok: false, reason: 'longitud no vàlida per a base58' };
    const payload = base58CheckDecode(s);
    if (!payload) return { ok: false, reason: 'checksum base58 incorrecte o caràcters invàlids' };
    if (payload.length !== 21) return { ok: false, reason: 'longitud de payload base58 invàlida' };
    if (payload[0] === 0x00) return { ok: true, type: 'P2PKH', normalized: s };
    if (payload[0] === 0x05) return { ok: true, type: 'P2SH', normalized: s };
    return { ok: false, reason: 'versió base58 no és de mainnet (0x00 o 0x05)' };
  }
  return { ok: false, reason: 'no té format d\'adreça Bitcoin (1…, 3… o bc1…)' };
}
