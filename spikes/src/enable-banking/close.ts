/**
 * npm run eb:close [-- --member A|B]
 * Closes the stored session (and, where the ASPSP supports it, the consent) and deletes the local file.
 *
 * Endpoint (https://enablebanking.com/docs/api/reference):
 *   DELETE /sessions/{session_id}   ("Delete session")
 * No retries. If the session is already gone, the local file is deleted anyway.
 */
import { argString, parseArgs } from '../lib/args.ts';
import { SpikeError } from '../lib/env.ts';
import { EB_SESSION_DEAD_CODES, EbClient, ebErrorInfo } from './client.ts';
import { deleteSession, loadSession, memberLabel } from './store.ts';

async function main() {
  const member = memberLabel(argString(parseArgs(), 'member'));
  const stored = loadSession(member);
  if (!stored) throw new SpikeError(`No hi ha cap sessió desada per al membre ${member}.`);

  const r = await new EbClient().delete('DELETE /sessions/:id', `/sessions/${encodeURIComponent(stored.session_id)}`);
  const e = ebErrorInfo(r);
  if (r.ok) {
    console.log(`✓ Sessió del membre ${member} tancada.`);
  } else if (e.error && EB_SESSION_DEAD_CODES.has(e.error)) {
    console.log(`La sessió ja no era activa (${e.error}).`);
  } else {
    throw new SpikeError(`No s’ha pogut tancar la sessió: HTTP ${e.http_status} ${e.error ?? ''}. El fitxer local es conserva.`);
  }
  deleteSession(member);
  console.log(`Fitxer local output/eb-session-${member}.json esborrat.`);
}

main().catch((e: Error) => {
  console.error(e instanceof SpikeError ? `ERROR: ${e.message}` : `ERROR inesperat: ${e.name}: ${e.message}`);
  process.exit(1);
});
