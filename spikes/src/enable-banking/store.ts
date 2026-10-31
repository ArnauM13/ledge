import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ensureOutputDir } from '../lib/report.ts';
import type { StoredSession } from './types.ts';

export function memberLabel(raw: string | undefined): string {
  const m = (raw ?? 'A').toUpperCase();
  if (!/^[A-Z0-9_-]{1,16}$/.test(m)) throw new Error('--member ha de ser una etiqueta curta (p. ex. A o B)');
  return m;
}

/** Sessions are kept under spikes/output/ (git-ignored), never committed. */
export function sessionPath(member: string): string {
  return path.join(ensureOutputDir(), `eb-session-${member}.json`);
}

export function saveSession(s: StoredSession): string {
  const p = sessionPath(s.member);
  writeFileSync(p, JSON.stringify(s, null, 2) + '\n', { mode: 0o600 });
  return p;
}

export function loadSession(member: string): StoredSession | null {
  const p = sessionPath(member);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as StoredSession) : null;
}

export function deleteSession(member: string): void {
  rmSync(sessionPath(member), { force: true });
}

// ---- Local budget of fetch runs without the PSU present (max 4 / 24 h) ----

const LOG = () => path.join(ensureOutputDir(), 'eb-fetch-log.json');
export const MAX_FETCH_RUNS_PER_DAY = 4;

function readLog(): Record<string, string[]> {
  return existsSync(LOG()) ? (JSON.parse(readFileSync(LOG(), 'utf8')) as Record<string, string[]>) : {};
}

export function fetchRunsLast24h(member: string, now = Date.now()): number {
  return (readLog()[member] ?? []).filter((t) => now - Date.parse(t) < 24 * 3600 * 1000).length;
}

export function recordFetchRun(member: string, at = new Date()): void {
  const log = readLog();
  const cutoff = at.getTime() - 7 * 24 * 3600 * 1000;
  log[member] = [...(log[member] ?? []).filter((t) => Date.parse(t) > cutoff), at.toISOString()];
  writeFileSync(LOG(), JSON.stringify(log, null, 2) + '\n', { mode: 0o600 });
}
