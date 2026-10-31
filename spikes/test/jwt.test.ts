import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { createEbJwt, JWT_MAX_TTL_SECONDS } from '../enable-banking/lib/jwt.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

test('header i claims segons la doc d\'Enable Banking', () => {
  const jwt = createEbJwt('app-123', privateKey, { now: 1_700_000_000, ttlSeconds: 3600 });
  const [h, p] = jwt.split('.');
  assert.deepEqual(decode(h!), { typ: 'JWT', alg: 'RS256', kid: 'app-123' });
  assert.deepEqual(decode(p!), { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: 1_700_000_000, exp: 1_700_003_600 });
});

test('la signatura RS256 es verifica amb la clau pública', () => {
  const jwt = createEbJwt('app-123', privateKey);
  const [h, p, s] = jwt.split('.');
  const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, Buffer.from(s!, 'base64url'));
  assert.equal(ok, true);
});

test('rebutja TTL fora de rang', () => {
  assert.throws(() => createEbJwt('a', privateKey, { ttlSeconds: JWT_MAX_TTL_SECONDS + 1 }));
  assert.throws(() => createEbJwt('a', privateKey, { ttlSeconds: 0 }));
  assert.doesNotThrow(() => createEbJwt('a', privateKey, { ttlSeconds: JWT_MAX_TTL_SECONDS }));
});
