import { NetWorthSeries } from '@ledge/shared-types';
import { subtractDecimal } from './decimal';
import { headline, pointsInRange, toLineSeries } from './net-worth';

const data: NetWorthSeries = {
  currency: 'EUR',
  members: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  points: [
    {
      date: '2025-10-30',
      total: '100000.10',
      byMember: { a: '50000.05', b: '50000.05' },
      quality: 'REAL',
    },
    {
      date: '2026-09-30',
      total: '125000.00',
      byMember: { a: '66000.00', b: '59000.00' },
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

describe('subtractDecimal', () => {
  it('is exact where floats are not', () => {
    expect(0.3 - 0.1).not.toBe(0.2);
    expect(subtractDecimal('0.3', '0.1')).toBe('0.20');
    expect(subtractDecimal('130000.00', '100000.10')).toBe('29999.90');
    expect(subtractDecimal('100', '130000.5')).toBe('-129900.50');
    expect(subtractDecimal('-1.005', '-1.005')).toBe('0.000');
  });
});

describe('pointsInRange', () => {
  it('counts back from the latest point', () => {
    expect(pointsInRange(data.points, '1M').map((p) => p.date)).toEqual([
      '2026-09-30',
      '2026-10-31',
    ]);
    expect(pointsInRange(data.points, '1A')).toHaveLength(2);
    expect(pointsInRange(data.points, 'Tot')).toHaveLength(3);
    expect(pointsInRange([], '1M')).toEqual([]);
  });
});

describe('toLineSeries', () => {
  it('household view: one series in slot 1', () => {
    const [s, ...rest] = toLineSeries(data, 'household', 'Tot');
    expect(rest).toEqual([]);
    expect(s.slot).toBe(1);
    expect(s.points.map((p) => [p.value, p.estimated])).toEqual([
      [100000.1, false],
      [125000, false],
      [130000, true],
    ]);
  });

  it('members view: member order fixes the colour', () => {
    const series = toLineSeries(data, 'members', '1M');
    expect(series.map((s) => [s.id, s.slot, s.points.length])).toEqual([
      ['a', 1, 2],
      ['b', 2, 2],
    ]);
  });
});

describe('headline', () => {
  it('reports the latest total and the exact change in the range', () => {
    expect(headline(data, 'Tot')).toMatchObject({
      current: '130000.00',
      change: '29999.90',
    });
    expect(headline({ ...data, points: [] }, 'Tot')).toBeNull();
  });
});
