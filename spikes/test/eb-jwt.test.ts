import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createEbJwt, EB_JWT_AUD, EB_JWT_ISS } from '../src/enable-banking/jwt.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));

test('JWT has the header and claims required by Enable Banking', () => {
  const jwt = createEbJwt({ appId: 'app-123', privateKey, nowSeconds: 1_700_000_000, ttlSeconds: 3600 });
  const [h, p, s] = jwt.split('.');
  assert.deepEqual(decode(h!), { typ: 'JWT', alg: 'RS256', kid: 'app-123' });
  assert.deepEqual(decode(p!), { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: 1_700_000_000, exp: 1_700_003_600 });
  assert.equal(EB_JWT_ISS, 'enablebanking.com');
  assert.equal(EB_JWT_AUD, 'api.enablebanking.com');
  assert.ok(verify('sha256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s!, 'base64url')), 'RS256 signature verifies');
});

test('accepts a PEM string', () => {
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const jwt = createEbJwt({ appId: 'x', privateKey: pem, nowSeconds: 1 });
  assert.equal(jwt.split('.').length, 3);
});

test('rejects TTL above 24 h and non-RSA keys', () => {
  assert.throws(() => createEbJwt({ appId: 'x', privateKey, ttlSeconds: 86_401 }));
  assert.doesNotThrow(() => createEbJwt({ appId: 'x', privateKey, ttlSeconds: 86_400 }));
  const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
  assert.throws(() => createEbJwt({ appId: 'x', privateKey: ec }), /RSA/);
  assert.throws(() => createEbJwt({ appId: '', privateKey }));
});
