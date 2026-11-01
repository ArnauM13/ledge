import { readSecretFile } from './secret-file';

export class DatabaseConfigError extends Error {
  override readonly name = 'DatabaseConfigError';
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new DatabaseConfigError(`${name} is not set`);
  }
  return value;
}

/**
 * Builds the PostgreSQL connection URL at startup from DB_HOST, DB_PORT,
 * DB_USER, DB_NAME and the password in DB_PASSWORD_FILE.
 *
 * User and password are percent-encoded, so any character is safe.
 * The result contains the password: never log it, never put it in an error
 * message and never store it in the environment.
 */
export function buildDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const host = required(env, 'DB_HOST');
  const user = required(env, 'DB_USER');
  const name = required(env, 'DB_NAME');
  const portRaw = env['DB_PORT'] ?? '5432';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new DatabaseConfigError(
      'DB_PORT must be an integer between 1 and 65535',
    );
  }
  if (!/^[A-Za-z0-9.-]+$/.test(host)) {
    throw new DatabaseConfigError(
      'DB_HOST must be a hostname or an IPv4 address',
    );
  }
  const password = readSecretFile('DB_PASSWORD_FILE', env);

  const url = new URL('postgresql://placeholder');
  url.hostname = host;
  url.port = String(port);
  url.username = encodeURIComponent(user);
  url.password = encodeURIComponent(password);
  url.pathname = `/${encodeURIComponent(name)}`;
  return url.toString();
}
