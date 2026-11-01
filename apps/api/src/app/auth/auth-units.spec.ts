import { randomBytes } from 'node:crypto';
import { TOTP_OPTIONS } from './auth.constants';
import { IpRateLimiter } from './ip-rate-limiter';
import {
  hashPassword,
  PasswordService,
  passwordProblem,
} from './password.service';
import {
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  normaliseRecoveryCode,
} from './recovery-codes';
import { csrfTokenFor, hashToken } from './session.service';
import {
  currentTotp,
  generateTotpSecret,
  totpEnrolment,
  verifyTotp,
} from './totp';
import { parseCreateUserArgs } from '../../cli/create-user-args';

describe('password (argon2id)', () => {
  const service = new PasswordService();
  beforeAll(() => service.onModuleInit());

  it('hashes with argon2id and the OWASP parameters (m=19 MiB, t=2, p=1)', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(service.needsRehash(hash)).toBe(false);
  });

  it('verifies the right password only', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await service.verify(hash, 'correct horse battery staple')).toBe(
      true,
    );
    expect(await service.verify(hash, 'Correct horse battery staple')).toBe(
      false,
    );
  });

  it('returns false for unknown users (dummy hash) and garbage hashes', async () => {
    expect(await service.verify(null, 'dummy-password-for-unknown-users')).toBe(
      false,
    );
    expect(await service.verify('not-a-hash', 'x')).toBe(false);
  });

  it('flags hashes with weaker parameters for rehash', async () => {
    const argon2 = await import('argon2');
    const weak = await argon2.hash('x', {
      type: argon2.argon2id,
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
    });
    expect(service.needsRehash(weak)).toBe(true);
  });

  it('enforces the password policy', () => {
    expect(passwordProblem('short')).toMatch(/at least 12/);
    expect(passwordProblem('x'.repeat(257))).toMatch(/at most 256/);
    expect(
      passwordProblem('Someone@Example.com', 'someone@example.com'),
    ).toMatch(/email/);
    expect(passwordProblem('a long enough passphrase')).toBeNull();
  });
});

describe('TOTP', () => {
  it('generates a 160-bit base32 secret and an otpauth URL + QR', async () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const enrolment = await totpEnrolment(secret, 'a@example.com');
    expect(enrolment.otpauthUrl).toMatch(
      /^otpauth:\/\/totp\/ledge:a%40example\.com\?/,
    );
    expect(enrolment.otpauthUrl).toContain(`secret=${secret}`);
    expect(enrolment.qrDataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('accepts the current code and +-1 step, returns the step', () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 1000 / TOTP_OPTIONS.period);
    expect(verifyTotp(secret, currentTotp(secret, now), now)).toBe(step);
    expect(verifyTotp(secret, currentTotp(secret, now - 30_000), now)).toBe(
      step - 1,
    );
    expect(verifyTotp(secret, currentTotp(secret, now + 30_000), now)).toBe(
      step + 1,
    );
    expect(
      verifyTotp(secret, currentTotp(secret, now - 90_000), now),
    ).toBeNull();
  });

  it('rejects malformed codes', () => {
    const secret = generateTotpSecret();
    for (const code of ['', '12345', '1234567', 'abcdef', '12 345']) {
      expect(verifyTotp(secret, code)).toBeNull();
    }
  });
});

describe('recovery codes', () => {
  it('generates 10 distinct 80-bit codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(
        /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/,
      );
      expect(looksLikeRecoveryCode(code)).toBe(true);
    }
  });

  it('normalises user input before hashing', () => {
    const [code] = generateRecoveryCodes(1);
    const typed = ` ${code.toLowerCase().replace(/-/g, ' ')} `;
    expect(hashRecoveryCode(typed)).toBe(hashRecoveryCode(code));
    expect(normaliseRecoveryCode('o0-il')).toBe('0011');
    expect(hashRecoveryCode(code)).not.toContain(normaliseRecoveryCode(code));
  });
});

describe('session tokens', () => {
  it('stores only a SHA-256 of the token and derives a CSRF token from it', () => {
    const token = randomBytes(32).toString('base64url');
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(csrfTokenFor(token)).toBe(csrfTokenFor(token));
    expect(csrfTokenFor(token)).not.toBe(
      csrfTokenFor(randomBytes(32).toString('base64url')),
    );
    expect(csrfTokenFor(token)).not.toContain(token);
  });
});

describe('IpRateLimiter', () => {
  it('allows max hits per window, then blocks until the window resets', () => {
    const limiter = new IpRateLimiter(3, 1000);
    expect([1, 2, 3].map(() => limiter.hit('1.2.3.4', 0))).toEqual([
      true,
      true,
      true,
    ]);
    expect(limiter.hit('1.2.3.4', 10)).toBe(false);
    expect(limiter.hit('5.6.7.8', 10)).toBe(true);
    expect(limiter.hit('1.2.3.4', 1001)).toBe(true);
  });
});

describe('create-user CLI arguments', () => {
  const ok = [
    '--email',
    ' A@Example.com ',
    '--name',
    'A',
    '--household-name',
    'Casa',
  ];

  it('parses and normalises', () => {
    expect(parseCreateUserArgs(ok)).toEqual({
      email: 'a@example.com',
      name: 'A',
      householdName: 'Casa',
      householdId: undefined,
    });
  });

  it.each([['--password', 'x'], ['--password=x'], ['-p', 'x'], ['--pwd=x']])(
    'refuses passwords as arguments (%s)',
    (...extra) => {
      expect(() => parseCreateUserArgs([...ok, ...extra])).toThrow(
        /never accepted as arguments/,
      );
    },
  );

  it('needs exactly one household option', () => {
    expect(() =>
      parseCreateUserArgs(['--email', 'a@b.co', '--name', 'A']),
    ).toThrow(/exactly one/);
    expect(() =>
      parseCreateUserArgs([
        ...ok,
        '--household-id',
        '00000000-0000-4000-8000-000000000000',
      ]),
    ).toThrow(/exactly one/);
  });

  it('rejects unknown options and bad values', () => {
    expect(() => parseCreateUserArgs([...ok, '--admin'])).toThrow();
    expect(() =>
      parseCreateUserArgs([
        '--email',
        'nope',
        '--name',
        'A',
        '--household-name',
        'C',
      ]),
    ).toThrow(/email/);
  });
});
