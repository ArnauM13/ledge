/** Pure helpers for the eb:fetch report (unit-tested, no network). */

export interface TxLike {
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  status?: string;
}

export interface TxSummary {
  count: number;
  earliest: string | null;
  latest: string | null;
  span_days: number | null;
  by_status: Record<string, number>;
}

export function summarizeTransactions(txs: TxLike[]): TxSummary {
  const dates = txs
    .map((t) => t.booking_date ?? t.value_date ?? t.transaction_date ?? null)
    .filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d))
    .map((d) => d.slice(0, 10))
    .sort();
  const by_status: Record<string, number> = {};
  for (const t of txs) by_status[t.status ?? '?'] = (by_status[t.status ?? '?'] ?? 0) + 1;
  const earliest = dates[0] ?? null;
  const latest = dates[dates.length - 1] ?? null;
  const span_days =
    earliest && latest ? Math.round((Date.parse(latest) - Date.parse(earliest)) / 86_400_000) : null;
  return { count: txs.length, earliest, latest, span_days, by_status };
}

export function daysUntil(iso: string | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor((t - now.getTime()) / 86_400_000);
}
