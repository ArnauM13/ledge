import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, line } from 'd3-shape';
import { formatAxisDate, formatEurCompact } from './format';
import { LinePoint, LineSeries, SeriesSlot } from './line-chart.model';

export interface Box {
  width: number;
  height: number;
}

export const MARGIN = { top: 12, right: 16, bottom: 28, left: 56 } as const;

export interface Tick {
  /** Pixel position along the axis. */
  pos: number;
  label: string;
}

export interface SeriesPath {
  id: string;
  slot: SeriesSlot;
  /** Consecutive runs; a run is estimated if any of its endpoints is. */
  segments: { d: string; estimated: boolean }[];
  /** Only for a single series: a 10% wash down to the plot bottom. */
  area: string | null;
  end: { x: number; y: number; value: number } | null;
}

export interface LineGeometry {
  plot: { left: number; top: number; right: number; bottom: number };
  xTicks: Tick[];
  yTicks: Tick[];
  series: SeriesPath[];
  /** Union of every series' dates, sorted, unique (by time). */
  dates: Date[];
  /** X pixel for each entry of `dates`. */
  xs: number[];
  /** Y pixel for a value (for the hover markers). */
  y: (value: number) => number;
}

/** Splits a series into runs of equal "estimated" class. */
export function splitRuns(
  points: LinePoint[],
): { points: LinePoint[]; estimated: boolean }[] {
  if (points.length < 2) {
    return points.length === 1
      ? [{ points, estimated: points[0].estimated }]
      : [];
  }
  const runs: { points: LinePoint[]; estimated: boolean }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const estimated = points[i].estimated || points[i + 1].estimated;
    const last = runs[runs.length - 1];
    if (last && last.estimated === estimated) {
      last.points.push(points[i + 1]);
    } else {
      runs.push({ points: [points[i], points[i + 1]], estimated });
    }
  }
  return runs;
}

export function unionDates(series: LineSeries[]): Date[] {
  const times = new Set<number>();
  for (const s of series) {
    for (const p of s.points) {
      times.add(p.date.getTime());
    }
  }
  return [...times].sort((a, b) => a - b).map((t) => new Date(t));
}

/** Index of the date closest to pixel `x` (xs sorted ascending). */
export function nearestIndex(xs: number[], x: number): number {
  if (xs.length === 0) {
    return -1;
  }
  let lo = 0;
  let hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
}

export function buildLineGeometry(
  series: LineSeries[],
  box: Box,
): LineGeometry | null {
  const dates = unionDates(series);
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  if (dates.length === 0 || box.width <= MARGIN.left + MARGIN.right) {
    return null;
  }

  const plot = {
    left: MARGIN.left,
    top: MARGIN.top,
    right: box.width - MARGIN.right,
    bottom: box.height - MARGIN.bottom,
  };

  const first = dates[0];
  const last = dates[dates.length - 1];
  const x = scaleUtc()
    .domain(
      first.getTime() === last.getTime()
        ? [new Date(first.getTime() - 864e5), new Date(last.getTime() + 864e5)]
        : [first, last],
    )
    .range([plot.left, plot.right]);

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const y = scaleLinear()
    .domain([min, max])
    .nice(4)
    .range([plot.bottom, plot.top]);

  const tickCount = Math.max(
    2,
    Math.min(6, Math.floor((plot.right - plot.left) / 70)),
  );
  const spanDays = (last.getTime() - first.getTime()) / 864e5;
  const xTicks = x.ticks(tickCount).map((d) => ({
    pos: x(d),
    label: formatAxisDate(d, spanDays),
  }));
  const yTicks = y.ticks(4).map((v) => ({
    pos: y(v),
    label: formatEurCompact(v),
  }));

  const lineGen = line<LinePoint>()
    .x((p) => x(p.date))
    .y((p) => y(p.value));
  const areaGen = area<LinePoint>()
    .x((p) => x(p.date))
    .y0(plot.bottom)
    .y1((p) => y(p.value));

  const paths: SeriesPath[] = series.map((s) => {
    const lastPoint = s.points[s.points.length - 1];
    return {
      id: s.id,
      slot: s.slot,
      segments: splitRuns(s.points).map((run) => ({
        d: lineGen(run.points) ?? '',
        estimated: run.estimated,
      })),
      area:
        series.length === 1 && s.points.length > 1
          ? (areaGen(s.points) ?? null)
          : null,
      end: lastPoint
        ? {
            x: x(lastPoint.date),
            y: y(lastPoint.value),
            value: lastPoint.value,
          }
        : null,
    };
  });

  return {
    plot,
    xTicks,
    yTicks,
    series: paths,
    dates,
    xs: dates.map((d) => x(d)),
    y: (v: number) => y(v),
  };
}
