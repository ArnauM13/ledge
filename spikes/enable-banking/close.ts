// npm run eb:close [-- --member A]
// Doc: https://enablebanking.com/docs/api/reference → DELETE /sessions/{session_id}
// Tanca la sessió (i el consentiment al banc si és possible) i esborra el fitxer local.
import { args, parseMember, run } from './lib/cli.ts';
import { EbApiError, EbClient } from './lib/client.ts';
import { loadEbConfig } from './lib/env.ts';
import { deleteSession, loadSession } from './lib/session-store.ts';

run(async () => {
  const member = parseMember(args({ member: { type: 'string', default: 'A' } }).member);
  const stored = loadSession(member);
  const client = new EbClient(loadEbConfig());
  try {
    await client.request('DELETE', `/sessions/${stored.session_id}`, { psu: true });
    console.log(`✓ Sessió del membre ${member} tancada.`);
  } catch (e) {
    if (!(e instanceof EbApiError) || !e.isSessionGone) throw e;
    console.log(`La sessió ja no existia (${e.errorCode}).`);
  }
  deleteSession(member);
  console.log(`Fitxer local output/eb-session-${member}.json esborrat.`);
});
