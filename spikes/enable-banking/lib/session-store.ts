import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OUTPUT_DIR, SpikeError } from './env.ts';
import type { SessionCreated } from './types.ts';

export interface StoredSession extends SessionCreated {
  member: string;
  saved_at: string;
}

const pathFor = (member: string) => resolve(OUTPUT_DIR, `eb-session-${member}.json`);

export function saveSession(member: string, s: SessionCreated): void {
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 });
  const data: StoredSession = { ...s, member, saved_at: new Date().toISOString() };
  writeFileSync(pathFor(member), JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}

export function hasSession(member: string): boolean {
  return existsSync(pathFor(member));
}

export function loadSession(member: string): StoredSession {
  if (!hasSession(member)) {
    throw new SpikeError(`No hi ha cap sessió desada per al membre ${member}. Executa primer: npm run eb:connect -- --aspsp BBVA --member ${member}`);
  }
  return JSON.parse(readFileSync(pathFor(member), 'utf8')) as StoredSession;
}

export function deleteSession(member: string): void {
  rmSync(pathFor(member), { force: true });
}
