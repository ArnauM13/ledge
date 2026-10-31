/**
 * Public-address validation for the wallets spike. No network.
 * - BTC mainnet: P2PKH/P2SH (Base58Check, version 0x00/0x05), SegWit v0 (bech32, BIP-173),
 *   SegWit v1+ / Taproot (bech32m, BIP-350). Extended public keys (xpub/ypub/zpub) are REJECTED
 *   in this spike.
 * - EVM: 0x + 40 hex; mixed-case input must pass the EIP-55 checksum.
 * - Anything that looks like a seed phrase or private key is rejected. Error messages NEVER echo
 *   the input, because it could be a secret.
 */
import { createHash } from 'node:crypto';
import { keccak256 } from './keccak.ts';

export type BtcType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2wsh' | 'p2tr' | 'segwit-vN';
export type Validation<T> = { ok: true; value: string; type: T } | { ok: false; reason: string };

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest();
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Decode(s: string): Buffer | null {
  let n = 0n;
  for (const c of s) {
    const i = B58.indexOf(c);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of s) {
    if (c !== '1') break;
    bytes.unshift(0);
  }
  return Buffer.from(bytes);
}

/** Returns the payload (without checksum) if the Base58Check checksum is valid. */
export function base58CheckDecode(s: string): Buffer | null {
  const raw = base58Decode(s);
  if (!raw || raw.length < 5) return null;
  const payload = raw.subarray(0, -4);
  const sum = sha256(sha256(payload)).subarray(0, 4);
  return sum.equals(raw.subarray(-4)) ? payload : null;
}

// ---- Bech32 / Bech32m (BIP-173 / BIP-350) ----
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
const BECH32_CONST = 1;
const BECH32M_CONST = 0x2bc830a3;

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = (((chk & 0x1ffffff) << 5) ^ v) >>> 0;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk = (chk ^ GEN[i]!) >>> 0;
  }
  return chk;
}
const hrpExpand = (hrp: string) => [
  ...[...hrp].map((c) => c.charCodeAt(0) >> 5),
  0,
  ...[...hrp].map((c) => c.charCodeAt(0) & 31),
];

function bech32Decode(addr: string): { hrp: string; data: number[]; constant: number } | null {
  if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return null; // mixed case
  const s = addr.toLowerCase();
  const pos = s.lastIndexOf('1');
  if (pos < 1 || pos + 7 > s.length || s.length > 90) return null;
  const hrp = s.slice(0, pos);
  const data: number[] = [];
  for (const c of s.slice(pos + 1)) {
    const d = CHARSET.indexOf(c);
    if (d < 0) return null;
    data.push(d);
  }
  const constant = polymod([...hrpExpand(hrp), ...data]);
  if (constant !== BECH32_CONST && constant !== BECH32M_CONST) return null;
  return { hrp, data: data.slice(0, -6), constant };
}

function convertBits(data: number[], from: number, to: number): number[] | null {
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
  if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) return null;
  return out;
}

// ---- Secret detection ----
const XPRV_RE = /^[xyztuvYZUV]prv[1-9A-HJ-NP-Za-km-z]{100,}$/;
const XPUB_RE = /^[xyztuvYZUV]pub[1-9A-HJ-NP-Za-km-z]{100,}$/;
const HEX64_RE = /^(0x)?[0-9a-fA-F]{64}$/;

/** Returns a reason if the input looks like a secret (seed phrase, private key...). */
export function looksLikeSecret(input: string): string | null {
  const s = input.trim();
  if (/PRIVATE KEY/i.test(s)) return 'sembla una clau privada (PEM)';
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 12 && words.every((w) => /^[a-zA-Z]+$/.test(w))) return 'sembla una seed phrase';
  if (words.length > 1) return 'conté espais: no és una adreça';
  if (XPRV_RE.test(s)) return 'sembla una clau privada estesa (xprv)';
  if (HEX64_RE.test(s)) return 'sembla una clau privada (64 hex)';
  // WIF private keys: Base58Check, version 0x80 (mainnet) / 0xef (testnet), 33 or 34 bytes payload
  if (/^[5KL9c][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(s)) {
    const p = base58CheckDecode(s);
    if (!p || p[0] === 0x80 || p[0] === 0xef) return 'sembla una clau privada (WIF)';
  }
  return null;
}

