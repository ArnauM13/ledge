import { inspect } from 'node:util';
import { readSecretFile, SecretFileError } from '../config/secret-file';

export const MASTER_KEY_BYTES = 32;

/** Raised when the master key configuration is missing or invalid. */
export class MasterKeyError extends Error {
  override readonly name = 'MasterKeyError';
}

/**
 * The master keys held in memory, by version. Only the current version
 * encrypts; older versions (key rotation) can still decrypt.
 * Never serialised or printed: `JSON.stringify`/`console.log` show nothing.
 */
export class Keyring {
  readonly #keys: ReadonlyMap<number, Buffer>;

  constructor(
    readonly currentVersion: number,
    keys: ReadonlyMap<number, Buffer>,
  ) {
    if (!keys.has(currentVersion)) {
      throw new MasterKeyError(
        `no key for the current version ${currentVersion}`,
      );
    }
    for (const [version, key] of keys) {
      assertVersion(version, 'key version');
      if (key.length !== MASTER_KEY_BYTES) {
        throw new MasterKeyError(
          `key version ${version} must be ${MASTER_KEY_BYTES} bytes`,
        );
      }
    }
    this.#keys = keys;
  }

  get current(): Buffer {
    return this.#keys.get(this.currentVersion) as Buffer;
  }

  get(version: number): Buffer | undefined {
    return this.#keys.get(version);
  }

  get versions(): number[] {
    return [...this.#keys.keys()].sort((a, b) => a - b);
  }

  toJSON(): string {
    return '[Keyring]';
  }

  [inspect.custom](): string {
    return `Keyring { currentVersion: ${this.currentVersion}, versions: [${this.versions.join(', ')}] }`;
  }
}

function assertVersion(version: number, what: string): void {
  if (!Number.isInteger(version) || version < 1 || version > 255) {
    throw new MasterKeyError(`${what} must be an integer between 1 and 255`);
  }
}

/**
 * Decodes a key written as base64 (`openssl rand -base64 32`). Strict: the
 * text must be canonical base64 of exactly 32 bytes, and not a trivial key.
 */
export function decodeMasterKey(text: string, label: string): Buffer {
  const trimmed = text.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    throw new MasterKeyError(`${label}: not base64`);
  }
  const key = Buffer.from(trimmed, 'base64');
  if (key.length !== MASTER_KEY_BYTES || key.toString('base64') !== trimmed) {
    throw new MasterKeyError(
      `${label}: must be exactly ${MASTER_KEY_BYTES} bytes in base64 (openssl rand -base64 32)`,
    );
  }
  if (key.every((b) => b === key[0])) {
    throw new MasterKeyError(`${label}: trivial key (all bytes equal)`);
  }
  return key;
}

function readKey(varName: string, env: NodeJS.ProcessEnv): Buffer {
  try {
    return decodeMasterKey(readSecretFile(varName, env), varName);
  } catch (err) {
    if (err instanceof SecretFileError || err instanceof MasterKeyError) {
      throw new MasterKeyError(err.message);
    }
    throw err;
  }
}

/**
 * Loads the keyring at startup:
 * - LEDGE_MASTER_KEY_FILE (required): file with the current key.
 * - LEDGE_MASTER_KEY_VERSION (default 1): its version, written in every ciphertext.
 * - LEDGE_MASTER_KEY_PREVIOUS_FILES (optional, for rotation): comma-separated
 *   `version=/run/secrets/file` pairs. These keys only decrypt.
 * Any problem throws, so the API refuses to start.
 */
export function loadKeyring(env: NodeJS.ProcessEnv = process.env): Keyring {
  const versionRaw = env['LEDGE_MASTER_KEY_VERSION'] ?? '1';
  const currentVersion = Number(versionRaw);
  if (!/^\d+$/.test(versionRaw)) {
    throw new MasterKeyError('LEDGE_MASTER_KEY_VERSION must be an integer');
  }
  assertVersion(currentVersion, 'LEDGE_MASTER_KEY_VERSION');

  const keys = new Map<number, Buffer>([
    [currentVersion, readKey('LEDGE_MASTER_KEY_FILE', env)],
  ]);

  const previous = env['LEDGE_MASTER_KEY_PREVIOUS_FILES']?.trim();
  if (previous) {
    for (const entry of previous.split(',')) {
      const match = /^\s*(\d+)=(\/\S+)\s*$/.exec(entry);
      if (!match) {
        throw new MasterKeyError(
          'LEDGE_MASTER_KEY_PREVIOUS_FILES must be "version=/absolute/path" pairs separated by commas',
        );
      }
      const version = Number(match[1]);
      assertVersion(version, 'previous key version');
      if (keys.has(version)) {
        throw new MasterKeyError(`key version ${version} is defined twice`);
      }
      keys.set(
        version,
        readKey('LEDGE_MASTER_KEY_PREVIOUS_FILES', {
          LEDGE_MASTER_KEY_PREVIOUS_FILES: match[2],
        }),
      );
    }
  }

  const seen = new Set<string>();
  for (const key of keys.values()) {
    const hex = key.toString('hex');
    if (seen.has(hex)) {
      throw new MasterKeyError('two key versions share the same key');
    }
    seen.add(hex);
  }
  return new Keyring(currentVersion, keys);
}
