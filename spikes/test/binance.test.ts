import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSignedQuery, encodeParams, hmacSha256Hex } from '../binance/sign.ts';
import { checkApiRestrictions } from '../binance/permissions.ts';

test('HMAC-SHA256 hex matches RFC 4231 known-answer vectors', () => {
  // RFC 4231 test case 1 (key = 20 x 0x0b) and test case 2 (key "Jefe")
  assert.equal(
    hmacSha256Hex('Hi There', Buffer.alloc(20, 0x0b).toString('latin1')),
    'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
  );
  assert.equal(
    hmacSha256Hex('what do ya want for nothing?', 'Jefe'),
    '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
  );
});

test('signed query is percent-encoded and signature covers the exact string', () => {
  assert.equal(encodeParams({ a: 'x y', b: 'é' }), 'a=x%20y&b=%C3%A9');
  const q = buildSignedQuery({ size: 100 }, 'secret', 1_700_000_000_000, 10_000);
  const [unsigned, sig] = q.split('&signature=');
  assert.equal(unsigned, 'size=100&recvWindow=10000&timestamp=1700000000000');
  assert.equal(sig, hmacSha256Hex(unsigned!, 'secret'));
  assert.throws(() => buildSignedQuery({}, 's', 1, 60_001));
});

const readOnly = {
  ipRestrict: true,
  createTime: 1,
  enableReading: true,
  enableSpotAndMarginTrading: false,
  enableWithdrawals: false,
  enableInternalTransfer: false,
  enableMargin: false,
  enableFutures: false,
  permitsUniversalTransfer: false,
  enableVanillaOptions: false,
  enablePortfolioMarginTrading: false,
  tradingAuthorityExpirationTime: 0,
};

test('read-only key passes', () => {
  assert.deepEqual(checkApiRestrictions(readOnly), { ok: true, violations: [], warnings: [] });
});

test('any write permission stops the spike', () => {
  for (const k of ['enableSpotAndMarginTrading', 'enableWithdrawals', 'enableInternalTransfer', 'permitsUniversalTransfer', 'enableFutures', 'enableMargin']) {
    const r = checkApiRestrictions({ ...readOnly, [k]: true });
    assert.equal(r.ok, false, k);
    assert.ok(r.violations.includes(k));
  }
});

test('unknown permission flags are denied by default; FIX read-only allowed', () => {
  assert.equal(checkApiRestrictions({ ...readOnly, enableFixApiTrade: true }).ok, false);
  assert.equal(checkApiRestrictions({ ...readOnly, enableSomethingNew: true }).ok, false);
  assert.equal(checkApiRestrictions({ ...readOnly, enableFixReadOnly: true }).ok, true);
});

test('missing reading or IP restriction', () => {
  assert.equal(checkApiRestrictions({ ...readOnly, enableReading: false }).ok, false);
  const r = checkApiRestrictions({ ...readOnly, ipRestrict: false });
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
  assert.equal(checkApiRestrictions(null).ok, false);
  assert.equal(checkApiRestrictions([]).ok, false);
});
