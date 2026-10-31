import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { keccak256, keccakSponge256 } from '../src/wallets/keccak.ts';
import { listLooksLikeSeed, looksLikeSecret, splitList, validateBtcAddress, validateEvmAddress } from '../src/wallets/validate.ts';

// Public, well-known address (Bitcoin genesis block coinbase)
const GENESIS_P2PKH = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

// Secret-shaped fixtures are generated at runtime from trivial bytes, so no literal key lives in the repo.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58CheckEncode(payload: Buffer): string {
  const sum = createHash('sha256').update(createHash('sha256').update(payload).digest()).digest().subarray(0, 4);
  const buf = Buffer.concat([payload, sum]);
  let n = BigInt('0x' + buf.toString('hex'));
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

const ok = (r: { ok: boolean }) => r.ok;
const reason = (r: { ok: boolean; reason?: string }) => (r as { reason: string }).reason;

test('keccak256 test vector and SHA3 cross-check of the permutation', () => {
  assert.equal(keccak256('').toString('hex'), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  for (const len of [0, 1, 135, 136, 137, 300]) {
    const d = Buffer.alloc(len, 0xab);
    assert.equal(keccakSponge256(d, 0x06).toString('hex'), createHash('sha3-256').update(d).digest('hex'), `len ${len}`);
  }
});

test('valid BTC mainnet addresses', () => {
  const cases: Array<[string, string]> = [
    [GENESIS_P2PKH, 'p2pkh'],
    ['3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'p2sh'],
    ['bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'p2wpkh'],
    ['BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ', 'p2wpkh'],
    ['bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3', 'p2wsh'],
    ['bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0', 'p2tr'],
  ];
  for (const [a, t] of cases) assert.deepEqual(validateBtcAddress(a), { ok: true, value: /^bc1/i.test(a) ? a.toLowerCase() : a, type: t });
});

test('invalid BTC inputs', () => {
  assert.ok(!ok(validateBtcAddress(GENESIS_P2PKH.slice(0, -1) + 'b')), 'bad base58 checksum');
  assert.ok(!ok(validateBtcAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdx')), 'bad bech32 checksum');
  assert.ok(!ok(validateBtcAddress('bc1qar0srrr7xfkvy5l643lydnw9re59GTZZWF5MDQ')), 'mixed case');
  assert.match(reason(validateBtcAddress('tb1qw508d6qejxtdg4c4ute8lumtvkjdhf6vu43t4')), /testnet/);
  const xpub = 'xpub' + 'B'.repeat(107);
  assert.match(reason(validateBtcAddress(xpub)), /xpub/);
  assert.ok(!ok(validateBtcAddress('')));
});

test('valid / invalid EVM addresses (EIP-55)', () => {
  for (const a of [
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
    '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
    '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
  ]) assert.ok(ok(validateEvmAddress(a)), a);
  assert.match(reason(validateEvmAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD')), /EIP-55/);
  assert.ok(!ok(validateEvmAddress('0x123')));
  assert.ok(!ok(validateEvmAddress('5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')));
});

test('rejects seed phrases and private keys without echoing them', () => {
  const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const hexKey = '0x' + '11'.repeat(32);
  const wif = base58CheckEncode(Buffer.concat([Buffer.from([0x80]), Buffer.alloc(32, 0x11)]));
  const wifC = base58CheckEncode(Buffer.concat([Buffer.from([0x80]), Buffer.alloc(32, 0x11), Buffer.from([0x01])]));
  const xprv = 'xprv' + 'A'.repeat(107);
  for (const s of [seed, hexKey, hexKey.slice(2), wif, wifC, xprv, '-----BEGIN PRIVATE KEY-----']) {
    const r1 = validateBtcAddress(s);
    const r2 = validateEvmAddress(s);
    assert.ok(!ok(r1) && !ok(r2));
    assert.ok(looksLikeSecret(s), s.slice(0, 6));
    assert.ok(!reason(r1).includes(s.slice(0, 10)) && !reason(r2).includes(s.slice(0, 10)));
  }
  assert.match(reason(validateBtcAddress(seed)), /seed/);
  assert.ok(listLooksLikeSeed(seed.split(' ')));
  assert.ok(!listLooksLikeSeed([GENESIS_P2PKH]));
  assert.equal(looksLikeSecret(GENESIS_P2PKH), null);
});

test('splitList', () => {
  assert.deepEqual(splitList(' a, b ,,c '), ['a', 'b', 'c']);
  assert.deepEqual(splitList(undefined), []);
});
