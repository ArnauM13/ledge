import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDatabaseUrl, DatabaseConfigError } from './database-url';
import { readSecretFile, SecretFileError } from './secret-file';

describe('database URL', () => {
  let dir: string;
  const write = (name: string, content: string): string => {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  };
  const baseEnv = (passwordFile: string): NodeJS.ProcessEnv => ({
    DB_HOST: 'db',
    DB_PORT: '5432',
    DB_USER: 'ledge',
    DB_NAME: 'ledge',
    DB_PASSWORD_FILE: passwordFile,
  });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledge-dburl-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('builds the URL from DB_* and the password file', () => {
    const url = buildDatabaseUrl(baseEnv(write('pw', 'simple\n')));
    expect(url).toBe('postgresql://ledge:simple@db:5432/ledge');
  });

  it('percent-encodes passwords with reserved characters', () => {
    const password = 'p@ss:w/rd?#%&+= ä"\'';
    const url = new URL(buildDatabaseUrl(baseEnv(write('pw', password))));
    expect(decodeURIComponent(url.password)).toBe(password);
    expect(url.hostname).toBe('db');
    expect(url.pathname).toBe('/ledge');
  });

  it('accepts base64 passwords (+, / and =)', () => {
    const password = 'aB+/cD==';
    const url = new URL(buildDatabaseUrl(baseEnv(write('pw', password))));
    expect(decodeURIComponent(url.password)).toBe(password);
  });

  it('never puts the password in error messages', () => {
    const env = { ...baseEnv(write('pw', 'TopSecret123')), DB_PORT: 'abc' };
    expect(() => buildDatabaseUrl(env)).toThrow(DatabaseConfigError);
    try {
      buildDatabaseUrl(env);
    } catch (err) {
      expect(String(err)).not.toContain('TopSecret123');
    }
  });

  it.each(['DB_HOST', 'DB_USER', 'DB_NAME'])('requires %s', (name) => {
    const env = baseEnv(write('pw', 'x'));
    delete env[name];
    expect(() => buildDatabaseUrl(env)).toThrow(`${name} is not set`);
  });

  it('rejects a host that could inject URL parts', () => {
    const env = { ...baseEnv(write('pw', 'x')), DB_HOST: 'evil@host/x' };
    expect(() => buildDatabaseUrl(env)).toThrow(DatabaseConfigError);
  });

  describe('readSecretFile', () => {
    it('strips a single trailing newline', () => {
      const env = { S: write('s', 'value\n') };
      expect(readSecretFile('S', env)).toBe('value');
    });

    it('fails when the variable is missing', () => {
      expect(() => readSecretFile('S', {})).toThrow('S is not set');
    });

    it('fails on relative paths', () => {
      expect(() => readSecretFile('S', { S: 'secrets/x' })).toThrow(
        'must be an absolute path',
      );
    });

    it('fails when the file does not exist, without leaking its path content', () => {
      expect(() => readSecretFile('S', { S: join(dir, 'missing') })).toThrow(
        SecretFileError,
      );
    });

    it('fails on empty and multi-line files', () => {
      expect(() => readSecretFile('S', { S: write('e', '\n') })).toThrow(
        'empty',
      );
      expect(() => readSecretFile('S', { S: write('m', 'a\nb\n') })).toThrow(
        'single line',
      );
    });
  });
});
