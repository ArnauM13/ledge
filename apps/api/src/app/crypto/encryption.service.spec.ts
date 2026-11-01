import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { Test } from '@nestjs/testing';
import { CryptoModule } from './crypto.module';
import {
  DecryptionError,
  EncryptionContext,
  EncryptionService,
} from './encryption.service';
import {
  decodeMasterKey,
  Keyring,
  loadKeyring,
  MasterKeyError,
} from './master-key';

const ctx: EncryptionContext = {
  table: 'users',
  column: 'totp_secret',
  recordId: 'user-1',
};
const keyring = (version = 1, key = randomBytes(32)) =>
  new Keyring(version, new Map([[version, key]]));

/** Flips one bit of the base64url part at `index` (3 = IV, 4 = ciphertext, 5 = tag). */
function tamper(payload: string, index: number): string {
  const parts = payload.split(':');
  const bytes = Buffer.from(parts[index], 'base64url');
  bytes[0] ^= 0x01;
  parts[index] = bytes.toString('base64url');
  return parts.join(':');
}

describe('EncryptionService (AES-256-GCM)', () => {
  const service = new EncryptionService(keyring());

  it('encrypts and decrypts', () => {
    const payload = service.encrypt('JBSWY3DPEHPK3PXP', ctx);
    expect(payload).toMatch(/^enc:v1:1:[\w-]{16}:[\w-]+:[\w-]{22}$/);
    expect(payload).not.toContain('JBSWY3DPEHPK3PXP');
    expect(service.decryptString(payload, ctx)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('handles binary data and empty strings', () => {
    const data = randomBytes(100);
    expect(service.decrypt(service.encrypt(data, ctx), ctx).equals(data)).toBe(
      true,
    );
    expect(service.decryptString(service.encrypt('', ctx), ctx)).toBe('');
  });

  it('uses a random IV per value', () => {
    const a = service.encrypt('same', ctx);
    const b = service.encrypt('same', ctx);
    expect(a).not.toBe(b);
    expect(a.split(':')[3]).not.toBe(b.split(':')[3]);
  });

  it.each([
    ['IV', 3],
    ['ciphertext', 4],
    ['tag', 5],
  ])('fails if the %s is tampered with', (_part, index) => {
    const payload = service.encrypt('secret value', ctx);
    expect(() => service.decrypt(tamper(payload, index), ctx)).toThrow(
      DecryptionError,
    );
  });

  it('fails if the key version in the header is changed', () => {
    const two = new EncryptionService(
      new Keyring(
        1,
        new Map([
          [1, randomBytes(32)],
          [2, randomBytes(32)],
        ]),
      ),
    );
    const payload = two.encrypt('x', ctx).replace(/^enc:v1:1:/, 'enc:v1:2:');
    expect(() => two.decrypt(payload, ctx)).toThrow(DecryptionError);
  });

  it('fails with a different key', () => {
    const payload = service.encrypt('secret value', ctx);
    const other = new EncryptionService(keyring());
    expect(() => other.decrypt(payload, ctx)).toThrow(DecryptionError);
  });

  it.each([
    ['another record', { ...ctx, recordId: 'user-2' }],
    ['another column', { ...ctx, column: 'other' }],
    ['another table', { ...ctx, table: 'households' }],
  ])('fails when moved to %s (AAD)', (_name, otherCtx) => {
    const payload = service.encrypt('secret value', ctx);
    expect(() => service.decrypt(payload, otherCtx)).toThrow(DecryptionError);
  });

  it.each([
    '',
    'garbage',
    'enc:v2:1:a:b:c',
    'enc:v1:1:!!:b:c',
    'enc:v1:9:AAAAAAAAAAAAAAAA:AA:AAAAAAAAAAAAAAAAAAAAAA',
  ])('rejects malformed payload %p', (payload) => {
    expect(() => service.decrypt(payload, ctx)).toThrow(DecryptionError);
  });

  it('error messages reveal nothing', () => {
    const payload = service.encrypt('secret value', ctx);
    try {
      new EncryptionService(keyring()).decrypt(payload, ctx);
      throw new Error('should have failed');
    } catch (err) {
      expect((err as Error).message).toBe('Decryption failed');
    }
  });

  it('rejects an empty context part', () => {
    expect(() => service.encrypt('x', { ...ctx, recordId: '' })).toThrow(
      TypeError,
    );
  });

  it('supports key rotation: old values decrypt, new ones use the current key', () => {
    const k1 = randomBytes(32);
    const k2 = randomBytes(32);
    const v1 = new EncryptionService(new Keyring(1, new Map([[1, k1]])));
    const old = v1.encrypt('rotate me', ctx);

    const v2 = new EncryptionService(
      new Keyring(
        2,
        new Map([
          [1, k1],
          [2, k2],
        ]),
      ),
    );
    expect(v2.needsReEncryption(old)).toBe(true);
    expect(v2.decryptString(old, ctx)).toBe('rotate me');
    const fresh = v2.encrypt('rotate me', ctx);
    expect(fresh.startsWith('enc:v1:2:')).toBe(true);
    expect(v2.needsReEncryption(fresh)).toBe(false);
    expect(() => v1.decrypt(fresh, ctx)).toThrow(DecryptionError);
  });
});

describe('master key loading', () => {
  let dir: string;
  const file = (name: string, content: string): string => {
    const path = join(dir, name);
    writeFileSync(path, content, { mode: 0o600 });
    return path;
  };
  const validKey = (): string => randomBytes(32).toString('base64') + '\n';

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledge-key-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('loads a 32-byte base64 key', () => {
    const ring = loadKeyring({ LEDGE_MASTER_KEY_FILE: file('k', validKey()) });
    expect(ring.currentVersion).toBe(1);
    expect(ring.current).toHaveLength(32);
  });

  it.each([
    ['missing variable', {}],
    ['missing file', { LEDGE_MASTER_KEY_FILE: '/nonexistent/ledge/key' }],
  ])('fails on %s', (_name, env) => {
    expect(() => loadKeyring(env)).toThrow(MasterKeyError);
  });

  it.each([
    ['too short', randomBytes(16).toString('base64')],
    ['too long', randomBytes(48).toString('base64')],
    ['hex instead of base64', randomBytes(32).toString('hex')],
    ['not base64', 'this is not a key at all, sorry!!'],
    ['all zeros', Buffer.alloc(32).toString('base64')],
  ])('rejects a key that is %s', (_name, content) => {
    expect(() =>
      loadKeyring({ LEDGE_MASTER_KEY_FILE: file('k', content) }),
    ).toThrow(MasterKeyError);
  });

  it('never includes the key in error messages', () => {
    const bad = randomBytes(31).toString('base64');
    try {
      loadKeyring({ LEDGE_MASTER_KEY_FILE: file('k', bad) });
    } catch (err) {
      expect(String(err)).not.toContain(bad);
    }
  });

  it('rejects an invalid version', () => {
    const env = {
      LEDGE_MASTER_KEY_FILE: file('k', validKey()),
      LEDGE_MASTER_KEY_VERSION: 'x',
    };
    expect(() => loadKeyring(env)).toThrow('LEDGE_MASTER_KEY_VERSION');
    expect(() =>
      loadKeyring({ ...env, LEDGE_MASTER_KEY_VERSION: '0' }),
    ).toThrow(MasterKeyError);
  });

  it('loads previous keys for rotation and rejects duplicates', () => {
    const env = {
      LEDGE_MASTER_KEY_FILE: file('k2', validKey()),
      LEDGE_MASTER_KEY_VERSION: '2',
      LEDGE_MASTER_KEY_PREVIOUS_FILES: `1=${file('k1', validKey())}`,
    };
    expect(loadKeyring(env).versions).toEqual([1, 2]);
    expect(() =>
      loadKeyring({
        ...env,
        LEDGE_MASTER_KEY_PREVIOUS_FILES: `2=${file('k3', validKey())}`,
      }),
    ).toThrow('defined twice');
    expect(() =>
      loadKeyring({
        ...env,
        LEDGE_MASTER_KEY_PREVIOUS_FILES: `1=${env.LEDGE_MASTER_KEY_FILE}`,
      }),
    ).toThrow('same key');
    expect(() =>
      loadKeyring({ ...env, LEDGE_MASTER_KEY_PREVIOUS_FILES: 'nonsense' }),
    ).toThrow(MasterKeyError);
  });

  it('the keyring never prints its keys', () => {
    const key = randomBytes(32);
    const ring = new Keyring(1, new Map([[1, key]]));
    for (const text of [
      JSON.stringify({ ring }),
      inspect(ring),
      String(inspect({ ring }, { depth: 5 })),
    ]) {
      expect(text).not.toContain(key.toString('hex'));
      expect(text).not.toContain(key.toString('base64'));
    }
  });

  it('decodeMasterKey accepts openssl output', () => {
    expect(decodeMasterKey(validKey(), 'k')).toHaveLength(32);
  });

  describe('API startup (CryptoModule)', () => {
    const saved = { ...process.env };
    afterEach(() => {
      process.env = { ...saved };
    });

    it('does not start without a key', async () => {
      delete process.env['LEDGE_MASTER_KEY_FILE'];
      await expect(
        Test.createTestingModule({ imports: [CryptoModule] }).compile(),
      ).rejects.toThrow(MasterKeyError);
    });

    it('does not start with an invalid key', async () => {
      process.env['LEDGE_MASTER_KEY_FILE'] = file('bad', 'short');
      await expect(
        Test.createTestingModule({ imports: [CryptoModule] }).compile(),
      ).rejects.toThrow(MasterKeyError);
    });

    it('starts with a valid key', async () => {
      process.env['LEDGE_MASTER_KEY_FILE'] = file('good', validKey());
      const moduleRef = await Test.createTestingModule({
        imports: [CryptoModule],
      })
        .setLogger({
          log: () => undefined,
          error: () => undefined,
          warn: () => undefined,
        })
        .compile();
      const svc = moduleRef.get(EncryptionService);
      expect(svc.decryptString(svc.encrypt('ok', ctx), ctx)).toBe('ok');
    });
  });
});
