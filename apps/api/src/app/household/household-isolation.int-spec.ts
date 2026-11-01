import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../app.module';
import { IpRateLimiter } from '../auth/ip-rate-limiter';
import { configureApp } from '../configure-app';
import { HouseholdScope, PRISMA } from '../prisma/prisma.module';
import type { AppPrismaClient } from '../prisma/prisma-client';
import { createUserWithHousehold } from '../../test/fixtures';
import { TestClient } from '../../test/http-client';
import { signInFirstTime } from '../../test/sign-in';
import {
  HouseholdScopeViolationError,
  UnscopedQueryError,
} from './household-scope';

describe('Household isolation', () => {
  let app: INestApplication;
  let prisma: AppPrismaClient;
  let baseUrl: string;

  let a: { client: TestClient; householdId: string };
  let b: { client: TestClient; householdId: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleRef.createNestApplication({ logger: false }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    prisma = app.get(PRISMA);
    app.get(IpRateLimiter).reset();

    const userA = await createUserWithHousehold(prisma, 'Household A');
    const userB = await createUserWithHousehold(prisma, 'Household B');
    a = {
      client: (await signInFirstTime(baseUrl, userA.email)).client,
      householdId: userA.household.id,
    };
    b = {
      client: (await signInFirstTime(baseUrl, userB.email)).client,
      householdId: userB.household.id,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  describe('over HTTP', () => {
    it('a member reads and modifies their own household', async () => {
      const read = await a.client.get(`/api/households/${a.householdId}`);
      expect(read.status).toBe(200);
      expect(read.body).toEqual({
        id: a.householdId,
        name: 'Household A',
        role: 'OWNER',
      });

      const renamed = await a.client.request(
        'PATCH',
        `/api/households/${a.householdId}`,
        { name: 'Casa A' },
      );
      expect(renamed.status).toBe(200);
      expect(renamed.body.name).toBe('Casa A');
    });

    it("cannot read another household's data: 404, not 403", async () => {
      const res = await a.client.get(`/api/households/${b.householdId}`);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain('Household B');
    });

    it("cannot modify another household's data: 404, and nothing changes", async () => {
      const res = await a.client.request(
        'PATCH',
        `/api/households/${b.householdId}`,
        { name: 'hacked' },
      );
      expect(res.status).toBe(404);
      const row = await prisma.household.findUniqueOrThrow({
        where: { id: b.householdId },
      });
      expect(row.name).toBe('Household B');
    });

    it('a household that does not exist looks exactly the same (404)', async () => {
      const missing = await a.client.get(`/api/households/${randomUUID()}`);
      const foreign = await a.client.get(`/api/households/${b.householdId}`);
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual(foreign.body);
      expect((await a.client.get('/api/households/not-a-uuid')).status).toBe(
        404,
      );
    });

    it('works the other way round too', async () => {
      expect(
        (await b.client.get(`/api/households/${b.householdId}`)).status,
      ).toBe(200);
      expect(
        (await b.client.get(`/api/households/${a.householdId}`)).status,
      ).toBe(404);
    });

    it('needs a full session (401 without one)', async () => {
      expect(
        (await new TestClient(baseUrl).get(`/api/households/${a.householdId}`))
          .status,
      ).toBe(401);
    });
  });

  describe('data layer', () => {
    it('the application client refuses queries without a household filter', async () => {
      await expect(prisma.household.findMany()).rejects.toThrow(
        UnscopedQueryError,
      );
      await expect(
        prisma.household.findFirst({ where: { name: 'Household B' } }),
      ).rejects.toThrow(UnscopedQueryError);
      await expect(prisma.household.count()).rejects.toThrow(
        UnscopedQueryError,
      );
      await expect(
        prisma.household.updateMany({ data: { name: 'x' } }),
      ).rejects.toThrow(UnscopedQueryError);
      await expect(prisma.household.deleteMany()).rejects.toThrow(
        UnscopedQueryError,
      );
    });

    it("a scoped client only ever sees its household's rows", async () => {
      const db = app.get(HouseholdScope).forHousehold(a.householdId);
      const all = await db.household.findMany({ select: { id: true } });
      expect(all).toEqual([{ id: a.householdId }]);
      expect(await db.household.count()).toBe(1);
      // Asking for B explicitly still returns nothing.
      expect(
        await db.household.findUnique({ where: { id: b.householdId } }),
      ).toBeNull();
      expect(
        await db.household.findFirst({ where: { id: b.householdId } }),
      ).toBeNull();
    });

    it("a scoped client cannot change another household's rows", async () => {
      const db = app.get(HouseholdScope).forHousehold(a.householdId);
      await expect(
        db.household.update({
          where: { id: b.householdId },
          data: { name: 'x' },
        }),
      ).rejects.toMatchObject({
        code: 'P2025',
      });
      expect(
        (
          await db.household.updateMany({
            where: { id: b.householdId },
            data: { name: 'x' },
          })
        ).count,
      ).toBe(0);
      await expect(
        db.household.delete({ where: { id: b.householdId } }),
      ).rejects.toMatchObject({ code: 'P2025' });
      await expect(
        db.household.create({ data: { name: 'new' } }),
      ).rejects.toThrow(HouseholdScopeViolationError);
      await expect(
        db.household.update({
          where: { id: a.householdId },
          data: { id: b.householdId },
        }),
      ).rejects.toThrow(HouseholdScopeViolationError);
      const row = await prisma.household.findUniqueOrThrow({
        where: { id: b.householdId },
      });
      expect(row.name).toBe('Household B');
    });
  });
});
