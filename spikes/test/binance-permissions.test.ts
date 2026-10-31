import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPermissions } from '../binance/lib/permissions.ts';

/** Clau ideal: només lectura i restricció d'IP. */
const READ_ONLY = {
  ipRestrict: true,
  createTime: 1623840271000,
  enableReading: true,
  enableWithdrawals: false,
  enableInternalTransfer: false,
  enableMargin: false,
  enableFutures: false,
  permitsUniversalTransfer: false,
  enableVanillaOptions: false,
  enableFixApiTrade: false,
  enableFixReadOnly: true,
  enableSpotAndMarginTrading: false,
  enablePortfolioMarginTrading: false,
};

test('clau de només lectura: OK', () => {
  const c = checkPermissions(READ_ONLY);
  assert.equal(c.ok, true);
  assert.deepEqual(c.dangerous, []);
  assert.equal(c.ipRestricted, true);
});

test('l\'exemple de resposta de la doc oficial NO és segur (transferències i portfolio margin)', () => {
  // https://developers.binance.com/docs/wallet/account/api-key-permission
  const docExample = { ipRestrict: false, createTime: 1623840271000, enableReading: true, enableWithdrawals: false, enableInternalTransfer: true, enableMargin: false, enableFutures: false, permitsUniversalTransfer: true, enableVanillaOptions: false, enableFixApiTrade: false, enableFixReadOnly: true, enableSpotAndMarginTrading: false, enablePortfolioMarginTrading: true };
  const c = checkPermissions(docExample);
  assert.equal(c.ok, false);
  assert.deepEqual(c.dangerous.sort(), ['enableInternalTransfer', 'enablePortfolioMarginTrading', 'permitsUniversalTransfer']);
  assert.equal(c.ipRestricted, false);
});

for (const perm of ['enableSpotAndMarginTrading', 'enableWithdrawals', 'enableInternalTransfer', 'permitsUniversalTransfer', 'enableMargin', 'enableFutures', 'enableVanillaOptions', 'enablePortfolioMarginTrading', 'enableFixApiTrade']) {
  test(`permís perillós detectat: ${perm}`, () => {
    const c = checkPermissions({ ...READ_ONLY, [perm]: true });
    assert.equal(c.ok, false);
    assert.ok(c.dangerous.includes(perm));
  });
}

test('falla tancat: valor no booleà en un permís perillós', () => {
  assert.equal(checkPermissions({ ...READ_ONLY, enableWithdrawals: 'true' }).ok, false);
  assert.equal(checkPermissions({ ...READ_ONLY, enableFutures: null }).ok, false);
});

test('falla tancat: permís desconegut actiu', () => {
  const c = checkPermissions({ ...READ_ONLY, enableSomethingNew: true });
  assert.equal(c.ok, false);
  assert.match(c.dangerous.join(), /enableSomethingNew/);
  assert.equal(checkPermissions({ ...READ_ONLY, enableSomethingNew: false }).ok, true);
});

test('falla tancat: sense enableReading, resposta incompleta o no-objecte', () => {
  assert.equal(checkPermissions({ ...READ_ONLY, enableReading: false }).ok, false);
  assert.equal(checkPermissions({ enableReading: true }).ok, false);
  assert.equal(checkPermissions([]).ok, false);
  assert.equal(checkPermissions(null).ok, false);
  assert.equal(checkPermissions('x').ok, false);
});
