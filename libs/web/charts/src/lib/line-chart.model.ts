/** Input model of `ledge-line-chart`. Domain-agnostic: no money logic here. */

/** Categorical slot (1–5) → `--ledge-series-N`. Follows the entity, not the rank. */
export type SeriesSlot = 1 | 2 | 3 | 4 | 5;

export interface LinePoint {
  date: Date;
  value: number;
  /** Drawn dashed and labelled "estimat" in the tooltip and table. */
  estimated: boolean;
}

export interface LineSeries {
  id: string;
  label: string;
  slot: SeriesSlot;
  /** Sorted by date, ascending. */
  points: LinePoint[];
}

export type ChartState = 'empty' | 'loading' | 'error' | 'ready';
