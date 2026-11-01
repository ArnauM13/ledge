/**
 * Net worth time series for chart G-1 (docs/CHARTS.md §3).
 * Amounts are decimal strings: Postgres NUMERIC must not lose precision in JSON.
 */
export type DecimalString = string;
export type ValueQuality = 'REAL' | 'ESTIMATED';

export interface NetWorthPoint {
  /** ISO 8601 day: YYYY-MM-DD. */
  date: string;
  /** Household total. */
  total: DecimalString;
  /** memberId → amount. */
  byMember: Record<string, DecimalString>;
  quality: ValueQuality;
}

export interface NetWorthMember {
  id: string;
  label: string;
}

export interface NetWorthSeries {
  currency: 'EUR';
  /** Fixed order → fixed colour. */
  members: NetWorthMember[];
  /** Sorted by date, no duplicates. */
  points: NetWorthPoint[];
}

const DECIMAL = /^-?\d+(\.\d+)?$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function isDecimalString(value: unknown): value is DecimalString {
  return typeof value === 'string' && DECIMAL.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPoint(value: unknown, memberIds: Set<string>): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const byMember = value['byMember'];
  return (
    typeof value['date'] === 'string' &&
    ISO_DAY.test(value['date']) &&
    isDecimalString(value['total']) &&
    (value['quality'] === 'REAL' || value['quality'] === 'ESTIMATED') &&
    isRecord(byMember) &&
    Object.entries(byMember).every(
      ([id, amount]) => memberIds.has(id) && isDecimalString(amount),
    )
  );
}

export function isNetWorthSeries(value: unknown): value is NetWorthSeries {
  if (!isRecord(value) || value['currency'] !== 'EUR') {
    return false;
  }
  const members = value['members'];
  const points = value['points'];
  if (!Array.isArray(members) || !Array.isArray(points)) {
    return false;
  }
  const ids = new Set<string>();
  for (const m of members) {
    if (
      !isRecord(m) ||
      typeof m['id'] !== 'string' ||
      typeof m['label'] !== 'string' ||
      ids.has(m['id'])
    ) {
      return false;
    }
    ids.add(m['id']);
  }
  if (!points.every((p) => isPoint(p, ids))) {
    return false;
  }
  // Strictly ascending dates (ISO days compare lexicographically).
  return points.every(
    (p, i) =>
      i === 0 ||
      (points[i - 1] as NetWorthPoint).date < (p as NetWorthPoint).date,
  );
}
