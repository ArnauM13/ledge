import { createHash, randomBytes } from 'node:crypto';
import { RECOVERY_CODE_COUNT } from './auth.constants';

// Crockford-style base32 without ambiguous characters (no I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 16 characters x 5 bits = 80 random bits, shown as XXXX-XXXX-XXXX-XXXX. */
function generateCode(): string {
  const bytes = randomBytes(10);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out.match(/.{4}/g)?.join('-') ?? out;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateCode());
  }
  return [...codes];
}

/** Uppercase, without spaces or dashes; maps O->0 and I/L->1 like Crockford base32. */
export function normaliseRecoveryCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

/** SHA-256 of the normalised code. 80-bit codes make a slow hash unnecessary. */
export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normaliseRecoveryCode(code)).digest('hex');
}

export function looksLikeRecoveryCode(input: string): boolean {
  return /^[0-9A-Z]{16}$/.test(normaliseRecoveryCode(input));
}
