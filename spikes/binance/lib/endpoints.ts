// Endpoints que pot cridar el spike. És una LLISTA BLANCA: el client rebutja qualsevol altra ruta.
// Tots són de lectura (USER_DATA). Pesos i paràmetres verificats a la documentació oficial el 31/10/2026.

export interface EndpointDef {
  method: 'GET' | 'POST';
  path: string;
  /** Pes documentat per crida. `ip` compta contra el límit per IP; `uid`, contra el límit per compte. */
  weight: { ip?: number; uid?: number };
  doc: string;
  label: string;
}

export const ENDPOINTS = {
  // GET, IP weight 1. Primer pas obligatori.
  apiRestrictions: {
    method: 'GET', path: '/sapi/v1/account/apiRestrictions', weight: { ip: 1 }, label: 'Permisos de la clau',
    doc: 'https://developers.binance.com/docs/wallet/account/api-key-permission',
  },
  // GET, IP weight 20. Paràmetre omitZeroBalances (per defecte false).
  account: {
    method: 'GET', path: '/api/v3/account', weight: { ip: 20 }, label: 'Compte spot',
    doc: 'https://developers.binance.com/docs/binance-spot-api-docs/rest-api/account-endpoints',
  },
  // POST, IP weight 5. "Get user assets, just for positive data." Sense `asset` -> tots els actius positius.
  userAsset: {
    method: 'POST', path: '/sapi/v3/asset/getUserAsset', weight: { ip: 5 }, label: 'Actius de l\'usuari (getUserAsset)',
    doc: 'https://developers.binance.com/docs/wallet/asset/user-assets',
  },
  // POST, IP weight 1. Segons la doc: "Currently supports querying the following business assets:
  // Binance Pay, Binance Card, Binance Gift Card, Stock Token".
  fundingAsset: {
    method: 'POST', path: '/sapi/v1/asset/get-funding-asset', weight: { ip: 1 }, label: 'Funding wallet',
    doc: 'https://developers.binance.com/docs/wallet/asset/funding-wallet',
  },
  // GET, IP weight 60. quoteAsset (per defecte BTC), needBalanceDetail (per defecte false).
  walletBalance: {
    method: 'GET', path: '/sapi/v1/asset/wallet/balance', weight: { ip: 60 }, label: 'Saldo per wallet',
    doc: 'https://developers.binance.com/docs/wallet/asset/query-user-wallet-balance',
  },
  // GET, IP weight 150. Paginat: current (des de 1), size (màx. 100, per defecte 10). Resposta { rows, total }.
  // Nota: la URL antiga /docs/simple_earn/account/... ara no mostra contingut; la vigent és sota /flexible-locked/.
  earnFlexible: {
    method: 'GET', path: '/sapi/v1/simple-earn/flexible/position', weight: { ip: 150 }, label: 'Simple Earn flexible',
    doc: 'https://developers.binance.com/docs/simple_earn/flexible-locked/account/Get-Flexible-Product-Position',
  },
  // GET, IP weight 150. Mateixa paginació. Resposta { rows, total }.
  earnLocked: {
    method: 'GET', path: '/sapi/v1/simple-earn/locked/position', weight: { ip: 150 }, label: 'Simple Earn locked',
    doc: 'https://developers.binance.com/docs/simple_earn/flexible-locked/account/Get-Locked-Product-Position',
  },
  // GET, IP weight 1. startTime/endTime: interval < 90 dies; per defecte, els últims 90 dies. limit màx. 1000.
  depositHistory: {
    method: 'GET', path: '/sapi/v1/capital/deposit/hisrec', weight: { ip: 1 }, label: 'Historial de dipòsits',
    doc: 'https://developers.binance.com/docs/wallet/capital/deposite-history',
  },
  // GET. La doc diu literalment "Account Weight 18000 (10 requests per second)" -> compta contra el límit per UID.
  // startTime/endTime: interval < 90 dies; per defecte, els últims 90 dies. limit màx. 1000.
  withdrawHistory: {
    method: 'GET', path: '/sapi/v1/capital/withdraw/history', weight: { uid: 18_000 }, label: 'Historial de retirades',
    doc: 'https://developers.binance.com/docs/wallet/capital/withdraw-history',
  },
} as const satisfies Record<string, EndpointDef>;

export type EndpointName = keyof typeof ENDPOINTS;

// Límits (https://developers.binance.com/docs/wallet/general-info):
//  - /sapi/*: "Each endpoint with IP limits has an independent 12000 per minute limit" i
//    "Each endpoint with UID limits has an independent 180000 per minute limit".
//    Capçaleres X-SAPI-USED-IP-WEIGHT-1M i X-SAPI-USED-UID-WEIGHT-1M. A /sapi/* l'excés sempre és 429 (no 418).
//  - /api/*: "Endpoints share the 6000 per minute limit based on IP". Capçalera X-MBX-USED-WEIGHT-1M.
//  - 429 = límit superat; 418 = IP bandejada per continuar després d'un 429. Retry-After en segons.
export const LIMITS = {
  'x-sapi-used-ip-weight-1m': 12_000,
  'x-sapi-used-uid-weight-1m': 180_000,
  'x-mbx-used-weight-1m': 6_000,
} as const;

/** Fracció del límit a partir de la qual el spike s'atura per prudència. */
export const WEIGHT_SAFETY_RATIO = 0.5;
