import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { validateBtcAddress } from '../wallets/lib/btc.ts';
import { assertNoSecrets, parseBtcAddresses, parseChains, parseEvmAddresses } from '../wallets/lib/config.ts';
import { toChecksumAddress, validateEvmAddress } from '../wallets/lib/evm.ts';
import { keccak256Hex, sponge256 } from '../wallets/lib/keccak.ts';
import { detectSecret } from '../wallets/lib/secrets.ts';

// --- Keccak ---
test('keccak256: vectors coneguts', () => {
  assert.equal(keccak256Hex(''), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccak256Hex('abc'), '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
});

test('la permutació coincideix amb el sha3-256 de node:crypto (també en diversos blocs)', () => {
  for (const len of [0, 1, 135, 136, 137, 300, 1000]) {
    const data = 'x'.repeat(len);
    assert.equal(sponge256(data, 0x06), createHash('sha3-256').update(data).digest('hex'), `len=${len}`);
  }
});

// --- EVM ---
// Vectors de l'EIP-55: https://eips.ethereum.org/EIPS/eip-55
const EIP55 = [
  '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
  '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
];

test('EIP-55: checksum dels vectors oficials', () => {
  for (const a of EIP55) {
    assert.equal(toChecksumAddress(a.toLowerCase()), a);
    assert.deepEqual(validateEvmAddress(a), { ok: true, checksummed: a, hadChecksum: true });
  }
});

test('EVM: tot minúscules o tot majúscules s\'accepta sense checksum', () => {
  const a = EIP55[0]!;
  assert.equal(validateEvmAddress(a.toLowerCase()).ok, true);
  assert.equal(validateEvmAddress('0x' + a.slice(2).toUpperCase()).ok, true);
});

test('EVM: checksum incorrecte o format invàlid', () => {
  const bad = EIP55[0]!.replace('aAeb', 'aaeb'); // canvia una lletra de caixa
  assert.equal(validateEvmAddress(bad).ok, false);
  assert.equal(validateEvmAddress('0x123').ok, false);
  assert.equal(validateEvmAddress('5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed').ok, false);
  assert.equal(validateEvmAddress('0x' + 'g'.repeat(40)).ok, false);
});

// --- BTC ---
test('BTC: adreces vàlides de mainnet', () => {
  const cases: [string, string][] = [
    ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'P2PKH'], // bloc gènesi
    ['3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'P2SH'],
    ['BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4', 'P2WPKH'], // BIP-173 (majúscules)
    ['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', 'P2WPKH'],
    ['bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', 'P2WSH'], // BIP-173
    ['bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0', 'P2TR'], // BIP-350
  ];
  for (const [a, type] of cases) {
    const v = validateBtcAddress(a);
    assert.ok(v.ok, `${a}: ${!v.ok ? v.reason : ''}`);
    assert.equal(v.ok && v.type, type);
  }
});

test('BTC: checksum incorrecte, testnet, barreja de caixa i bech32 en una v1', () => {
  assert.equal(validateBtcAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb').ok, false); // base58 checksum
  assert.equal(validateBtcAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5').ok, false); // bech32 checksum
  assert.equal(validateBtcAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx').ok, false); // testnet
  assert.equal(validateBtcAddress('bc1qW508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').ok, false); // mixed case
  // BIP-350: v1 codificada amb bech32 (no bech32m) és invàlida.
  assert.equal(validateBtcAddress('bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7k7grplx').ok, false);
  assert.equal(validateBtcAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed').ok, false);
});

test('BTC: xpub/zpub rebutjades', () => {
  const xpub = 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8';
  const v = validateBtcAddress(xpub);
  assert.equal(v.ok, false);
  assert.match(!v.ok ? v.reason : '', /xpub/);
});

// --- Secrets ---
// Els valors amb forma de secret es generen en temps d'execució per no tenir-los literals al repo.
const hex64 = () => 'ab'.repeat(32);
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const b58 = (n: number) => Array.from({ length: n }, (_, i) => B58[(i * 7) % 58]).join('');
const seed = (n: number) => Array.from({ length: n }, (_, i) => ['abandon', 'ability', 'able', 'about', 'above', 'absent'][i % 6]).join(' ');

test('detectSecret: seed phrases de 12 i 24 paraules (amb espais, comes o salts de línia)', () => {
  assert.equal(detectSecret(seed(12)), 'seed phrase');
  assert.equal(detectSecret(seed(24)), 'seed phrase');
  assert.equal(detectSecret(seed(12).replaceAll(' ', ',')), 'seed phrase');
  assert.equal(detectSecret(seed(24).replaceAll(' ', '\n')), 'seed phrase');
  assert.equal(detectSecret(`bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4, ${seed(12)}`), 'seed phrase');
  assert.equal(detectSecret(seed(11)), undefined);
});

test('detectSecret: claus privades (hex, WIF, xprv)', () => {
  assert.equal(detectSecret(hex64()), 'clau privada (hex)');
  assert.equal(detectSecret('0x' + hex64()), 'clau privada (hex)');
  assert.equal(detectSecret('5' + b58(50)), 'clau privada (WIF)');
  assert.equal(detectSecret('K' + b58(51)), 'clau privada (WIF)');
  assert.equal(detectSecret('L' + b58(51)), 'clau privada (WIF)');
  assert.equal(detectSecret('xprv' + b58(107)), 'clau privada estesa (xprv)');
  assert.equal(detectSecret('zprv' + b58(107)), 'clau privada estesa (xprv)');
});

test('detectSecret: les adreces públiques NO són secrets', () => {
  for (const a of ['1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', ...EIP55]) {
    assert.equal(detectSecret(a), undefined, a);
  }
});

test('assertNoSecrets: l\'error no conté mai el valor', () => {
  for (const secret of [hex64(), seed(12), 'K' + b58(51), 'xprv' + b58(107)]) {
    const raw = `bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4,${secret}`;
    assert.throws(() => assertNoSecrets('BTC_ADDRESSES', raw), (e: Error) => {
      assert.equal(e.message.includes(secret), false);
      assert.equal(e.message.includes('abandon'), false);
      assert.match(e.message, /BTC_ADDRESSES/);
      return true;
    });
  }
});

test('parseBtcAddresses / parseEvmAddresses: rebutgen secrets abans de validar', () => {
  assert.throws(() => parseBtcAddresses(seed(24)), /seed phrase/);
  assert.throws(() => parseEvmAddresses('0x' + hex64()), /clau privada/);
});

test('parseBtcAddresses / parseEvmAddresses: valida, normalitza i treu duplicats', () => {
  assert.deepEqual(parseBtcAddresses(' bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4 , BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4 ').map((x) => x.address), ['bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4']);
  assert.deepEqual(parseEvmAddresses(`${EIP55[0]!.toLowerCase()},${EIP55[0]}`), [EIP55[0]]);
  assert.throws(() => parseBtcAddresses('bc1qinvalid'), /element #1/);
  assert.throws(() => parseEvmAddresses(`${EIP55[1]},0x123`), /element #2/);
});

test('parseChains', () => {
  assert.deepEqual(parseChains(undefined), [1]);
  assert.deepEqual(parseChains('1, 8453,42161,1'), [1, 8453, 42161]);
  assert.throws(() => parseChains('eth'));
  assert.throws(() => parseChains('0'));
});
