import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

/**
 * Error raised when a secret file is missing or invalid. The message names the
 * environment variable and the problem, never the file contents.
 */
export class SecretFileError extends Error {
  override readonly name = 'SecretFileError';
}

/**
 * Reads a secret from the file named by `env[varName]` (Compose secrets live
 * at /run/secrets/*). Secrets never come from the environment itself.
 * A single trailing newline (as written by `openssl rand ... > file`) is removed.
 */
export function readSecretFile(
  varName: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const path = env[varName];
  if (!path) {
    throw new SecretFileError(`${varName} is not set`);
  }
  if (!isAbsolute(path)) {
    throw new SecretFileError(`${varName} must be an absolute path`);
  }
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code ?? 'unknown error';
    throw new SecretFileError(`${varName}: cannot read the file (${code})`);
  }
  const value = content.replace(/\r?\n$/, '');
  if (value.length === 0) {
    throw new SecretFileError(`${varName}: the file is empty`);
  }
  if (/[\r\n]/.test(value)) {
    throw new SecretFileError(`${varName}: the file must hold a single line`);
  }
  return value;
}
