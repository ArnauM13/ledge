import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anonymizeCryptoText, anonymizeText, maskAddress, maskIban, shortHash, templatePath } from '../lib/anonymize.ts';

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

test('maskAddress', () => {
  assert.equal(maskAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'), 'bc1q…f3t4');
  assert.equal(maskAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), '1A1z…vfNa');
  assert.equal(maskAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'), '0x5aAe…eAed');
  assert.equal(maskAddress(undefined), '—');
  assert.equal(maskAddress('short'), '****');
});

test('anonymizeCryptoText emmascara adreces, hex de 64 i imports decimals', () => {
  const out = anonymizeCryptoText(
    'Address bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 and 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed and 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa sent 0.00012345 BTC tx ' + 'ab'.repeat(32),
  );
  assert.equal(out.includes('w508d6qejxtdg4y5'), false);
  assert.equal(out.includes('6053F3E94C9b9A09'), false);
  assert.equal(out.includes('eP5QGefi2DMPTfTL'), false);
  assert.equal(out.includes('0.00012345'), false);
  assert.equal(out.includes('abab'), false);
  assert.match(out, /bc1q…f3t4/);
  assert.match(out, /0x5aAe…eAed/);
});

test('anonymizeText (Enable Banking) no ha canviat de comportament amb adreces', () => {
  // Les regles cripto són a anonymizeCryptoText; anonymizeText es manté igual que abans del refactor.
  assert.equal(anonymizeText('0.00012345'), '0.00012345');
});
