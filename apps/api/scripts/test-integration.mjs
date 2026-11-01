// Runs the API integration tests (*.int-spec.ts) against a real PostgreSQL.
//
//   npx nx run api:test-integration              # starts docker-compose.test.yml, stops it after
//   npx nx run api:test-integration -- --keep-db # leaves the test database running
//
// If DB_HOST is already set (e.g. a CI service container), that database is
// used instead of Docker. Either way DB_NAME must end in `_test`: the tests
// write data and must never run against a real database.
//
// Secrets are files, as in production: the test DB password lives in
// secrets/postgres_test_password (created here if missing) and a throwaway
// master key is written to a 0600 temp file for every run.
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const keepDb = process.argv.includes('--keep-db');
const env = { ...process.env };
let startedDocker = false;

function run(cmd, args, options = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    env,
    cwd: root,
    ...options,
  });
  if (res.status !== 0) {
    throw new Error(
      `${cmd} ${args.join(' ')} failed (exit ${res.status ?? res.signal})`,
    );
  }
}

const tempDir = mkdtempSync(join(tmpdir(), 'ledge-it-'));
let exitCode = 1;
try {
  if (!env.DB_HOST) {
    const secretsDir = join(root, 'secrets');
    const pwFile = join(secretsDir, 'postgres_test_password');
    if (!existsSync(pwFile)) {
      mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
      writeFileSync(pwFile, randomBytes(32).toString('base64') + '\n', {
        mode: 0o644,
      });
    }
    const port = env.DB_TEST_HOST_PORT ?? '55432';
    run('docker', [
      'compose',
      '-f',
      'docker-compose.test.yml',
      'up',
      '-d',
      '--wait',
    ]);
    startedDocker = true;
    Object.assign(env, {
      DB_HOST: '127.0.0.1',
      DB_PORT: port,
      DB_USER: 'ledge_test',
      DB_NAME: 'ledge_test',
      DB_PASSWORD_FILE: pwFile,
    });
  }
  if (!env.DB_NAME?.endsWith('_test')) {
    throw new Error('Refusing to run: DB_NAME must end in "_test".');
  }

  const keyFile = join(tempDir, 'master_key');
  writeFileSync(keyFile, randomBytes(32).toString('base64') + '\n', {
    mode: 0o600,
  });
  env.LEDGE_MASTER_KEY_FILE = keyFile;
  env.LEDGE_MASTER_KEY_VERSION = '1';
  env.NODE_ENV = 'test';

  run('npx', ['prisma', 'migrate', 'deploy'], { cwd: join(root, 'apps/api') });
  const jest = spawnSync(
    'npx',
    [
      'jest',
      '-c',
      'apps/api/jest.integration.config.cts',
      ...process.argv.slice(2).filter((a) => a !== '--keep-db'),
    ],
    { stdio: 'inherit', env, cwd: root },
  );
  exitCode = jest.status ?? 1;
} catch (err) {
  console.error(`test-integration: ${err.message}`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
  if (startedDocker && !keepDb) {
    try {
      execFileSync(
        'docker',
        ['compose', '-f', 'docker-compose.test.yml', 'down', '-v'],
        {
          cwd: root,
          stdio: 'inherit',
        },
      );
    } catch {
      // Best effort: the container only holds tmpfs data.
    }
  }
}
process.exit(exitCode);
