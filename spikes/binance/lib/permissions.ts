// Comprovació dels permisos de la clau abans de qualsevol altra crida.
// Docs: https://developers.binance.com/docs/wallet/account/api-key-permission
//   GET /sapi/v1/account/apiRestrictions (IP weight 1). Resposta d'exemple (verificada el 31/10/2026):
//   { ipRestrict, createTime, enableReading, enableWithdrawals, enableInternalTransfer, enableMargin,
//     enableFutures, permitsUniversalTransfer, enableVanillaOptions, enableFixApiTrade, enableFixReadOnly,
//     enableSpotAndMarginTrading, enablePortfolioMarginTrading }

/** Permisos que NO són de lectura. Si n'hi ha cap actiu, el spike s'atura. */
export const DANGEROUS_PERMISSIONS = [
  'enableSpotAndMarginTrading',
  'enableWithdrawals',
  'enableInternalTransfer',
  'permitsUniversalTransfer',
  'enableMargin',
  'enableFutures',
  'enableVanillaOptions',
  'enablePortfolioMarginTrading',
  'enableFixApiTrade',
] as const;

/** Permisos de només lectura (acceptats). */
export const READ_ONLY_PERMISSIONS = ['enableReading', 'enableFixReadOnly'] as const;

export interface PermissionCheck {
  ok: boolean;
  readingEnabled: boolean;
  ipRestricted: boolean;
  /** Permisos perillosos actius (coneguts o desconeguts). */
  dangerous: string[];
  /** Motius per aturar-se (en català). */
  problems: string[];
  /** Tots els camps booleans `enable*` / `permits*` que ha retornat l'API. */
  flags: Record<string, boolean>;
}

const PERMISSION_KEY_RE = /^(enable|permits)/;

/**
 * Decideix si la clau és de només lectura. Falla tancat:
 *  - qualsevol permís perillós conegut que no sigui exactament `false`;
 *  - qualsevol camp `enable*`/`permits*` desconegut amb valor `true` (permís nou que no coneixem);
 *  - resposta sense la forma esperada, o `enableReading` desactivat.
 */
export function checkPermissions(response: unknown): PermissionCheck {
  const problems: string[] = [];
  const dangerous: string[] = [];
  const flags: Record<string, boolean> = {};

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { ok: false, readingEnabled: false, ipRestricted: false, dangerous, flags, problems: ['Resposta inesperada de apiRestrictions (no és un objecte).'] };
  }
  const r = response as Record<string, unknown>;

  for (const [k, v] of Object.entries(r)) if (PERMISSION_KEY_RE.test(k) && typeof v === 'boolean') flags[k] = v;

  for (const k of DANGEROUS_PERMISSIONS) {
    if (k in r && r[k] !== false) dangerous.push(k);
  }
  const known = new Set<string>([...DANGEROUS_PERMISSIONS, ...READ_ONLY_PERMISSIONS]);
  for (const [k, v] of Object.entries(r)) {
    if (PERMISSION_KEY_RE.test(k) && !known.has(k) && v !== false) dangerous.push(`${k} (permís desconegut)`);
  }

  if (!('enableSpotAndMarginTrading' in r) || !('enableWithdrawals' in r)) {
    problems.push('La resposta no conté enableSpotAndMarginTrading / enableWithdrawals: no es pot confirmar que la clau sigui de només lectura.');
  }
  const readingEnabled = r.enableReading === true;
  if (!readingEnabled) problems.push('La clau no té "Enable Reading" actiu.');
  if (dangerous.length) {
    problems.push(`La clau té permisos que no són de lectura: ${dangerous.join(', ')}. Desactiva-los (o crea una clau nova només amb "Enable Reading").`);
  }

  return { ok: problems.length === 0, readingEnabled, ipRestricted: r.ipRestrict === true, dangerous, problems, flags };
}
