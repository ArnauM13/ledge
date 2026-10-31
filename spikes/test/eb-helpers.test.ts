import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeValidUntil, parseRedirect, rfc3339 } from '../src/enable-banking/redirect.ts';
import { daysUntil, summarizeTransactions } from '../src/enable-banking/summary.ts';

test('parseRedirect extracts code and checks state', () => {
  assert.deepEqual(parseRedirect('https://example.com/cb?code=abc&state=s1', 's1'), { ok: true, code: 'abc' });
  assert.equal((parseRedirect('https://example.com/cb?code=abc&state=other', 's1') as { reason: string }).reason, 'state_mismatch');
  assert.equal((parseRedirect('https://example.com/cb?state=s1', 's1') as { reason: string }).reason, 'missing_code');
  assert.equal((parseRedirect('not a url', 's1') as { reason: string }).reason, 'invalid_url');
  const e = parseRedirect('https://example.com/cb?error=access_denied&error_description=x&state=s1', 's1');
  assert.deepEqual(e, { ok: false, reason: 'provider_error', error: 'access_denied', description: 'x' });
});

test('valid_until never exceeds maximum_consent_validity', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const max = 180 * 86400;
  assert.ok(computeValidUntil(now, max).getTime() <= now.getTime() + max * 1000);
  assert.ok(computeValidUntil(now, max, 365).getTime() <= now.getTime() + max * 1000);
  assert.equal(computeValidUntil(now, max, 10).toISOString(), '2026-01-10T23:55:00.000Z');
  assert.equal(rfc3339(now), '2026-01-01T00:00:00.000+00:00');
});

test('summarizeTransactions gives date range and status counts, no amounts', () => {
  const s = summarizeTransactions([
    { booking_date: '2026-03-01', status: 'BOOK' },
    { booking_date: null, value_date: '2025-09-01', status: 'BOOK' },
    { transaction_date: '2026-03-05', status: 'PDNG' },
  ]);
  assert.deepEqual(s, { count: 3, earliest: '2025-09-01', latest: '2026-03-05', span_days: 185, by_status: { BOOK: 2, PDNG: 1 } });
  assert.deepEqual(summarizeTransactions([]), { count: 0, earliest: null, latest: null, span_days: null, by_status: {} });
  assert.equal(daysUntil('2026-01-11T00:00:00+00:00', new Date('2026-01-01T00:00:00Z')), 10);
});
