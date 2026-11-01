import {
  formatAxisDate,
  formatDayLong,
  formatEur,
  formatEurCompact,
  formatEurSigned,
  parseIsoDay,
} from './format';

// Intl uses non-breaking spaces; normalise them for readable assertions.
const n = (s: string) => s.replace(/\u00a0|\u202f/g, ' ');

describe('format', () => {
  it('formats euros in ca-ES', () => {
    expect(n(formatEur(130000))).toBe('130.000,00 €');
    expect(n(formatEurSigned(2340))).toBe('+2.340,00 €');
    expect(n(formatEurSigned(-1200))).toBe('-1.200,00 €');
    expect(n(formatEurSigned(0))).toBe('0,00 €');
  });

  it('formats compact axis values', () => {
    expect(formatEurCompact(0)).toBe('0 €');
    expect(formatEurCompact(950)).toBe('950 €');
    expect(formatEurCompact(50_000)).toBe('50 k€');
    expect(formatEurCompact(1_250_000)).toBe('1,3 M€');
    expect(formatEurCompact(-20_000)).toBe('-20 k€');
  });

  it('parses ISO days as UTC and formats them', () => {
    const d = parseIsoDay('2026-10-31');
    expect(d.toISOString()).toBe('2026-10-31T00:00:00.000Z');
    expect(formatDayLong(d)).toBe('31 d’oct. del 2026');
    expect(formatAxisDate(d)).toBe('oct.');
    expect(formatAxisDate(parseIsoDay('2027-01-01'))).toBe('2027');
    expect(formatAxisDate(d, 30)).toBe('31 d’oct.');
    expect(() => parseIsoDay('31/10/2026')).toThrow();
  });
});
