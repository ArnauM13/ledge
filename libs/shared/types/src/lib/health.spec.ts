import { isHealthResponse } from './health';

describe('isHealthResponse', () => {
  it('accepts a valid health payload', () => {
    expect(
      isHealthResponse({
        status: 'ok',
        service: 'api',
        timestamp: '2026-10-31T12:00:00.000Z',
      }),
    ).toBe(true);
  });

  it.each([
    null,
    'ok',
    {},
    { status: 'down', service: 'api', timestamp: '2026-10-31T12:00:00.000Z' },
    { status: 'ok', service: 'api', timestamp: 'not-a-date' },
  ])('rejects %p', (value) => {
    expect(isHealthResponse(value)).toBe(false);
  });
});
