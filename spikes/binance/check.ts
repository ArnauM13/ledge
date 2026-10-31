// npm run bn:check
// Només comprova els permisos de la clau (GET /sapi/v1/account/apiRestrictions, IP weight 1).
// Docs: https://developers.binance.com/docs/wallet/account/api-key-permission
import { run } from '../lib/cli.ts';
import { reportHeader, writeOutputs } from '../lib/report.ts';
import { BinanceApiError, BnClient, explainBinanceError } from './lib/client.ts';
import { loadBnConfig } from './lib/config.ts';
import { guardOrStop, permissionsMarkdown } from './lib/guard.ts';
import { BN_REPORT_NOTE, callsMarkdown } from './lib/report.ts';

run(async () => {
  const client = new BnClient(loadBnConfig());
  const { raw, check } = await guardOrStop(client, 'bn-check', 'Binance — permisos de la clau (G3)');
  console.log(`Permisos de la clau: només lectura ✅ · restricció d'IP: ${check.ipRestricted ? 'sí' : 'NO ⚠️'}`);

  const md = [
    reportHeader('Binance — permisos de la clau (G3)', BN_REPORT_NOTE),
    '## Permisos',
    '',
    permissionsMarkdown(check),
    '',
    '## Crides',
    '',
    callsMarkdown(client),
  ].join('\n');
  writeOutputs('bn-check', { apiRestrictions: raw }, md);
}, (e) => (e instanceof BinanceApiError ? explainBinanceError(e) : undefined));
