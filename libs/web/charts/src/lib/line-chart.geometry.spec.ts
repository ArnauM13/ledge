import {
  buildLineGeometry,
  MARGIN,
  nearestIndex,
  splitRuns,
  unionDates,
} from './line-chart.geometry';
import { LinePoint, LineSeries } from './line-chart.model';

const day = (d: number) => new Date(Date.UTC(2026, 0, d));
const pt = (d: number, value: number, estimated = false): LinePoint => ({
  date: day(d),
  value,
  estimated,
});

describe('splitRuns', () => {
  it('returns no runs for no points and one run for a single point', () => {
    expect(splitRuns([])).toEqual([]);
    expect(splitRuns([pt(1, 1)])).toHaveLength(1);
  });

  it('marks a segment estimated if either endpoint is estimated', () => {
    const runs = splitRuns([
      pt(1, 1),
      pt(2, 2),
      pt(3, 3, true),
      pt(4, 4, true),
    ]);
    expect(runs.map((r) => [r.estimated, r.points.length])).toEqual([
      [false, 2],
      [true, 3],
    ]);
    // Runs share their joining point, so the line has no gap.
    expect(runs[0].points[1]).toBe(runs[1].points[0]);
  });
});

describe('unionDates', () => {
  it('merges, sorts and de-duplicates dates across series', () => {
    const a: LineSeries = {
      id: 'a',
      label: 'A',
      slot: 1,
      points: [pt(3, 1), pt(1, 1)],
    };
    const b: LineSeries = {
      id: 'b',
      label: 'B',
      slot: 2,
      points: [pt(1, 2), pt(2, 2)],
    };
    expect(unionDates([a, b]).map((d) => d.getUTCDate())).toEqual([1, 2, 3]);
  });
});

describe('nearestIndex', () => {
  it('snaps to the closest x', () => {
    const xs = [0, 10, 20, 30];
    expect(nearestIndex(xs, -5)).toBe(0);
    expect(nearestIndex(xs, 14)).toBe(1);
    expect(nearestIndex(xs, 16)).toBe(2);
    expect(nearestIndex(xs, 99)).toBe(3);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

describe('buildLineGeometry', () => {
  const single: LineSeries[] = [
    {
      id: 'hh',
      label: 'Household',
      slot: 1,
      points: [pt(1, 100_000), pt(31, 130_000)],
    },
  ];

  it('returns null with no data or no room', () => {
    expect(buildLineGeometry([], { width: 600, height: 240 })).toBeNull();
    expect(buildLineGeometry(single, { width: 10, height: 240 })).toBeNull();
  });

  it('maps first and last dates to the plot edges', () => {
    const g = buildLineGeometry(single, { width: 600, height: 240 });
    expect(g?.xs).toEqual([MARGIN.left, 600 - MARGIN.right]);
    expect(g?.series[0].end?.value).toBe(130_000);
  });

  it('draws an area only for a single series', () => {
    const g1 = buildLineGeometry(single, { width: 600, height: 240 });
    expect(g1?.series[0].area).toBeTruthy();
    const two: LineSeries[] = [
      ...single,
      { id: 'b', label: 'B', slot: 2, points: [pt(1, 50_000), pt(31, 60_000)] },
    ];
    const g2 = buildLineGeometry(two, { width: 600, height: 240 });
    expect(g2?.series.map((s) => s.area)).toEqual([null, null]);
  });

  it('uses clean, compact y ticks inside the plot', () => {
    const g = buildLineGeometry(single, { width: 600, height: 240 });
    const labels = g?.yTicks.map((t) => t.label) ?? [];
    expect(labels[0]).toBe('100 k€');
    expect(labels[labels.length - 1]).toBe('130 k€');
    for (const t of g?.yTicks ?? []) {
      expect(t.pos).toBeGreaterThanOrEqual(MARGIN.top);
      expect(t.pos).toBeLessThanOrEqual(240 - MARGIN.bottom);
    }
  });

  it('handles a flat or single-point series without NaN', () => {
    const flat: LineSeries[] = [
      { id: 'hh', label: 'Household', slot: 1, points: [pt(5, 0)] },
    ];
    const g = buildLineGeometry(flat, { width: 600, height: 240 });
    expect(Number.isFinite(g?.xs[0])).toBe(true);
    expect(Number.isFinite(g?.y(0))).toBe(true);
  });
});
