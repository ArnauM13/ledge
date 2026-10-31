import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anonymizeText, maskIban, shortHash, templatePath } from '../lib/anonymize.ts';

test('maskIban', () => {
  assert.equal(maskIban('ES9121000418450200051332'), 'ES91 **** **** 1332');
  assert.equal(maskIban('es91 2100 0418 4502 0005 1332'), 'ES91 **** **** 1332');
  assert.equal(maskIban(undefined), '—');
  assert.equal(maskIban('ES12'), '****');
});

test('anonymizeText treu IBAN, UUID, emails i imports', () => {
  const out = anonymizeText(
    'Account ES9121000418450200051332 (07cc67f4-45d6-494b-adac-09b5cbc7e2b5) of a@b.com has 1.234,56 EUR',
  );
  assert.equal(out.includes('0418'), false);
  assert.equal(out.includes('07cc67f4'), false);
  assert.equal(out.includes('a@b.com'), false);
  assert.equal(out.includes('1.234,56'), false);
  assert.match(out, /ES91 \*\*\*\* \*\*\*\* 1332/);
});

test('templatePath substitueix els UUID', () => {
  assert.equal(templatePath('/accounts/07cc67f4-45d6-494b-adac-09b5cbc7e2b5/balances'), '/accounts/:id/balances');
});

test('shortHash és estable i curt', () => {
  assert.equal(shortHash('x'), shortHash('x'));
  assert.equal(shortHash('x').length, 8);
});
