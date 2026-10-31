import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNoSecrets, assertShareable, maskCryptoAddress, maskIban, maskId } from '../src/lib/anonymize.ts';

test('maskIban keeps country + check digits and last 4', () => {
  assert.equal(maskIban('ES9121000418450200051332'), 'ES91 **** **** 1332');
  assert.equal(maskIban('es91 2100 0418 4502 0005 1332'), 'ES91 **** **** 1332');
  assert.equal(maskIban(undefined), '(sense IBAN)');
  assert.equal(maskIban('ES12'), '****');
});

test('maskCryptoAddress / maskId', () => {
  assert.equal(maskCryptoAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), 'bc1qar…5mdq');
  assert.equal(maskCryptoAddress('short'), '****');
  assert.equal(maskId('497f6eca-6276-4993-bfeb-53cbbbba6f08'), '497f…');
});

test('assertShareable blocks unmasked IBANs, secrets, hex keys, JWTs and PEM', () => {
  assert.doesNotThrow(() => assertShareable(`| ${maskIban('ES9121000418450200051332')} | CACC |`));
  assert.throws(() => assertShareable('IBAN ES9121000418450200051332'));
  assert.throws(() => assertShareable('IBAN ES91 2100 0418 4502 0005 1332'));
  assert.throws(() => assertShareable('key=supersecretvalue', ['supersecretvalue']));
  assert.throws(() => assertShareable('sig c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71'));
  // Fake JWT built at runtime (no literal token in the repo)
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.throws(() => assertShareable(`${b64({ alg: 'RS256' })}.${b64({ iss: 'test' })}.${b64('not-a-signature')}`));
  assert.throws(() => assertShareable('-----BEGIN PRIVATE KEY-----'));
  assert.doesNotThrow(() => assertShareable('BBVA BBVAESMMXXX CACC 2026-01-01 ITAV CLBD'));
});

test('error messages never contain the offending value', () => {
  try {
    assertShareable('ES9121000418450200051332');
    assert.fail('should throw');
  } catch (e) {
    assert.ok(!(e as Error).message.includes('ES9121'));
  }
});

test('assertNoSecrets for raw files', () => {
  assert.throws(() => assertNoSecrets('{"k":"abcdef123"}', ['abcdef123']));
  assert.doesNotThrow(() => assertNoSecrets('{"iban":"ES9121000418450200051332"}', ['abcdef123']));
});