/** Detects a seed phrase split across a comma-separated env var (12+ plain words). */
export function listLooksLikeSeed(items: string[]): boolean {
  return items.length >= 12 && items.every((w) => /^[a-z]+$/i.test(w.trim()) && w.trim().length <= 8);
}

export function validateBtcAddress(input: string): Validation<BtcType> {
  const s = input.trim();
  const secret = looksLikeSecret(s);
  if (secret) return { ok: false, reason: secret };
  if (XPUB_RE.test(s)) return { ok: false, reason: 'xpub/ypub/zpub no s’accepta en aquest spike (posa adreces individuals)' };
  if (/^(tb1|bcrt1|[mn2])/i.test(s)) return { ok: false, reason: 'adreça de testnet/regtest: només mainnet' };

  if (/^bc1/i.test(s)) {
    const d = bech32Decode(s);
    if (!d || d.hrp !== 'bc' || d.data.length < 1) return { ok: false, reason: 'bech32/bech32m invàlid (checksum o format)' };
    const version = d.data[0]!;
    const prog = convertBits(d.data.slice(1), 5, 8, );
    if (!prog || prog.length < 2 || prog.length > 40 || version > 16) return { ok: false, reason: 'programa witness invàlid' };
    if (version === 0) {
      if (d.constant !== BECH32_CONST) return { ok: false, reason: 'segwit v0 ha d’usar bech32 (no bech32m)' };
      if (prog.length === 20) return { ok: true, value: s.toLowerCase(), type: 'p2wpkh' };
      if (prog.length === 32) return { ok: true, value: s.toLowerCase(), type: 'p2wsh' };
      return { ok: false, reason: 'longitud de programa v0 invàlida' };
    }
    if (d.constant !== BECH32M_CONST) return { ok: false, reason: 'segwit v1+ ha d’usar bech32m' };
    return { ok: true, value: s.toLowerCase(), type: version === 1 && prog.length === 32 ? 'p2tr' : 'segwit-vN' };
  }

  if (/^[13]/.test(s)) {
    const p = base58CheckDecode(s);
    if (!p || p.length !== 21) return { ok: false, reason: 'Base58Check invàlid (checksum o longitud)' };
    if (p[0] === 0x00) return { ok: true, value: s, type: 'p2pkh' };
    if (p[0] === 0x05) return { ok: true, value: s, type: 'p2sh' };
    return { ok: false, reason: 'versió Base58 desconeguda' };
  }
  return { ok: false, reason: 'format d’adreça BTC desconegut' };
}

export function toChecksumAddress(addr: string): string {
  const lower = addr.toLowerCase().replace(/^0x/, '');
  const hash = keccak256(lower).toString('hex');
  return '0x' + [...lower].map((c, i) => (parseInt(hash[i]!, 16) >= 8 ? c.toUpperCase() : c)).join('');
}

export function validateEvmAddress(input: string): Validation<'evm'> {
  const s = input.trim();
  const secret = looksLikeSecret(s);
  if (secret) return { ok: false, reason: secret };
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) return { ok: false, reason: 'format EVM invàlid (cal 0x + 40 hex)' };
  const hex = s.slice(2);
  const mixed = hex !== hex.toLowerCase() && hex !== hex.toUpperCase();
  if (mixed && toChecksumAddress(s) !== s) return { ok: false, reason: 'checksum EIP-55 invàlid' };
  return { ok: true, value: s, type: 'evm' };
}

export function splitList(v: string | undefined): string[] {
  return (v ?? '').split(',').map((x) => x.trim()).filter(Boolean);
}
