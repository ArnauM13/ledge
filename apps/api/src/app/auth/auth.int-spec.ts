import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module';
import { configureApp } from '../configure-app';
import { PRISMA } from '../prisma/prisma.module';
import type { AppPrismaClient } from '../prisma/prisma-client';
import { createUserWithHousehold, TEST_PASSWORD } from '../../test/fixtures';
import { TestClient } from '../../test/http-client';
import { signInFirstTime } from '../../test/sign-in';
import { GENERIC_AUTH_ERROR, SESSION_COOKIE } from './auth.constants';
import { IpRateLimiter } from './ip-rate-limiter';
import { hashToken } from './session.service';
import { currentTotp } from './totp';

describe('Auth (HTTP, real PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: AppPrismaClient;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    prisma = app.get(PRISMA);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    app.get(IpRateLimiter).reset();
  });

  const enrol = (email: string) => signInFirstTime(baseUrl, email);

  async function auditRows(userId: string | null, since: Date) {
    return prisma.auditLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });
  }

  it('first login: password -> mandatory TOTP enrolment with QR -> recovery codes once -> full session', async () => {
    const { email } = await createUserWithHousehold(prisma);
    const client = new TestClient(baseUrl);

    const login = await client.post('/api/auth/login', {
      email,
      password: TEST_PASSWORD,
    });
    expect(login.status).toBe(200);
    expect(login.body).toEqual({
      next: 'totp-setup',
      csrfToken: expect.any(String),
    });
    const cookie =
      login.setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`)) ?? '';
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; Secure/i);
    expect(cookie).toMatch(/; SameSite=Strict/i);
    expect(cookie).toMatch(/; Path=\//i);
    const pendingToken = client.cookies.get(SESSION_COOKIE) as string;

    // Password alone gives no access to protected data.
    expect((await client.get('/api/auth/session')).body).toMatchObject({
      authenticated: false,
      next: 'totp-setup',
    });
    const { household } = await prisma.membership.findFirstOrThrow({
      where: { user: { email } },
      include: { household: true },
    });
    expect((await client.get(`/api/households/${household.id}`)).status).toBe(
      401,
    );

    const setup = await client.post('/api/auth/totp/setup');
    expect(setup.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/');
    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.totpPendingSecretEnc).toMatch(/^enc:v1:1:/);
    expect(stored.totpPendingSecretEnc).not.toContain(setup.body.secret);

    const wrong = await client.post('/api/auth/totp/setup/confirm', {
      code: '000000',
    });
    expect(wrong.status).toBe(401);

    const confirm = await client.post('/api/auth/totp/setup/confirm', {
      code: currentTotp(setup.body.secret),
    });
    expect(confirm.status).toBe(200);
    expect(confirm.body.recoveryCodes).toHaveLength(10);
    const enrolled = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(enrolled.totpEnabledAt).not.toBeNull();
    expect(enrolled.totpSecretEnc).toMatch(/^enc:v1:1:/);
    expect(enrolled.totpPendingSecretEnc).toBeNull();
    const codes = await prisma.recoveryCode.findMany({
      where: { userId: enrolled.id },
    });
    expect(codes).toHaveLength(10);
    for (const code of confirm.body.recoveryCodes as string[]) {
      expect(
        codes.some((c) => c.codeHash.includes(code.replace(/-/g, ''))),
      ).toBe(false);
    }

    // Session rotated: new token, the pre-2FA one is revoked.
    expect(client.cookies.get(SESSION_COOKIE)).not.toBe(pendingToken);
    const old = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashToken(pendingToken) },
    });
    expect(old.revokedAt).not.toBeNull();

    const session = await client.get('/api/auth/session');
    expect(session.body).toMatchObject({
      authenticated: true,
      user: { email },
    });
    expect(session.body.households).toHaveLength(1);

    // Enrolment cannot be restarted once enabled (and the codes are never shown again).
    expect((await client.post('/api/auth/totp/setup')).status).toBe(401);
  });

  it('second login needs a valid, unused TOTP code', async () => {
    const { email } = await createUserWithHousehold(prisma);
    const { secret } = await enrol(email);

    const client = new TestClient(baseUrl);
    const login = await client.post('/api/auth/login', {
      email,
      password: TEST_PASSWORD,
    });
    expect(login.body.next).toBe('totp');
    // The enrolment already used the current step: replaying it fails.
    expect(
      (
        await client.post('/api/auth/totp/verify', {
          code: currentTotp(secret),
        })
      ).status,
    ).toBe(401);
    const next = currentTotp(secret, Date.now() + 30_000);
    expect(
      (await client.post('/api/auth/totp/verify', { code: next })).status,
    ).toBe(200);
    expect((await client.get('/api/auth/session')).body.authenticated).toBe(
      true,
    );

    // A code can be used only once, even in a new login.
    const again = new TestClient(baseUrl);
    await again.post('/api/auth/login', { email, password: TEST_PASSWORD });
    expect(
      (await again.post('/api/auth/totp/verify', { code: next })).status,
    ).toBe(401);
  });

  it('a recovery code works exactly once', async () => {
    const { email } = await createUserWithHousehold(prisma);
    const { recoveryCodes } = await enrol(email);

    const first = new TestClient(baseUrl);
    await first.post('/api/auth/login', { email, password: TEST_PASSWORD });
    expect(
      (
        await first.post('/api/auth/recovery', {
          code: recoveryCodes[0].toLowerCase(),
        })
      ).status,
    ).toBe(200);

    const second = new TestClient(baseUrl);
    await second.post('/api/auth/login', { email, password: TEST_PASSWORD });
    expect(
      (await second.post('/api/auth/recovery', { code: recoveryCodes[0] }))
        .status,
    ).toBe(401);
    expect(
      (await second.post('/api/auth/recovery', { code: recoveryCodes[1] }))
        .status,
    ).toBe(200);
  });

  it('errors are generic: unknown user and wrong password look the same', async () => {
    const { email } = await createUserWithHousehold(prisma);
    const client = new TestClient(baseUrl);
    const unknown = await client.post('/api/auth/login', {
      email: 'nobody@example.test',
      password: TEST_PASSWORD,
    });
    const wrong = await client.post('/api/auth/login', {
      email,
      password: 'wrong password!!',
    });
    const malformed = await client.post('/api/auth/login', { email: 42 });
    for (const res of [unknown, wrong, malformed]) {
      expect(res.status).toBe(401);
      expect(res.body.message).toBe(GENERIC_AUTH_ERROR);
    }
    expect(unknown.body).toEqual(wrong.body);
  });

  it('locks the account after 5 failures, even for the right password', async () => {
    const { email, user } = await createUserWithHousehold(prisma);
    const client = new TestClient(baseUrl);
    for (let i = 0; i < 5; i++) {
      expect(
        (
          await client.post('/api/auth/login', {
            email,
            password: `wrong password ${i}`,
          })
        ).status,
      ).toBe(401);
    }
    const locked = await client.post('/api/auth/login', {
      email,
      password: TEST_PASSWORD,
    });
    expect(locked.status).toBe(401);
    expect(locked.body.message).toBe(GENERIC_AUTH_ERROR);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lockedUntil?.getTime()).toBeGreaterThan(
      Date.now() + 14 * 60_000,
    );

    // Lock expired -> the right password works again.
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    expect(
      (await client.post('/api/auth/login', { email, password: TEST_PASSWORD }))
        .status,
    ).toBe(200);
  });

  it('TOTP failures count towards the lockout', async () => {
    const { email, user } = await createUserWithHousehold(prisma);
    await enrol(email);
    const client = new TestClient(baseUrl);
    await client.post('/api/auth/login', { email, password: TEST_PASSWORD });
    for (let i = 0; i < 5; i++) {
      await client.post('/api/auth/totp/verify', { code: '000000' });
    }
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.lockedUntil).not.toBeNull();
  });

  it('rate limits by IP (429)', async () => {
    const client = new TestClient(baseUrl);
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (
        await client.post('/api/auth/login', {
          email: 'x@example.test',
          password: 'whatever',
        })
      ).status;
    }
    expect(last).toBe(429);
  });

  it('logout invalidates the session on the server', async () => {
    const { email, household } = await createUserWithHousehold(prisma);
    const { client } = await enrol(email);
    const token = client.cookies.get(SESSION_COOKIE) as string;
    expect((await client.post('/api/auth/logout')).status).toBe(204);
    expect(client.cookies.has(SESSION_COOKIE)).toBe(false);

    // Replaying the old cookie does not work.
    const replay = new TestClient(baseUrl);
    replay.cookies.set(SESSION_COOKIE, token);
    expect((await replay.get('/api/auth/session')).body).toEqual({
      authenticated: false,
    });
    expect((await replay.get(`/api/households/${household.id}`)).status).toBe(
      401,
    );
  });

  it('expires sessions after inactivity and after the absolute lifetime', async () => {
    const { email } = await createUserWithHousehold(prisma);
    const { client } = await enrol(email);
    const tokenHash = hashToken(client.cookies.get(SESSION_COOKIE) as string);

    await prisma.session.update({
      where: { tokenHash },
      data: { lastSeenAt: new Date(Date.now() - 16 * 60_000) },
    });
    expect((await client.get('/api/auth/session')).body.authenticated).toBe(
      false,
    );
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { tokenHash } }))
        .revokedAt,
    ).not.toBeNull();

    const { client: other } = await enrol(
      (await createUserWithHousehold(prisma)).email,
    );
    const otherHash = hashToken(other.cookies.get(SESSION_COOKIE) as string);
    await prisma.session.update({
      where: { tokenHash: otherHash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await other.get('/api/auth/session')).body.authenticated).toBe(
      false,
    );
  });

  it('pending (password-only) sessions expire after 5 minutes', async () => {
    const { email } = await createUserWithHousehold(prisma);
    const client = new TestClient(baseUrl);
    await client.post('/api/auth/login', { email, password: TEST_PASSWORD });
    const session = await prisma.session.findUniqueOrThrow({
      where: {
        tokenHash: hashToken(client.cookies.get(SESSION_COOKIE) as string),
      },
    });
    expect(session.expiresAt.getTime() - session.createdAt.getTime()).toBe(
      5 * 60_000,
    );
  });

  describe('CSRF', () => {
    it('rejects state-changing requests without the session CSRF token', async () => {
      const { email } = await createUserWithHousehold(prisma);
      const { client } = await enrol(email);
      expect(
        (await client.post('/api/auth/logout', {}, { 'x-csrf-token': '' }))
          .status,
      ).toBe(403);
      expect(
        (
          await client.post(
            '/api/auth/logout',
            {},
            { 'x-csrf-token': 'forged' },
          )
        ).status,
      ).toBe(403);
      expect((await client.get('/api/auth/session')).body.authenticated).toBe(
        true,
      );
    });

    it('rejects cross-site requests, foreign origins and non-JSON bodies', async () => {
      const client = new TestClient(baseUrl);
      const body = { email: 'x@example.test', password: 'whatever' };
      expect(
        (
          await client.post('/api/auth/login', body, {
            'sec-fetch-site': 'cross-site',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await client.post('/api/auth/login', body, {
            origin: 'https://evil.example',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await client.post('/api/auth/login', body, {
            'content-type': 'text/plain',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await client.post('/api/auth/login', body, {
            'sec-fetch-site': 'same-origin',
          })
        ).status,
      ).toBe(401);
    });
  });

  it('audits every login attempt without sensitive data', async () => {
    const since = new Date(Date.now() - 1000);
    const { email, user, household } = await createUserWithHousehold(prisma);
    const client = new TestClient(baseUrl);
    const typedEmail = `typo-${Date.now()}@example.test`;
    await client.post('/api/auth/login', {
      email: typedEmail,
      password: 'Secret-typed-password-1',
    });
    await client.post('/api/auth/login', {
      email,
      password: 'Secret-typed-password-2',
    });
    const { secret } = await enrol(email);

    const rows = await auditRows(user.id, since);
    expect(rows.map((r) => `${r.action}:${r.outcome}`)).toEqual([
      'auth.login.password:FAILURE',
      'auth.login.password:SUCCESS',
      'auth.totp.setup_start:SUCCESS',
      'auth.totp.setup_confirm:SUCCESS',
    ]);
    expect(rows.every((r) => r.householdId === household.id)).toBe(true);
    expect(rows[0].reason).toBe('invalid_password');

    const unknown = await prisma.auditLog.findMany({
      where: {
        userId: null,
        action: 'auth.login.password',
        createdAt: { gte: since },
      },
    });
    expect(unknown.some((r) => r.reason === 'unknown_user')).toBe(true);

    const everything = JSON.stringify(
      await prisma.auditLog.findMany({ where: { createdAt: { gte: since } } }),
    );
    for (const secretValue of [
      typedEmail,
      'Secret-typed-password',
      TEST_PASSWORD,
      secret,
    ]) {
      expect(everything).not.toContain(secretValue);
    }
  });
});
