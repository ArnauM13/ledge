import { DecimalString } from '@ledge/shared-types';

/**
 * Exact subtraction of two decimal strings (BigInt, no float rounding).
 * The only money arithmetic in the frontend: the change shown for a range.
 */
export function subtractDecimal(a: DecimalString, b: DecimalString): string {
  const scale = Math.max(fractionDigits(a), fractionDigits(b), 2);
  const diff = toUnits(a, scale) - toUnits(b, scale);
  const negative = diff < 0n;
  const digits = (negative ? -diff : diff).toString().padStart(scale + 1, '0');
  const int = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale);
  return `${negative ? '-' : ''}${int}.${frac}`;
}

function fractionDigits(v: string): number {
  const dot = v.indexOf('.');
  return dot === -1 ? 0 : v.length - dot - 1;
}

function toUnits(v: string, scale: number): bigint {
  const negative = v.startsWith('-');
  const [int, frac = ''] = (negative ? v.slice(1) : v).split('.');
  const units = BigInt(int + frac.padEnd(scale, '0'));
  return negative ? -units : units;
}
