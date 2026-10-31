import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { BinanceApiError, BnClient } from '../binance/lib/client.ts';
import { historyWindows } from '../binance/lib/history.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const cfg = { apiKey: 'k'.repeat(64), apiSecret: 's'.repeat(64), apiBase: 'https://api.binance.com', recvWindow: 5000 };

function fakeFetch(responses: { status: number; body: unknown; headers?: Record<string, string> }[]) {
  const seen: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL, init: RequestInit) => {
    seen.push({ url: String(url), init });
    const r = responses.shift() ?? { status: 200, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status, headers: r.headers });
  }) as typeof fetch;
  return seen;
}

test('GET signat: capçalera X-MBX-APIKEY i signature al query string', async () => {
  const seen = fakeFetch([{ status: 200, body: { ok: 1 }, headers: { 'X-SAPI-USED-IP-WEIGHT-1M': '1' } }]);
  const c = new BnClient(cfg, () => 1700000000000);
  await c.signed('apiRestrictions');
  const u = new URL(seen[0]!.url);
  assert.equal(u.pathname, '/sapi/v1/account/apiRestrictions');
  assert.equal(u.searchParams.get('timestamp'), '1700000000000');
  assert.equal(u.searchParams.get('recvWindow'), '5000');
  assert.match(u.searchParams.get('signature')!, /^[0-9a-f]{64}$/);
  assert.equal((seen[0]!.init.headers as Record<string, string>)['X-MBX-APIKEY'], cfg.apiKey);
  assert.deepEqual(c.calls[0]!.usedWeight, { 'x-sapi-used-ip-weight-1m': '1' });
  // El registre de crides no conté ni la clau ni la signatura.
  assert.equal(JSON.stringify(c.calls).includes(cfg.apiKey), false);
  assert.equal(JSON.stringify(c.calls).includes('signature'), false);
});

test('POST signat: paràmetres al cos form-urlencoded', async () => {
  const seen = fakeFetch([{ status: 200, body: [] }]);
  await new BnClient(cfg).signed('userAsset');
  assert.equal(seen[0]!.init.method, 'POST');
  assert.match(String(seen[0]!.init.body), /recvWindow=5000&timestamp=\d+&signature=[0-9a-f]{64}$/);
  assert.equal(new URL(seen[0]!.url).search, '');
});

for (const status of [429, 418]) {
  test(`HTTP ${status}: s'atura i no fa cap altra crida`, async () => {
    const seen = fakeFetch([{ status, body: { code: -1003, msg: 'Too much request weight used' }, headers: { 'Retry-After': '60' } }]);
    const c = new BnClient(cfg);
    await assert.rejects(c.signed('account'), (e: unknown) => e instanceof BinanceApiError && e.isRateLimit && e.retryAfter === '60');
    assert.ok(c.halted);
    await assert.rejects(c.signed('userAsset'));
    assert.equal(seen.length, 1);
  });
}

test('-2015 (clau/IP/permisos) és fatal i atura el client', async () => {
  fakeFetch([{ status: 401, body: { code: -2015, msg: 'Invalid API-key, IP, or permissions for action.' } }]);
  const c = new BnClient(cfg);
  await assert.rejects(c.signed('account'), (e: unknown) => e instanceof BinanceApiError && e.code === -2015);
  assert.match(c.halted!, /-2015/);
});

test('error no fatal (p. ex. -1102) no atura el client', async () => {
  fakeFetch([{ status: 400, body: { code: -1102, msg: 'Mandatory parameter' } }, { status: 200, body: [] }]);
  const c = new BnClient(cfg);
  await assert.rejects(c.signed('earnLocked'));
  assert.equal(c.halted, undefined);
  await c.signed('userAsset');
});

test('pes massa alt a les capçaleres: atura preventivament', async () => {
  fakeFetch([{ status: 200, body: {}, headers: { 'X-SAPI-USED-UID-WEIGHT-1M': '150000' } }]);
  const c = new BnClient(cfg);
  await c.signed('withdrawHistory');
  assert.match(c.halted!, /uid-weight/);
});

test('endpoint fora de la llista blanca: rebutjat sense xarxa', async () => {
  const seen = fakeFetch([]);
  await assert.rejects(new BnClient(cfg).signed('order' as never));
  assert.equal(seen.length, 0);
});

test('pes documentat acumulat', async () => {
  fakeFetch([{ status: 200, body: {} }, { status: 200, body: [] }, { status: 200, body: [] }]);
  const c = new BnClient(cfg);
  await c.signed('apiRestrictions');
  await c.signed('walletBalance');
  await c.signed('withdrawHistory');
  assert.deepEqual(c.documentedWeight, { ip: 61, uid: 18000 });
});

test('historyWindows: finestres < 90 dies que cobreixen el període', () => {
  const now = Date.UTC(2026, 9, 31);
  const DAY = 86_400_000;
  assert.equal(historyWindows(now, 90).length, 2);
  assert.equal(historyWindows(now, 89).length, 1);
  const w = historyWindows(now, 365);
  assert.equal(w.length, 5);
  for (const x of w) assert.ok(x.endTime - x.startTime < 90 * DAY);
  assert.equal(w[0]!.endTime, now);
  assert.equal(w.at(-1)!.startTime, now - 365 * DAY);
});
