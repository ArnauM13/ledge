import { isDecimalString, isNetWorthSeries, NetWorthSeries } from './net-worth';

// The Phase 2 reference case: household 130.000 €, A 70.000 €, B 60.000 €.
const valid: NetWorthSeries = {
  currency: 'EUR',
  members: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  points: [
    {
      date: '2026-10-30',
      total: '129500.00',
      byMember: { a: '69750.00', b: '59750.00' },
      quality: 'REAL',
    },
    {
      date: '2026-10-31',
      total: '130000.00',
      byMember: { a: '70000.00', b: '60000.00' },
      quality: 'ESTIMATED',
    },
  ],
};

describe('isDecimalString', () => {
  it.each(['0', '130000.00', '-1200.5'])('accepts %s', (v) => {
    expect(isDecimalString(v)).toBe(true);
  });
  it.each(['', '1,5', '1e3', ' 1', 12])('rejects %s', (v) => {
    expect(isDecimalString(v)).toBe(false);
  });
});

describe('isNetWorthSeries', () => {
  it('accepts a valid series and an empty one', () => {
    expect(isNetWorthSeries(valid)).toBe(true);
    expect(isNetWorthSeries({ ...valid, points: [] })).toBe(true);
  });

  it('rejects numbers instead of decimal strings', () => {
    const bad = structuredClone(valid) as unknown as {
      points: { total: unknown }[];
    };
    bad.points[0].total = 129500;
    expect(isNetWorthSeries(bad)).toBe(false);
  });

  it('rejects unknown members, duplicate member ids and other currencies', () => {
    const unknownMember = structuredClone(valid);
    unknownMember.points[0].byMember = { c: '1.00' };
    expect(isNetWorthSeries(unknownMember)).toBe(false);
    expect(
      isNetWorthSeries({
        ...valid,
        members: [valid.members[0], valid.members[0]],
      }),
    ).toBe(false);
    expect(isNetWorthSeries({ ...valid, currency: 'USD' })).toBe(false);
  });

  it('rejects unsorted or duplicated dates', () => {
    expect(
      isNetWorthSeries({ ...valid, points: [...valid.points].reverse() }),
    ).toBe(false);
    expect(
      isNetWorthSeries({
        ...valid,
        points: [valid.points[0], valid.points[0]],
      }),
    ).toBe(false);
  });
});
