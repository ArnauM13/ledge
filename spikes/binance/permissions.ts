/**
 * GET /sapi/v1/account/apiRestrictions — "Get API Key Permission (USER_DATA)", Weight(IP): 1
 * Verified against Binance's official OpenAPI spec (2026-10-31):
 *   https://github.com/binance/binance-api-swagger/blob/master/spot_api.yaml  (path /sapi/v1/account/apiRestrictions)
 *   Web page: https://developers.binance.com/docs/wallet (Account > Get API Key Permission)
 * Documented fields: ipRestrict, createTime, enableReading, enableSpotAndMarginTrading,
 * enableWithdrawals, enableInternalTransfer, enableMargin, enableFutures,
 * permitsUniversalTransfer, enableVanillaOptions, enablePortfolioMarginTrading,
 * tradingAuthorityExpirationTime. The wallet change log (2024-11-08) also mentions FIX API
 * trading/reading permission fields whose exact names were not verifiable.
 *
 * Policy: DEFAULT DENY. Any boolean field that is `true`, other than the explicitly read-only
 * ones below and `ipRestrict`, is treated as a write permission and aborts the spike.
 */
export const READ_ONLY_TRUE_ALLOWED = new Set(['enableReading', 'enableFixReadOnly']);
const NON_PERMISSION_BOOLEANS = new Set(['ipRestrict']);

export interface PermissionCheck {
  ok: boolean;
  violations: string[];
  warnings: string[];
}

export function checkApiRestrictions(r: unknown): PermissionCheck {
  const violations: string[] = [];
  const warnings: string[] = [];
  if (!r || typeof r !== 'object' || Array.isArray(r)) {
    return { ok: false, violations: ['Resposta d’apiRestrictions no vàlida'], warnings };
  }
  const o = r as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (v !== true) continue;
    if (READ_ONLY_TRUE_ALLOWED.has(k) || NON_PERMISSION_BOOLEANS.has(k)) continue;
    violations.push(k);
  }
  if (o.enableReading !== true) violations.push('enableReading no és true (la clau no pot llegir)');
  if (o.ipRestrict !== true) warnings.push('La clau NO té restricció d’IP (ipRestrict=false). Recomanat: restringir-la a la teva IP.');
  return { ok: violations.length === 0, violations, warnings };
}
