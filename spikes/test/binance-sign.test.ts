import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hmacSha256Hex, parseRecvWindow, signParams, toQueryString } from '../binance/lib/sign.ts';

// Vector oficial (secció "HMAC Keys"):
// https://developers.binance.com/docs/binance-spot-api-docs/rest-api/request-security
const DOC_SECRET = 'NhqPtmdSJYdKjVHjA7PZj4Mge3R5YNiP1e3UZjInClVN65XAbvqqM6A7H5fATj0j';
const DOC_PAYLOAD = 'symbol=LTCBTC&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559';
const DOC_SIGNATURE = 'c8db56825ae71d6d79447849e617115f4a920fa2acdcab2b053c4b2838bd6b71';

test('HMAC-SHA256: vector de la documentació oficial', () => {
  assert.equal(hmacSha256Hex(DOC_PAYLOAD, DOC_SECRET), DOC_SIGNATURE);
});

test('HMAC-SHA256: vector oficial amb símbol no ASCII (percent-encoded abans de signar)', () => {
  const payload = 'symbol=%EF%BC%91%EF%BC%92%EF%BC%93%EF%BC%94%EF%BC%95%EF%BC%96&side=BUY&type=LIMIT&timeInForce=GTC&quantity=1&price=0.1&recvWindow=5000&timestamp=1499827319559';
  assert.equal(hmacSha256Hex(payload, DOC_SECRET), 'e1353ec6b14d888f1164ae9af8228a3dbd508bc82eb867db8ab6046442f33ef3');
  assert.equal(toQueryString({ symbol: '１２３４５６' }), 'symbol=%EF%BC%91%EF%BC%92%EF%BC%93%EF%BC%94%EF%BC%95%EF%BC%96');
});

test('signParams reprodueix el payload i la signatura de la doc', () => {
  const out = signParams(
    { symbol: 'LTCBTC', side: 'BUY', type: 'LIMIT', timeInForce: 'GTC', quantity: 1, price: 0.1 },
    DOC_SECRET,
    { recvWindow: 5000, timestamp: 1499827319559 },
  );
  assert.equal(out, `${DOC_PAYLOAD}&signature=${DOC_SIGNATURE}`);
});

test('toQueryString omet els undefined i manté l\'ordre', () => {
  assert.equal(toQueryString({ b: 1, a: undefined, c: true }), 'b=1&c=true');
});

test('parseRecvWindow: per defecte 5000, màxim 60000', () => {
  assert.equal(parseRecvWindow(undefined), 5000);
  assert.equal(parseRecvWindow('60000'), 60000);
  assert.throws(() => parseRecvWindow('60001'));
  assert.throws(() => parseRecvWindow('0'));
  assert.throws(() => parseRecvWindow('abc'));
});
