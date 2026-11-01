import { NetWorthPoint, NetWorthSeries } from '@ledge/shared-types';

/**
 * TEST DATA for the dev-only chart gallery. Never shown in production builds
 * and never used outside /dev/charts. Deterministic (no Math.random).
 */
export function netWorthFixture(
  endIso = '2026-10-31',
  days = 730,
): NetWorthSeries {
  const end = Date.parse(`${endIso}T00:00:00Z`);
  const points: NetWorthPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = days - 1 - i; // 0 … days-1
    const date = new Date(end - i * 864e5).toISOString().slice(0, 10);
    // Integer cents: steady saving + market wobble + one dip.
    const a = Math.round(
      (52_000 +
        t * 26 +
        2_400 * Math.sin(t / 37) -
        (t > 400 && t < 470 ? 3_500 : 0)) *
        100,
    );
    const b = Math.round(
      (41_000 + t * 22 + 1_600 * Math.sin(t / 53 + 1)) * 100,
    );
    points.push({
      date,
      total: cents(a + b),
      byMember: { a: cents(a), b: cents(b) },
      // Last week: fund NAV not entered yet → estimated.
      quality: i < 7 ? 'ESTIMATED' : 'REAL',
    });
  }
  return {
    currency: 'EUR',
    members: [
      { id: 'a', label: 'Membre A' },
      { id: 'b', label: 'Membre B' },
    ],
    points,
  };
}

function cents(c: number): string {
  const sign = c < 0 ? '-' : '';
  const abs = Math.abs(c);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
