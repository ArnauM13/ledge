/** Les APIs d'historial exigeixen "time between startTime and endTime must be less than 90 days". */
export const WINDOW_DAYS = 89;
export const MAX_HISTORY_DAYS = 365;
const DAY_MS = 86_400_000;

/** Divideix [now - days, now] en finestres de com a màxim 89 dies, de la més recent a la més antiga. */
export function historyWindows(nowMs: number, days: number): { startTime: number; endTime: number }[] {
  const out: { startTime: number; endTime: number }[] = [];
  const oldest = nowMs - days * DAY_MS;
  let end = nowMs;
  while (end > oldest) {
    const start = Math.max(oldest, end - WINDOW_DAYS * DAY_MS);
    out.push({ startTime: start, endTime: end });
    end = start - 1;
  }
  return out;
}

/** True si algun dels camps numèrics (strings de Binance) és > 0. */
export function anyPositive(obj: unknown, fields: string[]): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return fields.some((f) => Number(o[f]) > 0);
}
