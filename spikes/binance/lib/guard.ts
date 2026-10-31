import { mdTable, reportHeader, writeOutputs } from '../../lib/report.ts';
import { SpikeError } from '../../lib/env.ts';
import { BinanceApiError, explainBinanceError, type BnClient } from './client.ts';
import { BN_REPORT_NOTE, callsMarkdown } from './report.ts';
import { checkPermissions, DANGEROUS_PERMISSIONS, type PermissionCheck } from './permissions.ts';

export interface GuardResult {
  raw: unknown;
  check: PermissionCheck;
}

/**
 * PRIMER PAS OBLIGATORI: GET /sapi/v1/account/apiRestrictions.
 * Si la crida falla o la clau té qualsevol permís que no sigui de lectura, llença un error i no es fa res més.
 */
export async function verifyReadOnlyKey(client: BnClient): Promise<GuardResult> {
  const raw = await client.signed<unknown>('apiRestrictions');
  const check = checkPermissions(raw);
  return { raw, check };
}

export function assertReadOnly(check: PermissionCheck): void {
  if (!check.ok) {
    throw new SpikeError(
      ['⛔ CLAU NO SEGURA. El spike s\'atura i no fa cap altra crida.', ...check.problems.map((p) => `  - ${p}`)].join('\n'),
    );
  }
}

export function permissionsMarkdown(check: PermissionCheck): string {
  const dangerous = new Set<string>(DANGEROUS_PERMISSIONS);
  const rows = Object.entries(check.flags)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => [k, v ? 'sí' : 'no', dangerous.has(k) ? 'perillós' : k === 'enableReading' || k === 'enableFixReadOnly' ? 'lectura' : 'desconegut']);
  return [
    `- Veredicte: **${check.ok ? 'només lectura ✅' : 'NO segura ⛔'}**`,
    `- Restricció d'IP: **${check.ipRestricted ? 'sí' : 'NO ⚠️ (recomanat activar-la)'}**`,
    ...check.problems.map((p) => `- ⛔ ${p}`),
    '',
    mdTable(['Permís', 'Actiu', 'Tipus'], rows),
  ].join('\n');
}

/**
 * Fa el primer pas obligatori i, si falla (error de l'API o clau no segura), desa l'informe
 * `<outputName>` amb el motiu i llença l'error. Només retorna si la clau és de només lectura.
 */
export async function guardOrStop(client: BnClient, outputName: string, title: string): Promise<GuardResult> {
  let result: GuardResult;
  try {
    result = await verifyReadOnlyKey(client);
  } catch (e) {
    if (e instanceof BinanceApiError) {
      writeOutputs(outputName, { apiRestrictionsError: { status: e.status, code: e.code } }, [
        reportHeader(title, BN_REPORT_NOTE),
        `**Aturat:** no s'han pogut llegir els permisos de la clau. ${explainBinanceError(e).replace(/\n/g, ' ')}`,
        '', '## Crides', '', callsMarkdown(client),
      ].join('\n'));
    }
    throw e;
  }
  if (!result.check.ok) {
    writeOutputs(outputName, { apiRestrictions: result.raw }, [
      reportHeader(title, BN_REPORT_NOTE),
      '## Permisos de la clau', '', permissionsMarkdown(result.check), '',
      '**Aturat abans de fer cap altra crida.**', '', '## Crides', '', callsMarkdown(client),
    ].join('\n'));
    assertReadOnly(result.check);
  }
  return result;
}
