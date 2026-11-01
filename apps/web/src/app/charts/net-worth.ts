import { LineSeries, parseIsoDay, SeriesSlot } from '@ledge/web-charts';
import { NetWorthPoint, NetWorthSeries } from '@ledge/shared-types';
import { subtractDecimal } from './decimal';

export type NetWorthRange = '1M' | '6M' | '1A' | 'Tot';
export type NetWorthView = 'household' | 'members';

export const NET_WORTH_RANGES: readonly NetWorthRange[] = [
  '1M',
  '6M',
  '1A',
  'Tot',
];
const RANGE_MONTHS: Record<NetWorthRange, number | null> = {
  '1M': 1,
  '6M': 6,
  '1A': 12,
  Tot: null,
};

/** Points within the range, counted back from the latest point. */
export function pointsInRange(
  points: NetWorthPoint[],
  range: NetWorthRange,
): NetWorthPoint[] {
  const months = RANGE_MONTHS[range];
  if (months === null || points.length === 0) {
    return points;
  }
  const last = parseIsoDay(points[points.length - 1].date);
  // Same day N months earlier, clamped to the month's end (31 oct → 30 sep).
  const y = last.getUTCFullYear();
  const m = last.getUTCMonth() - months;
  const lastDayOfMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cutoff = new Date(
    Date.UTC(y, m, Math.min(last.getUTCDate(), lastDayOfMonth)),
  );
  return points.filter((p) => parseIsoDay(p.date) >= cutoff);
}

/** Maps the API contract to chart series. Member order → colour slot. */
export function toLineSeries(
  data: NetWorthSeries,
  view: NetWorthView,
  range: NetWorthRange,
): LineSeries[] {
  const points = pointsInRange(data.points, range);
  if (view === 'household') {
    return [
      {
        id: 'household',
        label: 'Household',
        slot: 1,
        points: points.map((p) => ({
          date: parseIsoDay(p.date),
          value: Number(p.total),
          estimated: p.quality === 'ESTIMATED',
        })),
      },
    ];
  }
  return data.members.slice(0, 5).map((m, i) => ({
    id: m.id,
    label: m.label,
    slot: (i + 1) as SeriesSlot,
    points: points.flatMap((p) => {
      const amount = p.byMember[m.id];
      return amount === undefined
        ? []
        : [
            {
              date: parseIsoDay(p.date),
              value: Number(amount),
              estimated: p.quality === 'ESTIMATED',
            },
          ];
    }),
  }));
}

export interface NetWorthHeadline {
  /** Latest household total. */
  current: string;
  /** Latest minus first point of the range (exact). */
  change: string;
  first: NetWorthPoint;
  last: NetWorthPoint;
}

export function headline(
  data: NetWorthSeries,
  range: NetWorthRange,
): NetWorthHeadline | null {
  const points = pointsInRange(data.points, range);
  if (points.length === 0) {
    return null;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return {
    current: last.total,
    change: subtractDecimal(last.total, first.total),
    first,
    last,
  };
}
