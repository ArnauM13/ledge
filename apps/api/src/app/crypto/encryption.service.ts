import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Keyring } from './master-key';

/**
 * Where an encrypted value lives. It becomes the AAD (additional
 * authenticated data): a ciphertext copied to another column or row fails to
 * decrypt.
 */
export interface EncryptionContext {
  /** Table name, e.g. `users`. */
  table: string;
  /** Column name, e.g. `totp_secret`. */
  column: string;
  /** Primary key of the row. */
  recordId: string;
}

/**
 * Decryption failed: wrong key, tampered data, wrong context or bad format.
 * Deliberately says nothing more.
 */
export class DecryptionError extends Error {
  override readonly name = 'DecryptionError';
  constructor() {
    super('Decryption failed');
  }
}

const FORMAT = 'v1'; // AES-256-GCM, 96-bit IV, 128-bit tag
const PREFIX = 'enc';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const B64URL = /^[A-Za-z0-9_-]*$/;

function aad(keyVersion: number, ctx: EncryptionContext): Buffer {
  for (const [name, value] of Object.entries(ctx)) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError(
        `EncryptionContext.${name} must be a non-empty string`,
      );
    }
  }
  // JSON array: unambiguous, whatever characters the parts contain.
  return Buffer.from(
    JSON.stringify([
      PREFIX,
      FORMAT,
      keyVersion,
      ctx.table,
      ctx.column,
      ctx.recordId,
    ]),
    'utf8',
  );
}

/**
 * AES-256-GCM field encryption.
 *
 * Output: `enc:v1:<keyVersion>:<iv>:<ciphertext>:<tag>` (base64url parts).
 * - A fresh random 96-bit IV per value (never reused with the same key).
 * - The key version is in the text, so keys can be rotated: old values still
 *   decrypt with their key and `needsReEncryption` finds them.
 * - AAD = format, key version and the record context.
 */
export class EncryptionService {
  constructor(private readonly keyring: Keyring) {}

  encrypt(plaintext: string | Buffer, ctx: EncryptionContext): string {
    const version = this.keyring.currentVersion;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.keyring.current, iv, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(aad(version, ctx));
    const data =
      typeof plaintext === 'string'
        ? Buffer.from(plaintext, 'utf8')
        : plaintext;
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      PREFIX,
      FORMAT,
      String(version),
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join(':');
  }

  decrypt(payload: string, ctx: EncryptionContext): Buffer {
    const parts = payload.split(':');
    if (parts.length !== 6 || parts[0] !== PREFIX || parts[1] !== FORMAT) {
      throw new DecryptionError();
    }
    const [, , versionText, ivText, ctText, tagText] = parts;
    if (
      !/^\d{1,3}$/.test(versionText) ||
      ![ivText, ctText, tagText].every((p) => B64URL.test(p))
    ) {
      throw new DecryptionError();
    }
    const version = Number(versionText);
    const key = this.keyring.get(version);
    const iv = Buffer.from(ivText, 'base64url');
    const tag = Buffer.from(tagText, 'base64url');
    if (!key || iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
      throw new DecryptionError();
    }
    // Validate the context before touching the cipher (programming errors
    // must surface as TypeError, not as a generic decryption failure).
    const additionalData = aad(version, ctx);
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(additionalData);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(ctText, 'base64url')),
        decipher.final(),
      ]);
    } catch {
      throw new DecryptionError();
    }
  }

  decryptString(payload: string, ctx: EncryptionContext): string {
    return this.decrypt(payload, ctx).toString('utf8');
  }

  /** True if the value was encrypted with an older key version. */
  needsReEncryption(payload: string): boolean {
    const version = Number(payload.split(':')[2]);
    return version !== this.keyring.currentVersion;
  }
}
