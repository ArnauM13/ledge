// Keccak-256 (la variant d'Ethereum, amb padding 0x01; NO és el SHA3-256 del NIST, que fa servir 0x06).
// node:crypto només ofereix 'sha3-256', que dona un resultat diferent, i per al checksum EIP-55
// cal Keccak-256. Implementació mínima amb BigInt per no afegir cap dependència: només es fa
// servir per validar unes poques adreces, el rendiment no importa.
const MASK = (1n << 64n) - 1n;
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
// Desplaçaments de rotació r[x][y].
const ROT = [
  [0, 36, 3, 41, 18],
  [1, 44, 10, 45, 2],
  [62, 6, 43, 15, 61],
  [28, 55, 25, 21, 56],
  [27, 20, 39, 8, 14],
];

const rotl = (v: bigint, n: number) => (n === 0 ? v : ((v << BigInt(n)) | (v >> BigInt(64 - n))) & MASK);

function keccakF(a: bigint[]): void {
  const c = new Array<bigint>(5);
  const b = new Array<bigint>(25);
  for (let round = 0; round < 24; round++) {
    for (let x = 0; x < 5; x++) c[x] = a[x]! ^ a[x + 5]! ^ a[x + 10]! ^ a[x + 15]! ^ a[x + 20]!;
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5]! ^ rotl(c[(x + 1) % 5]!, 1);
      for (let y = 0; y < 5; y++) a[x + 5 * y] = a[x + 5 * y]! ^ d;
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(a[x + 5 * y]!, ROT[x]![y]!);
    }
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) {
        a[x + 5 * y] = b[x + 5 * y]! ^ (~b[((x + 1) % 5) + 5 * y]! & MASK & b[((x + 2) % 5) + 5 * y]!);
      }
    }
    a[0] = a[0]! ^ RC[round]!;
  }
}

/** Keccak-256 en hex. */
export function keccak256Hex(input: Uint8Array | string): string {
  return sponge256(input, 0x01);
}

/**
 * Esponja de 256 bits. `domain` = 0x01 per a Keccak-256 (Ethereum) i 0x06 per a SHA3-256 (NIST).
 * S'exporta per poder comprovar la permutació contra el `sha3-256` de node:crypto als tests.
 */
export function sponge256(input: Uint8Array | string, domain: 0x01 | 0x06): string {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((data.length + 1) / rate) * rate);
  padded.set(data);
  padded[data.length]! ^= domain;
  padded[padded.length - 1]! ^= 0x80;

  const state = new Array<bigint>(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let j = 7; j >= 0; j--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + j]!);
      state[i] = state[i]! ^ lane;
    }
    keccakF(state);
  }
  let out = '';
  for (let i = 0; i < 4; i++) {
    let lane = state[i]!;
    for (let j = 0; j < 8; j++) {
      out += Number(lane & 0xffn).toString(16).padStart(2, '0');
      lane >>= 8n;
    }
  }
  return out;
}
