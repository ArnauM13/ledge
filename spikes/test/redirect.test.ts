import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isInside } from '../lib/env.ts';
import { computeValidUntil, parseRedirectUrl } from '../enable-banking/lib/redirect.ts';

test('extreu el code si el state coincideix', () => {
  assert.equal(parseRedirectUrl('https://localhost:3000/callback?state=s1&code=abc', 's1'), 'abc');
});

test('rebutja state incorrecte, errors i URLs sense code', () => {
  assert.throws(() => parseRedirectUrl('https://localhost:3000/callback?state=x&code=abc', 's1'), /state/);
  assert.throws(() => parseRedirectUrl('https://localhost:3000/callback?error=access_denied&state=s1', 's1'), /access_denied/);
  assert.throws(() => parseRedirectUrl('https://localhost:3000/callback?state=s1', 's1'), /code/);
  assert.throws(() => parseRedirectUrl('no és una url', 's1'), /URL/);
});

test('valid_until no supera el màxim de l\'ASPSP', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const max = 180 * 86_400;
  const v = computeValidUntil(max, undefined, now);
  assert.match(v, /\+00:00$/);
  const secs = (Date.parse(v) - now.getTime()) / 1000;
  assert.ok(secs < max && secs > max - 600);
  const short = computeValidUntil(max, 30, now);
  assert.ok((Date.parse(short) - now.getTime()) / 1000 <= 30 * 86_400);
  const capped = computeValidUntil(max, 400, now);
  assert.ok((Date.parse(capped) - now.getTime()) / 1000 < max);
});

test('isInside detecta claus dins del repo', () => {
  assert.equal(isInside('/home/u/ledge/key.pem', '/home/u/ledge'), true);
  assert.equal(isInside('/home/u/ledge-secrets/key.pem', '/home/u/ledge'), false);
  assert.equal(isInside('/home/u/.secrets/ledge/key.pem', '/home/u/ledge'), false);
});
