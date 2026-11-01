/** Number and date formatting for charts (locale ca-ES, EUR, UTC dates). */

const LOCALE = 'ca-ES';

const eur = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
});
const eurSigned = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'EUR',
  signDisplay: 'exceptZero',
});
const compact = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const monthShort = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  timeZone: 'UTC',
});
const dayShort = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const dayLong = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `130000` → `130.000,00 €` */
export function formatEur(value: number): string {
  return eur.format(value);
}

/** `2340` → `+2.340,00 €`, `-1200` → `-1.200,00 €`, `0` → `0,00 €` */
export function formatEurSigned(value: number): string {
  return eurSigned.format(value);
}

/** Axis ticks: `0 €`, `950 €`, `50 k€`, `1,3 M€`. */
export function formatEurCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${compact.format(value / 1_000_000)} M€`;
  }
  if (abs >= 1_000) {
    return `${compact.format(value / 1_000)} k€`;
  }
  return `${compact.format(value)} €`;
}

/**
 * Axis tick. Spans under ~3 months: the day (`12 d’oct.`). Longer spans:
 * the year in January (`2026`), otherwise the month (`oct.`).
 */
export function formatAxisDate(date: Date, spanDays = Infinity): string {
  if (spanDays < 95) {
    return dayShort.format(date);
  }
  return date.getUTCMonth() === 0
    ? String(date.getUTCFullYear())
    : monthShort.format(date);
}

/** Tooltip / table: `31 d’oct. del 2026`. */
export function formatDayLong(date: Date): string {
  return dayLong.format(date);
}

/** Parses a `YYYY-MM-DD` day as UTC midnight (no timezone shift). */
export function parseIsoDay(day: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) {
    throw new Error(`Invalid ISO day: ${day}`);
  }
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}
