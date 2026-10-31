import { mdTable } from '../../lib/report.ts';
import type { BnClient } from './client.ts';

export const BN_REPORT_NOTE = 'Informe anonimitzat: sense imports, saldos, actius concrets, adreces, IDs de transacció ni claus.';

export function callsMarkdown(client: BnClient): string {
  const w = client.documentedWeight;
  const observed = client.maxObservedWeight;
  return [
    mdTable(
      ['Mètode', 'Ruta', 'HTTP', 'ms', 'Pes doc. (IP/UID)', 'Pes usat (capçaleres)', 'Codi', 'Error'],
      client.calls.map((c) => [
        c.method,
        `\`${c.path}\``,
        c.status || 'xarxa',
        c.ms,
        `${c.weight.ip ?? '—'} / ${c.weight.uid ?? '—'}`,
        Object.entries(c.usedWeight).map(([k, v]) => `${k}=${v}`).join(', '),
        c.code,
        c.error?.split('\n')[0],
      ]),
    ),
    '',
    `- Crides: ${client.calls.length}`,
    `- Pes documentat consumit: IP **${w.ip}**, UID **${w.uid}**`,
    `- Pes màxim observat a les capçaleres: ${Object.keys(observed).length ? Object.entries(observed).map(([k, v]) => `${k}=${v}`).join(', ') : '— (cap capçalera rebuda)'}`,
    client.halted ? `- **Aturat:** ${client.halted}` : '- No s\'ha arribat a cap límit',
  ].join('\n');
}
